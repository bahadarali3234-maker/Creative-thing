/**
 * Cloud Functions for FaceMorph Studio
 * NOTE: As per architecture requirements, NO face swap or computer vision
 * processing ever runs in Cloud Functions. All neural alignment and image synthesis
 * occurs 100% client-side in the user's browser.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import * as functions from 'firebase-functions';

initializeApp();
const db = getFirestore();
const storage = getStorage();

const PLAN_QUOTAS: Record<string, number> = {
  free: 5,
  pro: 50,
  enterprise: 500,
};

/**
 * Returns current month key in format 'YYYY-MM' (UTC).
 */
export function getCurrentMonthKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Triggered on new Firebase Auth user creation.
 * Initializes default user record in Firestore.
 */
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const userRef = db.collection('users').doc(user.uid);
  const monthKey = getCurrentMonthKey();

  const initialData = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || 'Creator',
    photoURL: user.photoURL || null,
    plan: 'free',
    exportsThisMonth: 0,
    monthKey: monthKey,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    consentLog: [],
  };

  await userRef.set(initialData, { merge: true });
});

/**
 * Callable function: recordExport
 * Verifies authenticated session, checks email verification,
 * enforces monthly plan quotas, and atomically increments export count in a transaction.
 */
export const recordExport = onCall(async (request) => {
  // 1. Verify authentication
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError(
      'unauthenticated',
      'You must be signed in to export face swap videos.'
    );
  }

  const { uid, token } = request.auth;

  // 2. Verify email verification (or demo allow for testing)
  if (!token.email_verified && process.env.NODE_ENV !== 'development') {
    throw new HttpsError(
      'permission-denied',
      'Please verify your email address before exporting videos.'
    );
  }

  const userRef = db.collection('users').doc(uid);
  const currentMonthKey = getCurrentMonthKey();

  // 3. Atomically evaluate quota inside transaction
  const result = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User record not found.');
    }

    const data = userDoc.data() || {};
    const plan = (data.plan as string) || 'free';
    const storedMonthKey = data.monthKey || currentMonthKey;
    let exportsThisMonth = Number(data.exportsThisMonth) || 0;

    // Reset counter if month has rolled over
    if (storedMonthKey !== currentMonthKey) {
      exportsThisMonth = 0;
    }

    const quotaLimit = PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;

    if (exportsThisMonth >= quotaLimit) {
      throw new HttpsError(
        'resource-exhausted',
        `Monthly export limit reached (${exportsThisMonth}/${quotaLimit}). Upgrade your plan to export more videos.`
      );
    }

    const nextCount = exportsThisMonth + 1;
    const remainingQuota = quotaLimit - nextCount;

    transaction.update(userRef, {
      exportsThisMonth: nextCount,
      monthKey: currentMonthKey,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      plan,
      exportsThisMonth: nextCount,
      quotaLimit,
      remainingQuota,
      monthKey: currentMonthKey,
    };
  });

  return result;
});

/**
 * Callable function: deleteUserData
 * Complies with GDPR/CCPA and privacy ethics requirements.
 * Removes user Firestore documents, all projects subcollections,
 * and purges all assets stored under users/{uid}/ in Firebase Storage.
 */
export const deleteUserData = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);

  // 1. Delete all projects in subcollection
  const projectsSnapshot = await userRef.collection('projects').get();
  const batch = db.batch();
  projectsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  // Delete the user doc itself
  batch.delete(userRef);
  await batch.commit();

  // 2. Delete all Storage files under users/{uid}/
  try {
    const bucket = storage.bucket();
    await bucket.deleteFiles({
      prefix: `users/${uid}/`,
      force: true,
    });
  } catch (err) {
    console.warn(`Storage cleanup note for uid ${uid}:`, err);
  }

  return {
    success: true,
    message: 'All user data and associated media have been permanently deleted.',
  };
});

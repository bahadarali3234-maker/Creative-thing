import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { selectNextIslamicQuotation } from '../shared/islamicQuotations';
import {
  renderScheduledDigestEmail,
  renderWelcomeEmail,
  type RoutineItemPayload,
} from './emailTemplates';

export type EmailFrequency = 'daily' | 'weekly' | 'important_only' | 'unsubscribed';
export type EmailType = 'welcome' | 'daily_update' | 'weekly_digest' | 'daily_routine';

export interface UserEmailPreferenceRecord {
  uid: string;
  email: string;
  displayName: string;
  frequency: EmailFrequency;
  dailyEmailsEnabled: boolean; // opt-in for new accounts (false by default)
  dailyRoutineEnabled: boolean; // opt-in by default
  islamicFooterEnabled: boolean; // enabled by default for new accounts
  preferredSendTime: string; // "08:00"
  focusGoal: string;
  routineItems: RoutineItemPayload[];
  welcomeEmailSentAt: string | null;
  lastDailySentDate: string | null;
  sentQuotationIds: string[];
  unsubscribeToken: string;
  updatedAt: string;
}

export interface EmailDeliveryLogRecord {
  id: string;
  uid: string;
  recipientEmail: string;
  emailType: EmailType;
  idempotencyKey: string;
  quotationId: string | null;
  status: 'sent' | 'failed' | 'skipped';
  providerUsed: 'backend_gmail_oauth' | 'backend_smtp' | 'client_gmail_oauth';
  errorMessage?: string;
  sentAt: string;
}

export interface EmailAutomationQueueJob {
  id: string;
  uid: string;
  emailType: EmailType;
  scheduledFor: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  idempotencyKey: string;
  lastAttemptAt: string | null;
  createdAt: string;
}

interface PersistedEmailStore {
  preferences: Record<string, UserEmailPreferenceRecord>;
  logs: EmailDeliveryLogRecord[];
  queue: EmailAutomationQueueJob[];
}

const DEFAULT_ROUTINE: RoutineItemPayload[] = [
  { id: 'r1', time: '07:00 AM', title: 'Morning Reset & Focus', detail: 'Review top 3 creative or study priorities.' },
  { id: 'r2', time: '09:00 AM', title: 'Deep Work Block', detail: 'Tackle high-impact tasks in Think Creative.' },
  { id: 'r3', time: '01:00 PM', title: 'Midday Recharge', detail: 'Pause, hydrate, and recalibrate priorities.' },
  { id: 'r4', time: '05:00 PM', title: 'Review & Export', detail: 'Organize notes or export PDFs & studio assets.' },
];

const STORE_PATH = path.join(os.tmpdir(), 'think-creative-email-automation-v1.json');

let storeCache: PersistedEmailStore | null = null;
let schedulerStarted = false;

function readStore(): PersistedEmailStore {
  if (storeCache) return storeCache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      storeCache = {
        preferences: parsed?.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : {},
        logs: Array.isArray(parsed?.logs) ? parsed.logs : [],
        queue: Array.isArray(parsed?.queue) ? parsed.queue : [],
      };
      return storeCache;
    }
  } catch {}
  storeCache = { preferences: {}, logs: [], queue: [] };
  return storeCache;
}

function writeStore(next: PersistedEmailStore) {
  storeCache = next;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.warn('[EmailAutomation] Could not persist store:', (err as any)?.message || err);
  }
}

export function getAppBaseUrl(): string {
  const configured = String(process.env.APP_URL || '').trim();
  if (configured && configured !== 'MY_APP_URL' && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/$/, '');
  }
  return `http://localhost:${Number(process.env.PORT) || 3000}`;
}

export function generateUnsubscribeToken(uid: string): string {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.STUDIO_SECRET || 'think-creative-unsub-key';
  return crypto.createHmac('sha256', secret).update(uid).digest('hex').slice(0, 32);
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getOrCreateUserEmailPreferences(params: {
  uid: string;
  email?: string;
  displayName?: string;
}): UserEmailPreferenceRecord {
  const store = readStore();
  const existing = store.preferences[params.uid];
  if (existing) {
    let changed = false;
    if (params.email && !existing.email) {
      existing.email = params.email;
      changed = true;
    }
    if (params.displayName && !existing.displayName) {
      existing.displayName = params.displayName;
      changed = true;
    }
    if (!existing.unsubscribeToken) {
      existing.unsubscribeToken = generateUnsubscribeToken(params.uid);
      changed = true;
    }
    if (changed) {
      existing.updatedAt = new Date().toISOString();
      store.preferences[params.uid] = existing;
      writeStore(store);
    }
    return existing;
  }

  // Confirmed user defaults: Islamic footer ON by default, daily updates opt-in (OFF until opted in)
  const created: UserEmailPreferenceRecord = {
    uid: params.uid,
    email: params.email || '',
    displayName: params.displayName || (params.email ? params.email.split('@')[0] : 'Creator'),
    frequency: 'important_only',
    dailyEmailsEnabled: false,
    dailyRoutineEnabled: false,
    islamicFooterEnabled: true,
    preferredSendTime: '08:00',
    focusGoal: 'Build, learn, and ship meaningful creative work with calm focus',
    routineItems: DEFAULT_ROUTINE,
    welcomeEmailSentAt: null,
    lastDailySentDate: null,
    sentQuotationIds: [],
    unsubscribeToken: generateUnsubscribeToken(params.uid),
    updatedAt: new Date().toISOString(),
  };
  store.preferences[params.uid] = created;
  writeStore(store);
  return created;
}

export function updateUserEmailPreferences(
  uid: string,
  patch: Partial<UserEmailPreferenceRecord> & { email?: string; displayName?: string }
): UserEmailPreferenceRecord {
  const current = getOrCreateUserEmailPreferences({
    uid,
    email: patch.email,
    displayName: patch.displayName,
  });
  const store = readStore();
  const next: UserEmailPreferenceRecord = {
    ...current,
    ...(typeof patch.email === 'string' && patch.email ? { email: patch.email } : {}),
    ...(typeof patch.displayName === 'string' && patch.displayName ? { displayName: patch.displayName } : {}),
    ...(patch.frequency ? { frequency: patch.frequency } : {}),
    ...(typeof patch.dailyEmailsEnabled === 'boolean' ? { dailyEmailsEnabled: patch.dailyEmailsEnabled } : {}),
    ...(typeof patch.dailyRoutineEnabled === 'boolean' ? { dailyRoutineEnabled: patch.dailyRoutineEnabled } : {}),
    ...(typeof patch.islamicFooterEnabled === 'boolean' ? { islamicFooterEnabled: patch.islamicFooterEnabled } : {}),
    ...(typeof patch.preferredSendTime === 'string' && patch.preferredSendTime
      ? { preferredSendTime: patch.preferredSendTime }
      : {}),
    ...(typeof patch.focusGoal === 'string' ? { focusGoal: patch.focusGoal } : {}),
    ...(Array.isArray(patch.routineItems) && patch.routineItems.length > 0
      ? { routineItems: patch.routineItems }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  if (next.frequency === 'daily') {
    next.dailyEmailsEnabled = true;
  } else if (next.frequency === 'unsubscribed') {
    next.dailyEmailsEnabled = false;
    next.dailyRoutineEnabled = false;
  }

  store.preferences[uid] = next;
  writeStore(store);
  return next;
}

export function unsubscribeByToken(token: string): { ok: boolean; email?: string } {
  const store = readStore();
  const match = Object.values(store.preferences).find((p) => p.unsubscribeToken === token);
  if (!match) return { ok: false };
  match.frequency = 'unsubscribed';
  match.dailyEmailsEnabled = false;
  match.dailyRoutineEnabled = false;
  match.updatedAt = new Date().toISOString();
  store.preferences[match.uid] = match;
  writeStore(store);
  return { ok: true, email: match.email };
}

export function getUserEmailLogs(uid: string): EmailDeliveryLogRecord[] {
  const store = readStore();
  return store.logs.filter((l) => l.uid === uid).slice(-30).reverse();
}

function appendDeliveryLog(log: EmailDeliveryLogRecord) {
  const store = readStore();
  store.logs.push(log);
  if (store.logs.length > 500) {
    store.logs = store.logs.slice(-500);
  }
  writeStore(store);
}

function hasIdempotentSuccess(idempotencyKey: string): boolean {
  const store = readStore();
  return store.logs.some((l) => l.idempotencyKey === idempotencyKey && l.status === 'sent');
}

function buildBackendTransportConfig():
  | { kind: 'gmail_oauth'; user: string; clientId: string; clientSecret: string; refreshToken: string }
  | { kind: 'smtp'; host: string; port: number; user: string; pass: string; from: string }
  | null {
  const gmailUser = String(process.env.GMAIL_SENDER_USER || '').trim();
  const clientId = String(process.env.GMAIL_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GMAIL_OAUTH_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GMAIL_OAUTH_REFRESH_TOKEN || '').trim();
  if (gmailUser && clientId && clientSecret && refreshToken) {
    return { kind: 'gmail_oauth', user: gmailUser, clientId, clientSecret, refreshToken };
  }

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  if (smtpHost && smtpUser && smtpPass) {
    return {
      kind: 'smtp',
      host: smtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      user: smtpUser,
      pass: smtpPass,
      from: String(process.env.SMTP_FROM || smtpUser).trim(),
    };
  }

  return null;
}

export function isBackendMailConfigured(): boolean {
  return buildBackendTransportConfig() !== null;
}

async function dispatchViaBackendTransport(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true; provider: 'backend_gmail_oauth' | 'backend_smtp' } | { ok: false; reason: string }> {
  const cfg = buildBackendTransportConfig();
  if (!cfg) {
    return { ok: false, reason: 'NO_BACKEND_CREDENTIALS' };
  }

  try {
    if (cfg.kind === 'gmail_oauth') {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: cfg.user,
          clientId: cfg.clientId,
          clientSecret: cfg.clientSecret,
          refreshToken: cfg.refreshToken,
        },
      });
      await transporter.sendMail({
        from: `Think Creative <${cfg.user}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return { ok: true, provider: 'backend_gmail_oauth' };
    }

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: cfg.from.includes('<') ? cfg.from : `Think Creative <${cfg.from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { ok: true, provider: 'backend_smtp' };
  } catch (err: any) {
    return { ok: false, reason: String(err?.message || err || 'Backend mail transport failed') };
  }
}

export async function prepareAndSendEmail(params: {
  uid: string;
  email: string;
  displayName?: string;
  emailType: EmailType;
  forceResend?: boolean;
  customRoutineItems?: RoutineItemPayload[];
  customFocusGoal?: string;
}): Promise<{
  status: 'sent' | 'already_sent' | 'client_fallback_required' | 'skipped' | 'failed';
  providerUsed?: EmailDeliveryLogRecord['providerUsed'];
  rendered?: { subject: string; html: string; text: string; quotationId: string | null };
  preferences: UserEmailPreferenceRecord;
  error?: string;
}> {
  const prefs = getOrCreateUserEmailPreferences({
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
  });

  if (!prefs.email) {
    return { status: 'skipped', preferences: prefs, error: 'Missing recipient email address.' };
  }

  const today = getTodayIsoDate();
  const idempotencyKey =
    params.emailType === 'welcome'
      ? `welcome:${prefs.uid}`
      : `${params.emailType}:${prefs.uid}:${today}`;

  if (!params.forceResend) {
    if (params.emailType === 'welcome' && (prefs.welcomeEmailSentAt || hasIdempotentSuccess(idempotencyKey))) {
      return { status: 'already_sent', preferences: prefs };
    }
    if (params.emailType !== 'welcome' && hasIdempotentSuccess(idempotencyKey)) {
      return { status: 'already_sent', preferences: prefs };
    }
  }

  // Pick next verified Islamic quotation without repetition if enabled
  let quotation = null;
  let nextSentIds = prefs.sentQuotationIds || [];
  if (prefs.islamicFooterEnabled !== false) {
    const picked = selectNextIslamicQuotation(prefs.sentQuotationIds || []);
    quotation = picked.quotation;
    nextSentIds = picked.nextSentIds;
  }

  const appUrl = getAppBaseUrl();
  const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(prefs.unsubscribeToken)}`;
  const rendered =
    params.emailType === 'welcome'
      ? renderWelcomeEmail({
          userName: params.displayName || prefs.displayName,
          userEmail: prefs.email,
          appUrl,
          unsubscribeUrl,
          quotation,
        })
      : renderScheduledDigestEmail({
          userName: params.displayName || prefs.displayName,
          emailType: params.emailType === 'weekly_digest' ? 'weekly_digest' : 'daily_update',
          routineTime: prefs.preferredSendTime || '08:00',
          focusGoal: params.customFocusGoal || prefs.focusGoal,
          routineItems: params.customRoutineItems || prefs.routineItems,
          appUrl,
          unsubscribeUrl,
          quotation,
        });

  const result = await dispatchViaBackendTransport({
    to: prefs.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  if (result.ok) {
    const nowIso = new Date().toISOString();
    const store = readStore();
    prefs.sentQuotationIds = nextSentIds;
    if (params.emailType === 'welcome') {
      prefs.welcomeEmailSentAt = nowIso;
    } else {
      prefs.lastDailySentDate = today;
    }
    prefs.updatedAt = nowIso;
    store.preferences[prefs.uid] = prefs;
    writeStore(store);

    appendDeliveryLog({
      id: crypto.randomUUID(),
      uid: prefs.uid,
      recipientEmail: prefs.email,
      emailType: params.emailType,
      idempotencyKey,
      quotationId: quotation?.id || null,
      status: 'sent',
      providerUsed: result.provider,
      sentAt: nowIso,
    });

    return {
      status: 'sent',
      providerUsed: result.provider,
      rendered: { ...rendered, quotationId: quotation?.id || null },
      preferences: prefs,
    };
  }

  if (result.reason === 'NO_BACKEND_CREDENTIALS') {
    return {
      status: 'client_fallback_required',
      rendered: { ...rendered, quotationId: quotation?.id || null },
      preferences: prefs,
    };
  }

  appendDeliveryLog({
    id: crypto.randomUUID(),
    uid: prefs.uid,
    recipientEmail: prefs.email,
    emailType: params.emailType,
    idempotencyKey,
    quotationId: quotation?.id || null,
    status: 'failed',
    providerUsed: 'backend_smtp',
    errorMessage: result.reason,
    sentAt: new Date().toISOString(),
  });

  return {
    status: 'failed',
    preferences: prefs,
    error: result.reason,
  };
}

export function recordClientEmailDelivery(params: {
  uid: string;
  email: string;
  emailType: EmailType;
  quotationId?: string | null;
}): UserEmailPreferenceRecord {
  const prefs = getOrCreateUserEmailPreferences({ uid: params.uid, email: params.email });
  const store = readStore();
  const nowIso = new Date().toISOString();
  const today = getTodayIsoDate();
  if (params.quotationId && !prefs.sentQuotationIds.includes(params.quotationId)) {
    prefs.sentQuotationIds = [...prefs.sentQuotationIds, params.quotationId].slice(-15);
  }
  if (params.emailType === 'welcome') {
    prefs.welcomeEmailSentAt = nowIso;
  } else {
    prefs.lastDailySentDate = today;
  }
  prefs.updatedAt = nowIso;
  store.preferences[prefs.uid] = prefs;
  writeStore(store);

  appendDeliveryLog({
    id: crypto.randomUUID(),
    uid: prefs.uid,
    recipientEmail: prefs.email,
    emailType: params.emailType,
    idempotencyKey:
      params.emailType === 'welcome' ? `welcome:${prefs.uid}` : `${params.emailType}:${prefs.uid}:${today}`,
    quotationId: params.quotationId || null,
    status: 'sent',
    providerUsed: 'client_gmail_oauth',
    sentAt: nowIso,
  });

  return prefs;
}

export function startEmailAutomationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const tick = async () => {
    if (!isBackendMailConfigured()) return;
    const store = readStore();
    const today = getTodayIsoDate();
    const nowHourMin = new Date().toISOString().slice(11, 16);

    for (const prefs of Object.values(store.preferences)) {
      if (!prefs.email || prefs.frequency === 'unsubscribed') continue;
      const wantsDaily = prefs.frequency === 'daily' || prefs.dailyEmailsEnabled || prefs.dailyRoutineEnabled;
      const wantsWeekly = prefs.frequency === 'weekly' && new Date().getUTCDay() === 1;
      if (!wantsDaily && !wantsWeekly) continue;
      if (prefs.lastDailySentDate === today) continue;

      const targetTime = prefs.preferredSendTime || '08:00';
      if (nowHourMin < targetTime) continue;

      const emailType: EmailType = wantsWeekly && !wantsDaily ? 'weekly_digest' : 'daily_update';
      await prepareAndSendEmail({
        uid: prefs.uid,
        email: prefs.email,
        displayName: prefs.displayName,
        emailType,
      }).catch(() => {});
    }
  };

  setInterval(() => {
    tick().catch(() => {});
  }, 60 * 1000);
}

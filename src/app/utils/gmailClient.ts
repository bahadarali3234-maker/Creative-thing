import { doc, setDoc } from 'firebase/firestore';
import {
  db,
  getFirebaseIdToken,
  getGoogleAccessToken,
  isFirestoreQuotaBlocked,
  type User,
} from '../firebase';
import { selectNextIslamicQuotation } from '../../shared/islamicQuotations';

export interface DailyRoutineItem {
  id: string;
  time: string;
  title: string;
  detail: string;
}

export type EmailFrequency = 'daily' | 'weekly' | 'important_only' | 'unsubscribed';
export type AutomationEmailType = 'welcome' | 'daily_update' | 'weekly_digest' | 'daily_routine';

export interface GmailRoutinePreferences {
  frequency: EmailFrequency;
  dailyEmailsEnabled: boolean;
  dailyRoutineEnabled: boolean;
  islamicFooterEnabled: boolean;
  preferredSendTime: string;
  routineTime: string;
  focusGoal: string;
  routineItems: DailyRoutineItem[];
  welcomeSentAt?: string | null;
  lastRoutineSentDate?: string | null;
  sentQuotationIds?: string[];
  unsubscribeToken?: string;
}

export interface EmailDeliveryLogEntry {
  id: string;
  uid: string;
  recipientEmail: string;
  emailType: AutomationEmailType;
  idempotencyKey: string;
  quotationId: string | null;
  status: 'sent' | 'failed' | 'skipped';
  providerUsed: 'backend_gmail_oauth' | 'backend_smtp' | 'client_gmail_oauth';
  errorMessage?: string;
  sentAt: string;
}

export const DEFAULT_ROUTINE_ITEMS: DailyRoutineItem[] = [
  { id: 'r1', time: '07:00 AM', title: 'Morning Reset & Focus', detail: 'Hydrate, 15-min walk, review top 3 priorities' },
  { id: 'r2', time: '09:00 AM', title: 'Deep Work Block', detail: 'High-impact creative & engineering tasks in Think Creative' },
  { id: 'r3', time: '01:00 PM', title: 'Midday Recharge', detail: 'Nutritious lunch, screen break, brief planning check-in' },
  { id: 'r4', time: '03:00 PM', title: 'Execution & Reviews', detail: 'Iterate on designs, code reviews, and client updates' },
  { id: 'r5', time: '07:00 PM', title: 'Evening Wind-Down', detail: 'Wrap up notes, prepare tomorrow’s plan, family/fitness time' },
];

export function getTodayDateKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getUserDisplayName(user: User | null | undefined): string {
  if (!user || user.isAnonymous) return '';
  return (user.displayName || user.email?.split('@')[0] || '').trim();
}

export function getUserFirstName(user: User | null | undefined): string {
  const full = getUserDisplayName(user);
  if (!full) return '';
  return full.split(/\s+/)[0];
}

function getPrefsStorageKey(uid?: string | null): string {
  return `think_creative_gmail_routine_v1_${uid || 'guest'}`;
}

function formatTo12Hour(hhmm: string): string {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm || '08:00 AM';
  let h = Number(m[1]);
  const min = m[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${min} ${suffix}`;
}

function formatTo24Hour(timeStr: string): string {
  const s = String(timeStr || '').trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '08:00';
  let h = Number(m[1]);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

export function loadGmailRoutinePrefs(uid?: string | null): GmailRoutinePreferences {
  // New-account defaults: Islamic footer ON by default, daily emails opt-in (OFF until opted in)
  const fallback: GmailRoutinePreferences = {
    frequency: 'important_only',
    dailyEmailsEnabled: false,
    dailyRoutineEnabled: false,
    islamicFooterEnabled: true,
    preferredSendTime: '08:00',
    routineTime: '08:00 AM',
    focusGoal: 'Build, plan, and ship creative work with clarity',
    routineItems: DEFAULT_ROUTINE_ITEMS,
    welcomeSentAt: null,
    lastRoutineSentDate: null,
    sentQuotationIds: [],
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(getPrefsStorageKey(uid));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const preferredSendTime =
      typeof parsed.preferredSendTime === 'string' && parsed.preferredSendTime
        ? parsed.preferredSendTime
        : formatTo24Hour(parsed.routineTime || '08:00 AM');
    return {
      frequency: ['daily', 'weekly', 'important_only', 'unsubscribed'].includes(parsed.frequency)
        ? parsed.frequency
        : parsed.dailyRoutineEnabled
        ? 'daily'
        : 'important_only',
      dailyEmailsEnabled: Boolean(parsed.dailyEmailsEnabled),
      dailyRoutineEnabled: Boolean(parsed.dailyRoutineEnabled),
      islamicFooterEnabled: parsed.islamicFooterEnabled !== false,
      preferredSendTime,
      routineTime:
        typeof parsed.routineTime === 'string' && parsed.routineTime
          ? parsed.routineTime
          : formatTo12Hour(preferredSendTime),
      focusGoal: typeof parsed.focusGoal === 'string' && parsed.focusGoal ? parsed.focusGoal : fallback.focusGoal,
      routineItems: Array.isArray(parsed.routineItems) && parsed.routineItems.length > 0 ? parsed.routineItems : DEFAULT_ROUTINE_ITEMS,
      welcomeSentAt: parsed.welcomeSentAt || null,
      lastRoutineSentDate: parsed.lastRoutineSentDate || null,
      sentQuotationIds: Array.isArray(parsed.sentQuotationIds) ? parsed.sentQuotationIds : [],
      unsubscribeToken: typeof parsed.unsubscribeToken === 'string' ? parsed.unsubscribeToken : undefined,
    };
  } catch {
    return fallback;
  }
}

export function saveGmailRoutinePrefs(uid: string | null | undefined, prefs: GmailRoutinePreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getPrefsStorageKey(uid), JSON.stringify(prefs));
  } catch {}
}

export function buildWelcomeEmailContent(
  userName: string,
  userEmail: string,
  islamicFooterEnabled = true,
  sentQuotationIds: string[] = []
): {
  subject: string;
  bodyText: string;
  quotationId: string | null;
} {
  const friendlyName = userName || userEmail.split('@')[0] || 'Creator';
  const subject = `Welcome to Think Creative, ${friendlyName}!`;
  const quoteInfo = islamicFooterEnabled ? selectNextIslamicQuotation(sentQuotationIds) : null;

  const lines = [
    `Hi ${friendlyName},`,
    '',
    `Welcome to Think Creative! Your workspace account (${userEmail}) is now connected and ready.`,
    '',
    'Here is what you can do right away inside Think Creative:',
    '- Plan Mode: Deep requirement analysis, targeted clarifying questions, and structured plans you can Open, Approve, or Reject.',
    '- Max Mode: Full-effort deep reasoning and comprehensive outputs.',
    '- Chat Mode: Fast everyday conversation tailored personally to you.',
    '- Creative Studio Ultra-Pro V2: Multi-layer visual design editing & hair-preserving background removal.',
    '- Smart PDF Export: Automatically structured MCQs, Study Notes, Q&As, and documents.',
    '- Daily Updates & Routine Briefings: Opt in anytime from Email Automation Preferences.',
  ];

  if (quoteInfo) {
    lines.push(
      '',
      '────────────────────────────────────────',
      'Islamic Reflection',
      ...(quoteInfo.quotation.arabic ? [quoteInfo.quotation.arabic] : []),
      `"${quoteInfo.quotation.translation}"`,
      `— ${quoteInfo.quotation.reference}`
    );
  }

  lines.push('', 'Warm regards,', 'Think Creative Team');

  return {
    subject,
    bodyText: lines.join('\n'),
    quotationId: quoteInfo?.quotation.id || null,
  };
}

export function buildDailyRoutineEmailContent(params: {
  userName: string;
  routineTime: string;
  focusGoal: string;
  routineItems: DailyRoutineItem[];
  islamicFooterEnabled?: boolean;
  sentQuotationIds?: string[];
}): { subject: string; bodyText: string; quotationId: string | null } {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const friendlyName = params.userName || 'Creator';
  const subject = `Your Think Creative Daily Routine — ${today}`;
  const scheduleLines = (params.routineItems || DEFAULT_ROUTINE_ITEMS).map(
    (item) => `• ${item.time} — ${item.title}: ${item.detail}`
  );
  const quoteInfo = params.islamicFooterEnabled !== false
    ? selectNextIslamicQuotation(params.sentQuotationIds || [])
    : null;

  const lines = [
    `Good day ${friendlyName},`,
    '',
    `Here is your personalized Daily Routine from Think Creative for ${today} (preferred briefing time: ${params.routineTime}):`,
    '',
    `Primary Focus Goal: ${params.focusGoal}`,
    '',
    'Today’s Schedule:',
    ...scheduleLines,
    '',
    'Tip: Open Think Creative in Plan Mode anytime to map out today’s biggest milestone step by step.',
  ];

  if (quoteInfo) {
    lines.push(
      '',
      '────────────────────────────────────────',
      'Islamic Reflection',
      ...(quoteInfo.quotation.arabic ? [quoteInfo.quotation.arabic] : []),
      `"${quoteInfo.quotation.translation}"`,
      `— ${quoteInfo.quotation.reference}`
    );
  }

  lines.push('', 'Have a productive day,', 'Think Creative');

  return {
    subject,
    bodyText: lines.join('\n'),
    quotationId: quoteInfo?.quotation.id || null,
  };
}

function utf8ToBase64(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeBase64UrlUtf8(raw: string): string {
  return utf8ToBase64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeRfc2047Subject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
}

export async function sendGmailMessage(params: {
  accessToken: string;
  to: string;
  subject: string;
  bodyText: string;
  htmlBody?: string;
}): Promise<{ id: string; threadId?: string }> {
  let mime: string;

  if (params.htmlBody) {
    const boundary = 'tc_alt_boundary_90210';
    mime = [
      `To: ${params.to}`,
      `Subject: ${encodeRfc2047Subject(params.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      utf8ToBase64(params.bodyText),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      utf8ToBase64(params.htmlBody),
      '',
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    mime = [
      `To: ${params.to}`,
      `Subject: ${encodeRfc2047Subject(params.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      utf8ToBase64(params.bodyText),
    ].join('\r\n');
  }

  const raw = encodeBase64UrlUtf8(mime);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      res.status === 401 || res.status === 403
        ? 'Google Gmail authorization expired or missing send permission. Please reconnect with Google.'
        : `Gmail send failed (${res.status}): ${errText.slice(0, 160)}`
    );
  }

  return (await res.json()) as { id: string; threadId?: string };
}

async function buildApiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getFirebaseIdToken().catch(() => null);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function serverRecordToLocalPrefs(rec: any, existing: GmailRoutinePreferences): GmailRoutinePreferences {
  const preferredSendTime =
    typeof rec?.preferredSendTime === 'string' && rec.preferredSendTime
      ? rec.preferredSendTime
      : existing.preferredSendTime || '08:00';

  return {
    frequency: rec?.frequency || existing.frequency || 'important_only',
    dailyEmailsEnabled:
      typeof rec?.dailyEmailsEnabled === 'boolean' ? rec.dailyEmailsEnabled : existing.dailyEmailsEnabled,
    dailyRoutineEnabled:
      typeof rec?.dailyRoutineEnabled === 'boolean' ? rec.dailyRoutineEnabled : existing.dailyRoutineEnabled,
    islamicFooterEnabled:
      typeof rec?.islamicFooterEnabled === 'boolean' ? rec.islamicFooterEnabled : existing.islamicFooterEnabled,
    preferredSendTime,
    routineTime: formatTo12Hour(preferredSendTime),
    focusGoal: typeof rec?.focusGoal === 'string' && rec.focusGoal ? rec.focusGoal : existing.focusGoal,
    routineItems:
      Array.isArray(rec?.routineItems) && rec.routineItems.length > 0 ? rec.routineItems : existing.routineItems,
    welcomeSentAt: rec?.welcomeEmailSentAt || existing.welcomeSentAt || null,
    lastRoutineSentDate: rec?.lastDailySentDate || existing.lastRoutineSentDate || null,
    sentQuotationIds: Array.isArray(rec?.sentQuotationIds) ? rec.sentQuotationIds : existing.sentQuotationIds || [],
    unsubscribeToken: typeof rec?.unsubscribeToken === 'string' ? rec.unsubscribeToken : existing.unsubscribeToken,
  };
}

async function syncPrefsToFirestore(user: User, prefs: GmailRoutinePreferences): Promise<void> {
  if (!user?.uid || user.isAnonymous || !user.email || isFirestoreQuotaBlocked()) return;
  try {
    await setDoc(
      doc(db, 'user_email_preferences', user.uid),
      {
        userId: user.uid,
        email: user.email,
        frequency: prefs.frequency,
        dailyEmailsEnabled: Boolean(prefs.dailyEmailsEnabled),
        dailyRoutineEnabled: Boolean(prefs.dailyRoutineEnabled),
        islamicFooterEnabled: prefs.islamicFooterEnabled !== false,
        preferredSendTime: prefs.preferredSendTime || '08:00',
        focusGoal: (prefs.focusGoal || '').slice(0, 512),
        sentQuotationIds: (prefs.sentQuotationIds || []).slice(-50),
        welcomeEmailSentAt: prefs.welcomeSentAt || null,
        lastDailySentDate: prefs.lastRoutineSentDate || null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore email preference sync warning:', err);
  }
}

async function syncLogToFirestore(uid: string, entry: {
  recipientEmail: string;
  emailType: AutomationEmailType;
  quotationId?: string | null;
  status: 'sent' | 'failed' | 'skipped';
  providerUsed: string;
}): Promise<void> {
  if (!uid || isFirestoreQuotaBlocked()) return;
  try {
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'email_delivery_logs', id), {
      id,
      userId: uid,
      recipientEmail: entry.recipientEmail.slice(0, 256),
      emailType: entry.emailType,
      quotationId: entry.quotationId || null,
      status: entry.status,
      providerUsed: entry.providerUsed,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore email delivery log warning:', err);
  }
}

export async function fetchEmailPreferences(user: User | null | undefined): Promise<{
  preferences: GmailRoutinePreferences;
  backendMailConfigured: boolean;
}> {
  const local = loadGmailRoutinePrefs(user?.uid);
  if (!user || user.isAnonymous || !user.email) {
    return { preferences: local, backendMailConfigured: false };
  }
  try {
    const headers = await buildApiHeaders();
    const qs = new URLSearchParams({
      uid: user.uid,
      email: user.email,
      displayName: getUserDisplayName(user),
    });
    const res = await fetch(`/api/email/preferences?${qs.toString()}`, { headers });
    if (!res.ok) return { preferences: local, backendMailConfigured: false };
    const data = await res.json();
    const merged = serverRecordToLocalPrefs(data?.preferences, local);
    saveGmailRoutinePrefs(user.uid, merged);
    return {
      preferences: merged,
      backendMailConfigured: Boolean(data?.backendMailConfigured),
    };
  } catch {
    return { preferences: local, backendMailConfigured: false };
  }
}

export async function saveRemoteEmailPreferences(
  user: User | null | undefined,
  nextPrefs: GmailRoutinePreferences
): Promise<{ preferences: GmailRoutinePreferences; backendMailConfigured: boolean }> {
  if (user?.uid) {
    saveGmailRoutinePrefs(user.uid, nextPrefs);
  }
  if (!user || user.isAnonymous || !user.email) {
    return { preferences: nextPrefs, backendMailConfigured: false };
  }

  let merged = nextPrefs;
  let backendMailConfigured = false;
  try {
    const headers = await buildApiHeaders();
    const res = await fetch('/api/email/preferences', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: getUserDisplayName(user),
        frequency: nextPrefs.frequency,
        dailyEmailsEnabled: nextPrefs.dailyEmailsEnabled,
        dailyRoutineEnabled: nextPrefs.dailyRoutineEnabled,
        islamicFooterEnabled: nextPrefs.islamicFooterEnabled,
        preferredSendTime: nextPrefs.preferredSendTime || formatTo24Hour(nextPrefs.routineTime),
        focusGoal: nextPrefs.focusGoal,
        routineItems: nextPrefs.routineItems,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      merged = serverRecordToLocalPrefs(data?.preferences, nextPrefs);
      backendMailConfigured = Boolean(data?.backendMailConfigured);
      saveGmailRoutinePrefs(user.uid, merged);
    }
  } catch {}

  await syncPrefsToFirestore(user, merged);
  return { preferences: merged, backendMailConfigured };
}

export async function triggerWelcomeEmailAutomation(
  user: User | null | undefined,
  options?: { forceResend?: boolean; allowClientOAuthFallback?: boolean }
): Promise<{
  status: 'sent' | 'already_sent' | 'client_fallback_required' | 'skipped' | 'failed';
  providerUsed?: string;
  preferences?: GmailRoutinePreferences;
  rendered?: { subject: string; html: string; text: string; quotationId: string | null };
  error?: string;
}> {
  if (!user || user.isAnonymous || !user.email) {
    return { status: 'skipped', error: 'No verified user email available.' };
  }
  const existing = loadGmailRoutinePrefs(user.uid);
  if (!options?.forceResend && existing.welcomeSentAt) {
    return { status: 'already_sent', preferences: existing };
  }

  try {
    const headers = await buildApiHeaders();
    const res = await fetch('/api/email/trigger-welcome', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: getUserDisplayName(user),
        forceResend: Boolean(options?.forceResend),
      }),
    });
    const data = await res.json();

    if (data?.status === 'sent' || data?.status === 'already_sent') {
      const merged = serverRecordToLocalPrefs(data?.preferences, {
        ...existing,
        welcomeSentAt: data?.preferences?.welcomeEmailSentAt || new Date().toISOString(),
      });
      saveGmailRoutinePrefs(user.uid, merged);
      if (data?.status === 'sent') {
        await syncPrefsToFirestore(user, merged);
        await syncLogToFirestore(user.uid, {
          recipientEmail: user.email,
          emailType: 'welcome',
          quotationId: data?.rendered?.quotationId || null,
          status: 'sent',
          providerUsed: data?.providerUsed || 'backend_smtp',
        });
      }
      return { status: data.status, providerUsed: data.providerUsed, preferences: merged };
    }

    if (data?.status === 'client_fallback_required' && data?.rendered) {
      const token = options?.allowClientOAuthFallback !== false ? getGoogleAccessToken() : null;
      if (token) {
        await sendGmailMessage({
          accessToken: token,
          to: user.email,
          subject: data.rendered.subject,
          bodyText: data.rendered.text,
          htmlBody: data.rendered.html,
        });
        const logRes = await fetch('/api/email/log-client-delivery', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: getUserDisplayName(user),
            emailType: 'welcome',
            quotationId: data.rendered.quotationId || null,
          }),
        }).then((r) => r.json()).catch(() => null);

        const merged = serverRecordToLocalPrefs(logRes?.preferences, {
          ...existing,
          welcomeSentAt: new Date().toISOString(),
        });
        saveGmailRoutinePrefs(user.uid, merged);
        await syncPrefsToFirestore(user, merged);
        await syncLogToFirestore(user.uid, {
          recipientEmail: user.email,
          emailType: 'welcome',
          quotationId: data.rendered.quotationId || null,
          status: 'sent',
          providerUsed: 'client_gmail_oauth',
        });
        return { status: 'sent', providerUsed: 'client_gmail_oauth', preferences: merged };
      }

      return {
        status: 'client_fallback_required',
        rendered: data.rendered,
        preferences: serverRecordToLocalPrefs(data?.preferences, existing),
      };
    }

    return {
      status: data?.status || 'failed',
      error: data?.error || 'Could not dispatch welcome email.',
    };
  } catch (err: any) {
    return { status: 'failed', error: err?.message || 'Welcome email request failed.' };
  }
}

export async function sendScheduledEmailNow(params: {
  user: User;
  emailType: AutomationEmailType;
  focusGoal?: string;
  routineItems?: DailyRoutineItem[];
  overrideSubject?: string;
  overrideBodyText?: string;
  explicitClientToken?: string | null;
}): Promise<{
  status: 'sent' | 'client_fallback_required' | 'failed';
  providerUsed?: string;
  preferences?: GmailRoutinePreferences;
  rendered?: { subject: string; html: string; text: string; quotationId: string | null };
  error?: string;
}> {
  const { user } = params;
  if (!user || user.isAnonymous || !user.email) {
    return { status: 'failed', error: 'Verified user email required.' };
  }
  const existing = loadGmailRoutinePrefs(user.uid);
  const headers = await buildApiHeaders();

  const res = await fetch('/api/email/send-now', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: getUserDisplayName(user),
      emailType: params.emailType,
      focusGoal: params.focusGoal,
      routineItems: params.routineItems,
    }),
  });
  const data = await res.json();

  if (data?.status === 'sent') {
    const merged = serverRecordToLocalPrefs(data?.preferences, existing);
    saveGmailRoutinePrefs(user.uid, merged);
    await syncPrefsToFirestore(user, merged);
    await syncLogToFirestore(user.uid, {
      recipientEmail: user.email,
      emailType: params.emailType,
      quotationId: data?.rendered?.quotationId || null,
      status: 'sent',
      providerUsed: data?.providerUsed || 'backend_smtp',
    });
    return { status: 'sent', providerUsed: data.providerUsed, preferences: merged };
  }

  if (data?.status === 'client_fallback_required' && data?.rendered) {
    const token = params.explicitClientToken || getGoogleAccessToken();
    if (!token) {
      return {
        status: 'client_fallback_required',
        rendered: data.rendered,
        preferences: serverRecordToLocalPrefs(data?.preferences, existing),
      };
    }

    await sendGmailMessage({
      accessToken: token,
      to: user.email,
      subject: params.overrideSubject?.trim() || data.rendered.subject,
      bodyText: params.overrideBodyText?.trim() || data.rendered.text,
      htmlBody: data.rendered.html,
    });

    const logRes = await fetch('/api/email/log-client-delivery', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: getUserDisplayName(user),
        emailType: params.emailType,
        quotationId: data.rendered.quotationId || null,
      }),
    }).then((r) => r.json()).catch(() => null);

    const merged = serverRecordToLocalPrefs(logRes?.preferences, {
      ...existing,
      ...(params.emailType === 'welcome'
        ? { welcomeSentAt: new Date().toISOString() }
        : { lastRoutineSentDate: getTodayDateKey() }),
    });
    saveGmailRoutinePrefs(user.uid, merged);
    await syncPrefsToFirestore(user, merged);
    await syncLogToFirestore(user.uid, {
      recipientEmail: user.email,
      emailType: params.emailType,
      quotationId: data.rendered.quotationId || null,
      status: 'sent',
      providerUsed: 'client_gmail_oauth',
    });
    return { status: 'sent', providerUsed: 'client_gmail_oauth', preferences: merged };
  }

  return {
    status: 'failed',
    error: data?.error || 'Could not send email.',
  };
}

export async function fetchEmailLogs(user: User | null | undefined): Promise<EmailDeliveryLogEntry[]> {
  if (!user || user.isAnonymous || !user.email) return [];
  try {
    const headers = await buildApiHeaders();
    const qs = new URLSearchParams({
      uid: user.uid,
      email: user.email,
    });
    const res = await fetch(`/api/email/logs?${qs.toString()}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.logs) ? data.logs : [];
  } catch {
    return [];
  }
}

import type { User } from '../firebase';

export interface DailyRoutineItem {
  id: string;
  time: string;
  title: string;
  detail: string;
}

export interface GmailRoutinePreferences {
  dailyRoutineEnabled: boolean;
  routineTime: string;
  focusGoal: string;
  routineItems: DailyRoutineItem[];
  welcomeSentAt?: string;
  lastRoutineSentDate?: string;
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

export function loadGmailRoutinePrefs(uid?: string | null): GmailRoutinePreferences {
  const fallback: GmailRoutinePreferences = {
    dailyRoutineEnabled: true,
    routineTime: '08:00 AM',
    focusGoal: 'Build, plan, and ship creative work with clarity',
    routineItems: DEFAULT_ROUTINE_ITEMS,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(getPrefsStorageKey(uid));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      dailyRoutineEnabled: parsed.dailyRoutineEnabled !== false,
      routineTime: typeof parsed.routineTime === 'string' && parsed.routineTime ? parsed.routineTime : fallback.routineTime,
      focusGoal: typeof parsed.focusGoal === 'string' && parsed.focusGoal ? parsed.focusGoal : fallback.focusGoal,
      routineItems: Array.isArray(parsed.routineItems) && parsed.routineItems.length > 0 ? parsed.routineItems : DEFAULT_ROUTINE_ITEMS,
      welcomeSentAt: parsed.welcomeSentAt || undefined,
      lastRoutineSentDate: parsed.lastRoutineSentDate || undefined,
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

export function buildWelcomeEmailContent(userName: string, userEmail: string): {
  subject: string;
  bodyText: string;
} {
  const friendlyName = userName || userEmail.split('@')[0] || 'Creator';
  const subject = `Welcome to Think Creative, ${friendlyName}!`;
  const bodyText = [
    `Hi ${friendlyName},`,
    '',
    `Welcome to Think Creative! Your workspace account (${userEmail}) is now connected and ready.`,
    '',
    'Here is what you can do right away inside Think Creative:',
    '- Plan Mode: Deep requirement analysis, targeted clarifying questions, and structured plans you can Open, Approve, or Reject.',
    '- Max Mode: Full-effort deep reasoning and comprehensive outputs.',
    '- Chat Mode: Fast everyday conversation tailored personally to you.',
    '- Creative Studio & Buildy: Multi-layer visual design editing and interactive UI creation.',
    '- Daily Routine Gmail: Keep your day structured with personalized routine check-ins sent straight to your inbox.',
    '',
    'We are glad to have you here.',
    '',
    'Warm regards,',
    'Think Creative Team',
  ].join('\n');

  return { subject, bodyText };
}

export function buildDailyRoutineEmailContent(params: {
  userName: string;
  routineTime: string;
  focusGoal: string;
  routineItems: DailyRoutineItem[];
}): { subject: string; bodyText: string } {
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

  const bodyText = [
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
    '',
    'Have a productive day,',
    'Think Creative',
  ].join('\n');

  return { subject, bodyText };
}

function encodeBase64UrlUtf8(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeRfc2047Subject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export async function sendGmailMessage(params: {
  accessToken: string;
  to: string;
  subject: string;
  bodyText: string;
}): Promise<{ id: string; threadId?: string }> {
  const mime = [
    `To: ${params.to}`,
    `Subject: ${encodeRfc2047Subject(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(params.bodyText))),
  ].join('\r\n');

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

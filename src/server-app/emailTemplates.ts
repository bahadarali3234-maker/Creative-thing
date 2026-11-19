import { type VerifiedIslamicQuotation } from '../shared/islamicQuotations';

export interface RoutineItemPayload {
  id?: string;
  time: string;
  title: string;
  detail: string;
}

export interface RenderedEmailPayload {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildIslamicFooterHtml(q?: VerifiedIslamicQuotation | null): string {
  if (!q) return '';
  return `
    <tr>
      <td style="padding: 0 28px 20px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F0F9FF;border-left:4px solid #00A6FF;border-radius:8px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0284C7;margin-bottom:6px;">
                Daily Reflection · ${escapeHtml(q.theme)}
              </div>
              ${q.arabic ? `<div dir="rtl" style="font-size:16px;line-height:1.7;color:#0F172A;font-family:'Segoe UI',Tahoma,Arial,sans-serif;margin-bottom:8px;">${escapeHtml(q.arabic)}</div>` : ''}
              <div style="font-size:14px;line-height:1.55;color:#1E293B;font-style:italic;margin-bottom:6px;">
                “${escapeHtml(q.translation)}”
              </div>
              <div style="font-size:12px;font-weight:600;color:#475569;">
                — ${escapeHtml(q.reference)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildIslamicFooterText(q?: VerifiedIslamicQuotation | null): string {
  if (!q) return '';
  return [
    '',
    '----------------------------------------',
    `Daily Reflection (${q.theme})`,
    ...(q.arabic ? [q.arabic] : []),
    `"${q.translation}"`,
    `— ${q.reference}`,
    '----------------------------------------',
  ].join('\n');
}

function wrapThinkCreativeEmailShell(params: {
  preheader: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  quotation?: VerifiedIslamicQuotation | null;
  manageUrl: string;
  unsubscribeUrl: string;
}): string {
  const footerHtml = buildIslamicFooterHtml(params.quotation);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(params.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F1F5F9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0A2A66 0%,#0284C7 65%,#00A6FF 100%);padding:26px 28px;color:#FFFFFF;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#BAE6FD;margin-bottom:6px;">
                ${escapeHtml(params.eyebrow)}
              </div>
              <div style="font-size:22px;font-weight:800;line-height:1.25;letter-spacing:-0.01em;">
                ${escapeHtml(params.heading)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 20px 28px;font-size:15px;line-height:1.65;color:#334155;">
              ${params.bodyHtml}
            </td>
          </tr>
          ${footerHtml}
          <tr>
            <td style="padding:18px 28px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;line-height:1.5;color:#64748B;">
              <div>Sent with care by <strong>Think Creative</strong>.</div>
              <div style="margin-top:6px;">
                <a href="${escapeHtml(params.manageUrl)}" style="color:#0284C7;text-decoration:underline;">Manage Email Preferences</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;">Unsubscribe</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderWelcomeEmail(params: {
  userName: string;
  userEmail: string;
  appUrl: string;
  unsubscribeUrl: string;
  quotation?: VerifiedIslamicQuotation | null;
}): RenderedEmailPayload {
  const friendlyName = escapeHtml(params.userName || params.userEmail.split('@')[0] || 'Creator');
  const rawName = params.userName || params.userEmail.split('@')[0] || 'Creator';
  const subject = `Welcome to Think Creative, ${rawName}!`;
  const manageUrl = `${params.appUrl.replace(/\/$/, '')}/?panel=email-preferences`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Assalamu Alaikum &amp; welcome, <strong>${friendlyName}</strong>,</p>
    <p style="margin:0 0 16px 0;">Your Think Creative workspace account (<strong>${escapeHtml(params.userEmail)}</strong>) is verified and ready.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;margin:0 0 18px 0;">
      <tr>
        <td style="padding:16px 18px;font-size:14px;line-height:1.6;color:#1E293B;">
          <div style="font-weight:700;color:#0A2A66;margin-bottom:8px;">What you can start right away:</div>
          <ul style="margin:0;padding-left:18px;">
            <li style="margin-bottom:6px;"><strong>Ultra-Pro AI Image Studio V2:</strong> Precision hair-preserving background cutouts, portraits, and editable multi-layer compositions.</li>
            <li style="margin-bottom:6px;"><strong>Plan, Max &amp; Chat Modes:</strong> Deep research plans you can inspect and approve, maximum-effort analysis, or fast daily help.</li>
            <li style="margin-bottom:6px;"><strong>Smart PDF Exporter:</strong> Turn study notes, MCQs, or answers into crisp A4/Letter vector PDFs without raw UI clutter.</li>
            <li style="margin-bottom:0;"><strong>Personalized Updates:</strong> Customize daily routines, creative tips, and your Islamic footer inside Email Settings anytime.</li>
          </ul>
        </td>
      </tr>
    </table>
    <p style="margin:0;">
      <a href="${escapeHtml(params.appUrl)}" style="display:inline-block;background-color:#00A6FF;color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none;padding:11px 22px;border-radius:10px;">
        Open Think Creative Workspace
      </a>
    </p>`;

  const html = wrapThinkCreativeEmailShell({
    preheader: `Welcome ${rawName} — your Think Creative workspace is ready.`,
    eyebrow: 'THINK CREATIVE · WELCOME',
    heading: `Welcome aboard, ${rawName}`,
    bodyHtml,
    quotation: params.quotation,
    manageUrl,
    unsubscribeUrl: params.unsubscribeUrl,
  });

  const text = [
    `Hi ${rawName},`,
    '',
    `Welcome to Think Creative! Your workspace account (${params.userEmail}) is active and ready.`,
    '',
    'Highlights waiting for you:',
    '- Ultra-Pro AI Image Studio V2: Precision cutouts, portraits, and multi-layer design editing.',
    '- Plan, Max & Chat Modes: Tailored AI workflows for deep work or quick questions.',
    '- Smart PDF Exporter: Clean MCQ sheets, study notes, and Q&A vector PDFs.',
    '- Daily & Weekly Updates: Manage your schedule and Islamic reflection footer anytime.',
    '',
    `Open workspace: ${params.appUrl}`,
    `Manage preferences: ${manageUrl}`,
    `Unsubscribe: ${params.unsubscribeUrl}`,
    buildIslamicFooterText(params.quotation),
  ].join('\n');

  return { subject, html, text };
}

export function renderScheduledDigestEmail(params: {
  userName: string;
  emailType: 'daily_update' | 'weekly_digest' | 'daily_routine';
  routineTime: string;
  focusGoal: string;
  routineItems: RoutineItemPayload[];
  appUrl: string;
  unsubscribeUrl: string;
  quotation?: VerifiedIslamicQuotation | null;
}): RenderedEmailPayload {
  const rawName = params.userName || 'Creator';
  const friendlyName = escapeHtml(rawName);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const manageUrl = `${params.appUrl.replace(/\/$/, '')}/?panel=email-preferences`;

  const items = Array.isArray(params.routineItems) && params.routineItems.length > 0
    ? params.routineItems
    : [
        { time: '08:00 AM', title: 'Morning Clarity', detail: 'Outline top 3 creative or study priorities.' },
        { time: '10:00 AM', title: 'Deep Focus Session', detail: 'Use Plan Mode or Max Mode for your hardest deliverable.' },
        { time: '04:00 PM', title: 'Export & Review', detail: 'Save structured PDF study notes or export studio visuals.' },
      ];

  const isWeekly = params.emailType === 'weekly_digest';
  const subject = isWeekly
    ? `Think Creative Weekly Brief — ${today}`
    : `Your Think Creative Daily Brief — ${today}`;

  const rowsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#0284C7;white-space:nowrap;vertical-align:top;">
          ${escapeHtml(item.time)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#1E293B;">
          <div style="font-weight:700;color:#0F172A;">${escapeHtml(item.title)}</div>
          <div style="font-size:13px;color:#475569;margin-top:2px;">${escapeHtml(item.detail)}</div>
        </td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">Good day, <strong>${friendlyName}</strong>,</p>
    <p style="margin:0 0 16px 0;">
      Here is your ${isWeekly ? 'weekly creative & study digest' : 'daily focus brief'} for <strong>${escapeHtml(today)}</strong>
      ${params.routineTime ? `(scheduled window: ${escapeHtml(params.routineTime)})` : ''}.
    </p>
    <div style="background-color:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:12px 16px;margin-bottom:18px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0369A1;">Primary Focus Goal</div>
      <div style="font-size:15px;font-weight:700;color:#0A2A66;margin-top:4px;">${escapeHtml(params.focusGoal || 'Ship meaningful creative work with calm focus')}</div>
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:18px;">
      ${rowsHtml}
    </table>
    <p style="margin:0;font-size:13px;color:#475569;">
      Quick AI tip: Try exporting long study sessions using <strong>Smart PDF Export</strong> with Code Filtering enabled for clean exam-ready notes.
    </p>`;

  const html = wrapThinkCreativeEmailShell({
    preheader: `${params.focusGoal || 'Your Think Creative focus briefing'} — ${today}`,
    eyebrow: isWeekly ? 'THINK CREATIVE · WEEKLY BRIEF' : 'THINK CREATIVE · DAILY BRIEF',
    heading: isWeekly ? 'Weekly Creative Digest' : 'Daily Focus & Routine',
    bodyHtml,
    quotation: params.quotation,
    manageUrl,
    unsubscribeUrl: params.unsubscribeUrl,
  });

  const text = [
    `Good day ${rawName},`,
    '',
    `Think Creative ${isWeekly ? 'Weekly' : 'Daily'} Briefing — ${today}`,
    `Focus Goal: ${params.focusGoal || 'Ship meaningful creative work with calm focus'}`,
    '',
    ...items.map((it) => `• ${it.time} — ${it.title}: ${it.detail}`),
    '',
    `Open Think Creative: ${params.appUrl}`,
    `Manage preferences: ${manageUrl}`,
    `Unsubscribe: ${params.unsubscribeUrl}`,
    buildIslamicFooterText(params.quotation),
  ].join('\n');

  return { subject, html, text };
}

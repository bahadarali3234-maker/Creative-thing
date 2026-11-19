import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  X,
  CheckCircle2,
  Send,
  CalendarClock,
  Sparkles,
  Loader2,
  UserCheck,
  AlertCircle,
  Plus,
  Trash2,
  BookOpen,
  History,
  Save,
} from 'lucide-react';
import {
  getCurrentUser,
  getGoogleAccessToken,
  connectGoogleGmailPermissions,
  subscribeToAuth,
  type User,
} from '../firebase';
import {
  buildDailyRoutineEmailContent,
  buildWelcomeEmailContent,
  fetchEmailLogs,
  fetchEmailPreferences,
  getUserDisplayName,
  loadGmailRoutinePrefs,
  saveRemoteEmailPreferences,
  sendScheduledEmailNow,
  triggerWelcomeEmailAutomation,
  type DailyRoutineItem,
  type EmailDeliveryLogEntry,
  type EmailFrequency,
  type GmailRoutinePreferences,
} from '../utils/gmailClient';
import { selectNextIslamicQuotation } from '../../shared/islamicQuotations';

export interface GmailRoutineModalProps {
  isOpen: boolean;
  initialTab?: 'welcome' | 'routine' | 'logs';
  onClose: () => void;
  onOpenLogin?: () => void;
}

const FREQUENCY_OPTIONS: { value: EmailFrequency; label: string; hint: string }[] = [
  { value: 'daily', label: 'Daily', hint: 'Receive daily routine & creative updates' },
  { value: 'weekly', label: 'Weekly', hint: 'Weekly curated digest every Monday' },
  { value: 'important_only', label: 'Important Updates Only', hint: 'Welcome & essential workspace alerts' },
  { value: 'unsubscribed', label: 'Unsubscribed', hint: 'Pause all scheduled emails' },
];

export const GmailRoutineModal: React.FC<GmailRoutineModalProps> = ({
  isOpen,
  initialTab = 'welcome',
  onClose,
  onOpenLogin,
}) => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [activeTab, setActiveTab] = useState<'welcome' | 'routine' | 'logs'>(initialTab);
  const [prefs, setPrefs] = useState<GmailRoutinePreferences>(() =>
    loadGmailRoutinePrefs(getCurrentUser()?.uid)
  );
  const [backendMailConfigured, setBackendMailConfigured] = useState(false);
  const [logs, setLogs] = useState<EmailDeliveryLogEntry[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [sendingKind, setSendingKind] = useState<'welcome' | 'routine' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getGoogleAccessToken()));

  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');

  const syncRemoteState = async (u: User | null) => {
    if (!u || u.isAnonymous || !u.email) return;
    setLoadingRemote(true);
    try {
      const [prefRes, logRes] = await Promise.all([
        fetchEmailPreferences(u),
        fetchEmailLogs(u),
      ]);
      setPrefs(prefRes.preferences);
      setBackendMailConfigured(prefRes.backendMailConfigured);
      setLogs(logRes);
    } finally {
      setLoadingRemote(false);
    }
  };

  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u);
      setHasToken(Boolean(getGoogleAccessToken()));
      if (u?.uid) {
        setPrefs(loadGmailRoutinePrefs(u.uid));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setStatusMessage(null);
    const current = getCurrentUser();
    setUser(current);
    setHasToken(Boolean(getGoogleAccessToken()));
    if (current?.uid) {
      setPrefs(loadGmailRoutinePrefs(current.uid));
      syncRemoteState(current);
    }
  }, [isOpen, initialTab]);

  const userName = getUserDisplayName(user);
  const userEmail = user?.email || '';

  const previewQuotation = useMemo(
    () => (prefs.islamicFooterEnabled ? selectNextIslamicQuotation(prefs.sentQuotationIds || []).quotation : null),
    [prefs.islamicFooterEnabled, prefs.sentQuotationIds]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'welcome') {
      const { subject, bodyText } = buildWelcomeEmailContent(
        userName,
        userEmail,
        prefs.islamicFooterEnabled,
        prefs.sentQuotationIds || []
      );
      setCustomSubject(subject);
      setCustomBody(bodyText);
    } else if (activeTab === 'routine') {
      const { subject, bodyText } = buildDailyRoutineEmailContent({
        userName,
        routineTime: prefs.routineTime,
        focusGoal: prefs.focusGoal,
        routineItems: prefs.routineItems,
        islamicFooterEnabled: prefs.islamicFooterEnabled,
        sentQuotationIds: prefs.sentQuotationIds || [],
      });
      setCustomSubject(subject);
      setCustomBody(bodyText);
    }
  }, [
    isOpen,
    activeTab,
    userName,
    userEmail,
    prefs.routineTime,
    prefs.focusGoal,
    prefs.routineItems,
    prefs.islamicFooterEnabled,
    prefs.sentQuotationIds,
  ]);

  if (!isOpen) return null;

  const isSignedIn = Boolean(user && !user.isAnonymous && userEmail);

  const handleSavePrefs = async (next: GmailRoutinePreferences, explicitSave = false) => {
    setPrefs(next);
    if (explicitSave) setSavingPrefs(true);
    try {
      const res = await saveRemoteEmailPreferences(user, next);
      setPrefs(res.preferences);
      setBackendMailConfigured(res.backendMailConfigured);
      if (explicitSave) {
        setStatusMessage({ type: 'success', text: 'Email & Islamic footer preferences saved.' });
      }
    } finally {
      if (explicitSave) setSavingPrefs(false);
    }
  };

  const handleAuthorizeGoogle = async (): Promise<string | null> => {
    setStatusMessage(null);
    const res = await connectGoogleGmailPermissions();
    if (!res.success || !res.accessToken) {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Could not obtain Gmail send authorization.',
      });
      return null;
    }
    setHasToken(true);
    if (res.user) setUser(res.user);
    return res.accessToken;
  };

  const handleConfirmSend = async (kind: 'welcome' | 'routine') => {
    if (!isSignedIn || !user || !userEmail) {
      onOpenLogin?.();
      return;
    }

    setSendingKind(kind);
    setStatusMessage(null);

    try {
      // Save current routine settings first so backend uses up-to-date routine/footer state
      await saveRemoteEmailPreferences(user, prefs);

      if (kind === 'welcome') {
        const res = await triggerWelcomeEmailAutomation(user, {
          forceResend: true,
          allowClientOAuthFallback: true,
        });
        if (res.status === 'client_fallback_required') {
          const token = await handleAuthorizeGoogle();
          if (!token) return;
          const retry = await sendScheduledEmailNow({
            user,
            emailType: 'welcome',
            overrideSubject: customSubject,
            overrideBodyText: customBody,
            explicitClientToken: token,
          });
          if (retry.status === 'sent') {
            if (retry.preferences) setPrefs(retry.preferences);
            setStatusMessage({ type: 'success', text: `Welcome email sent to ${userEmail}.` });
            syncRemoteState(user);
          } else {
            setStatusMessage({ type: 'error', text: retry.error || 'Could not send welcome email.' });
          }
          return;
        }
        if (res.status === 'sent') {
          if (res.preferences) setPrefs(res.preferences);
          setStatusMessage({
            type: 'success',
            text: `Welcome email delivered to ${userEmail} (${res.providerUsed || 'mailer'}).`,
          });
          syncRemoteState(user);
        } else {
          setStatusMessage({ type: 'error', text: res.error || 'Could not send welcome email.' });
        }
        return;
      }

      const emailType = prefs.frequency === 'weekly' ? 'weekly_digest' : 'daily_update';
      let res = await sendScheduledEmailNow({
        user,
        emailType,
        focusGoal: prefs.focusGoal,
        routineItems: prefs.routineItems,
        overrideSubject: customSubject,
        overrideBodyText: customBody,
      });

      if (res.status === 'client_fallback_required') {
        const token = await handleAuthorizeGoogle();
        if (!token) return;
        res = await sendScheduledEmailNow({
          user,
          emailType,
          focusGoal: prefs.focusGoal,
          routineItems: prefs.routineItems,
          overrideSubject: customSubject,
          overrideBodyText: customBody,
          explicitClientToken: token,
        });
      }

      if (res.status === 'sent') {
        if (res.preferences) setPrefs(res.preferences);
        setStatusMessage({
          type: 'success',
          text: `Daily routine email delivered to ${userEmail} (${res.providerUsed || 'mailer'}).`,
        });
        syncRemoteState(user);
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Could not deliver scheduled email.' });
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not send Gmail message.';
      if (/expired|permission/i.test(msg)) setHasToken(false);
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSendingKind(null);
    }
  };

  const handleUpdateRoutineItem = (idx: number, field: keyof DailyRoutineItem, value: string) => {
    const nextItems = prefs.routineItems.map((item, i) => (i === idx ? { ...item, [field]: value } : item));
    setPrefs((prev) => ({ ...prev, routineItems: nextItems }));
  };

  const handleAddRoutineItem = () => {
    const nextItems: DailyRoutineItem[] = [
      ...prefs.routineItems,
      {
        id: `r-${Date.now()}`,
        time: '05:00 PM',
        title: 'Custom Focus Block',
        detail: 'Creative review & next-day prep',
      },
    ];
    handleSavePrefs({ ...prefs, routineItems: nextItems });
  };

  const handleRemoveRoutineItem = (idx: number) => {
    if (prefs.routineItems.length <= 1) return;
    handleSavePrefs({
      ...prefs,
      routineItems: prefs.routineItems.filter((_, i) => i !== idx),
    });
  };

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[20050] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[600px] max-h-[92vh] rounded-[24px] bg-[#0c1018] border border-[#00a6ff]/35 text-white shadow-[0_24px_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00a6ff]/15 border border-[#00a6ff]/40 flex items-center justify-center text-[#38bdf8]">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Think Creative · Email Automation</h3>
                <p className="text-[11px] text-zinc-400">
                  Welcome emails, scheduled updates &amp; verified Islamic reflections
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Account Profile Strip */}
          <div className="px-5 py-3 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
            {isSignedIn ? (
              <div className="flex items-center gap-2.5 min-w-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={userName} className="w-8 h-8 rounded-lg object-cover border border-[#00a6ff]/50" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#00a6ff]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold">
                    {userName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                    <span>{userName}</span>
                    <UserCheck size={12} className="text-emerald-400 shrink-0" />
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">{userEmail}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-300">Sign in to manage automated welcome &amp; daily emails.</div>
            )}

            {!isSignedIn ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLogin?.();
                }}
                className="h-10 px-4 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] text-white text-xs font-bold cursor-pointer shrink-0 whitespace-nowrap"
              >
                Sign In
              </button>
            ) : backendMailConfigured ? (
              <span className="text-[11px] font-semibold text-emerald-300 shrink-0 whitespace-nowrap">
                Auto Mailer Active
              </span>
            ) : !hasToken ? (
              <button
                type="button"
                onClick={handleAuthorizeGoogle}
                className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-[#00a6ff]/40 text-[#38bdf8] text-[11px] font-bold cursor-pointer shrink-0 whitespace-nowrap"
              >
                Connect Gmail OAuth
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-300 shrink-0 whitespace-nowrap">
                Gmail OAuth Ready
              </span>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="px-5 pt-3 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('welcome');
                setStatusMessage(null);
              }}
              className={`flex-1 h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'welcome'
                  ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-[#38bdf8]'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} />
              <span>Welcome</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('routine');
                setStatusMessage(null);
              }}
              className={`flex-1 h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'routine'
                  ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-[#38bdf8]'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <CalendarClock size={14} />
              <span>Routine &amp; Footer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('logs');
                setStatusMessage(null);
                if (user) syncRemoteState(user);
              }}
              className={`flex-1 h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-[#38bdf8]'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <History size={14} />
              <span className="tabular-nums">Delivery Logs ({logs.length})</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {statusMessage && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
                    : 'bg-red-500/15 border-red-500/35 text-red-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle size={15} className="shrink-0 text-red-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {activeTab === 'routine' && (
              <div className="space-y-3.5">
                {/* Frequency & Opt-In Panel */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Delivery Cadence &amp; Subscriptions
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          handleSavePrefs({
                            ...prefs,
                            frequency: opt.value,
                            dailyEmailsEnabled: opt.value === 'daily' ? true : opt.value === 'unsubscribed' ? false : prefs.dailyEmailsEnabled,
                            dailyRoutineEnabled: opt.value === 'daily' ? true : opt.value === 'unsubscribed' ? false : prefs.dailyRoutineEnabled,
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          prefs.frequency === opt.value
                            ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-white'
                            : 'bg-black/30 border-white/10 text-zinc-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{opt.hint}</div>
                      </button>
                    ))}
                  </div>

                  {/* Daily Opt-in Toggle */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div>
                      <div className="text-xs font-bold text-white">Enable Daily Routine Emails</div>
                      <div className="text-[11px] text-zinc-400">
                        Opt-in automated daily creative &amp; schedule briefing
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleSavePrefs({
                          ...prefs,
                          dailyEmailsEnabled: !prefs.dailyEmailsEnabled,
                          dailyRoutineEnabled: !prefs.dailyEmailsEnabled,
                          frequency: !prefs.dailyEmailsEnabled ? 'daily' : 'important_only',
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        prefs.dailyEmailsEnabled || prefs.dailyRoutineEnabled ? 'bg-[#00a6ff]' : 'bg-zinc-700'
                      }`}
                      role="switch"
                      aria-checked={prefs.dailyEmailsEnabled || prefs.dailyRoutineEnabled}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                          prefs.dailyEmailsEnabled || prefs.dailyRoutineEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Islamic Footer Toggle */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <BookOpen size={13} className="text-[#38bdf8]" />
                        <span>Islamic Inspirational Footer</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Includes a verified Qur’an ayah or Sahih Hadith with exact citation
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleSavePrefs({
                          ...prefs,
                          islamicFooterEnabled: !prefs.islamicFooterEnabled,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        prefs.islamicFooterEnabled ? 'bg-[#00a6ff]' : 'bg-zinc-700'
                      }`}
                      role="switch"
                      aria-checked={prefs.islamicFooterEnabled}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                          prefs.islamicFooterEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {previewQuotation && (
                    <div className="p-3 rounded-xl bg-[#00a6ff]/10 border border-[#00a6ff]/25 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#38bdf8]">
                        Next Verified Citation Preview · {previewQuotation.theme}
                      </div>
                      {previewQuotation.arabic && (
                        <div dir="rtl" className="text-sm text-white/95 font-medium leading-relaxed text-right">
                          {previewQuotation.arabic}
                        </div>
                      )}
                      <div className="text-xs text-zinc-200 italic">&ldquo;{previewQuotation.translation}&rdquo;</div>
                      <div className="text-[11px] text-zinc-400 font-semibold">— {previewQuotation.reference}</div>
                    </div>
                  )}
                </div>

                {/* Time & Routine Schedule Editor */}
                <div className="space-y-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                        Preferred Send Time (UTC)
                      </label>
                      <input
                        type="time"
                        value={prefs.preferredSendTime || '08:00'}
                        onChange={(e) => {
                          const v = e.target.value || '08:00';
                          setPrefs((prev) => ({
                            ...prev,
                            preferredSendTime: v,
                            routineTime: v,
                          }));
                        }}
                        className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                        Daily Focus Goal
                      </label>
                      <input
                        type="text"
                        value={prefs.focusGoal}
                        onChange={(e) => setPrefs((prev) => ({ ...prev, focusGoal: e.target.value }))}
                        className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Routine Blocks
                      </span>
                      <button
                        type="button"
                        onClick={handleAddRoutineItem}
                        className="text-[11px] font-semibold text-[#38bdf8] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add block
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {prefs.routineItems.map((item, idx) => (
                        <div key={item.id} className="grid grid-cols-[84px_1fr_auto] gap-1.5 items-center">
                          <input
                            type="text"
                            value={item.time}
                            onChange={(e) => handleUpdateRoutineItem(idx, 'time', e.target.value)}
                            className="px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white tabular-nums"
                          />
                          <input
                            type="text"
                            value={`${item.title}: ${item.detail}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              const colonIdx = val.indexOf(':');
                              if (colonIdx !== -1) {
                                const nextItems = prefs.routineItems.map((it, i) =>
                                  i === idx
                                    ? { ...it, title: val.slice(0, colonIdx).trim(), detail: val.slice(colonIdx + 1).trim() }
                                    : it
                                );
                                setPrefs((prev) => ({ ...prev, routineItems: nextItems }));
                              } else {
                                handleUpdateRoutineItem(idx, 'title', val);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveRoutineItem(idx)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Remove block"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Email Automation Audit Trail
                  </div>
                  {loadingRemote && <Loader2 size={14} className="animate-spin text-[#38bdf8]" />}
                </div>
                {logs.length === 0 ? (
                  <div className="p-6 rounded-xl bg-white/[0.03] border border-white/10 text-center text-xs text-zinc-400">
                    No automated deliveries logged yet for this session.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span className="uppercase">{log.emailType.replace('_', ' ')}</span>
                            <span className="text-[10px] font-normal text-zinc-400 tabular-nums">
                              {new Date(log.sentAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {log.recipientEmail} · {log.providerUsed}
                            {log.quotationId ? ` · Quote: ${log.quotationId}` : ''}
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-bold uppercase shrink-0 ${
                            log.status === 'sent' ? 'text-emerald-400' : 'text-amber-300'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Welcome & Routine Preview */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Email Preview
                  </div>
                  {prefs.welcomeSentAt && activeTab === 'welcome' && (
                    <span className="text-[11px] text-emerald-400 font-semibold tabular-nums">
                      Welcome delivered {new Date(prefs.welcomeSentAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs flex items-center gap-2">
                  <span className="text-zinc-400 font-semibold">To:</span>
                  <span className="text-white truncate">{userEmail || 'Sign in first'}</span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Message Body
                  </label>
                  <textarea
                    rows={6}
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-zinc-100 leading-relaxed focus:outline-none focus:border-[#00a6ff] resize-y"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-4 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer whitespace-nowrap"
            >
              Close
            </button>

            <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
              {activeTab === 'routine' && (
                <button
                  type="button"
                  disabled={savingPrefs || !isSignedIn}
                  onClick={() => handleSavePrefs(prefs, true)}
                  className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {savingPrefs ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Settings</span>
                </button>
              )}

              {activeTab !== 'logs' && (
                <button
                  type="button"
                  disabled={sendingKind !== null || !isSignedIn}
                  onClick={() => handleConfirmSend(activeTab)}
                  className="h-10 px-5 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] disabled:opacity-45 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(0,166,255,0.4)] whitespace-nowrap"
                >
                  {sendingKind !== null ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Delivering...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>
                        {activeTab === 'welcome' ? 'Send Welcome Email' : 'Send Routine Now'}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

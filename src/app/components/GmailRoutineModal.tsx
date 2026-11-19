import React, { useEffect, useState } from 'react';
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
  getTodayDateKey,
  getUserDisplayName,
  loadGmailRoutinePrefs,
  saveGmailRoutinePrefs,
  sendGmailMessage,
  type DailyRoutineItem,
  type GmailRoutinePreferences,
} from '../utils/gmailClient';

export interface GmailRoutineModalProps {
  isOpen: boolean;
  initialTab?: 'welcome' | 'routine';
  onClose: () => void;
  onOpenLogin?: () => void;
}

export const GmailRoutineModal: React.FC<GmailRoutineModalProps> = ({
  isOpen,
  initialTab = 'welcome',
  onClose,
  onOpenLogin,
}) => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [activeTab, setActiveTab] = useState<'welcome' | 'routine'>(initialTab);
  const [prefs, setPrefs] = useState<GmailRoutinePreferences>(() =>
    loadGmailRoutinePrefs(getCurrentUser()?.uid)
  );

  const [sendingKind, setSendingKind] = useState<'welcome' | 'routine' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getGoogleAccessToken()));

  // Editable preview overrides
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');

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
    }
  }, [isOpen, initialTab]);

  const userName = getUserDisplayName(user);
  const userEmail = user?.email || '';

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'welcome') {
      const { subject, bodyText } = buildWelcomeEmailContent(userName, userEmail);
      setCustomSubject(subject);
      setCustomBody(bodyText);
    } else {
      const { subject, bodyText } = buildDailyRoutineEmailContent({
        userName,
        routineTime: prefs.routineTime,
        focusGoal: prefs.focusGoal,
        routineItems: prefs.routineItems,
      });
      setCustomSubject(subject);
      setCustomBody(bodyText);
    }
  }, [isOpen, activeTab, userName, userEmail, prefs.routineTime, prefs.focusGoal, prefs.routineItems]);

  if (!isOpen) return null;

  const isSignedIn = Boolean(user && !user.isAnonymous && userEmail);

  const handleSavePrefs = (next: GmailRoutinePreferences) => {
    setPrefs(next);
    if (user?.uid) {
      saveGmailRoutinePrefs(user.uid, next);
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
    if (!isSignedIn || !userEmail) {
      onOpenLogin?.();
      return;
    }

    setSendingKind(kind);
    setStatusMessage(null);

    try {
      let token = getGoogleAccessToken();
      if (!token) {
        token = await handleAuthorizeGoogle();
      }
      if (!token) {
        setSendingKind(null);
        return;
      }

      await sendGmailMessage({
        accessToken: token,
        to: userEmail,
        subject: customSubject.trim() || (kind === 'welcome' ? 'Welcome to Think Creative!' : 'Your Think Creative Daily Routine'),
        bodyText: customBody,
      });

      const updatedPrefs: GmailRoutinePreferences = {
        ...prefs,
        ...(kind === 'welcome' ? { welcomeSentAt: new Date().toISOString() } : { lastRoutineSentDate: getTodayDateKey() }),
      };
      handleSavePrefs(updatedPrefs);

      setStatusMessage({
        type: 'success',
        text:
          kind === 'welcome'
            ? `Welcome Gmail sent to ${userEmail}!`
            : `Daily Routine Gmail sent to ${userEmail}!`,
      });
    } catch (err: any) {
      const msg = err?.message || 'Could not send Gmail message.';
      if (/expired|permission/i.test(msg)) {
        setHasToken(false);
      }
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSendingKind(null);
    }
  };

  const handleUpdateRoutineItem = (idx: number, field: keyof DailyRoutineItem, value: string) => {
    const nextItems = prefs.routineItems.map((item, i) => (i === idx ? { ...item, [field]: value } : item));
    handleSavePrefs({ ...prefs, routineItems: nextItems });
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
          className="relative w-full max-w-[560px] max-h-[90vh] rounded-[28px] bg-[#0c1018] border border-[#00a6ff]/35 text-white shadow-[0_24px_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00a6ff]/15 border border-[#00a6ff]/40 flex items-center justify-center text-[#38bdf8]">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Think Creative · Gmail</h3>
                <p className="text-[11px] text-zinc-400">
                  Welcome Email &amp; Personalized Daily Routine
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
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
                  <img src={user.photoURL} alt={userName} className="w-8 h-8 rounded-full object-cover border border-[#00a6ff]/50" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#00a6ff]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold">
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
              <div className="text-xs text-zinc-300">Sign in with Google to personalize &amp; send Gmail updates.</div>
            )}

            {!isSignedIn ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLogin?.();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Sign In
              </button>
            ) : !hasToken ? (
              <button
                type="button"
                onClick={handleAuthorizeGoogle}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-[#00a6ff]/50 text-[#38bdf8] text-[11px] font-bold cursor-pointer shrink-0"
              >
                Connect Gmail
              </button>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold shrink-0">
                Gmail Ready
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
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                activeTab === 'welcome'
                  ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-[#38bdf8]'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} />
              <span>Welcome Gmail</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('routine');
                setStatusMessage(null);
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                activeTab === 'routine'
                  ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-[#38bdf8]'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <CalendarClock size={14} />
              <span>Daily Routine Gmail</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {statusMessage && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-center gap-2 ${
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
              <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white">Daily Routine Reminders</div>
                    <div className="text-[11px] text-zinc-400">Prompt me daily to send my Think Creative routine</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSavePrefs({ ...prefs, dailyRoutineEnabled: !prefs.dailyRoutineEnabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      prefs.dailyRoutineEnabled ? 'bg-[#00a6ff]' : 'bg-zinc-700'
                    }`}
                    role="switch"
                    aria-checked={prefs.dailyRoutineEnabled}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                        prefs.dailyRoutineEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Preferred Time
                    </label>
                    <input
                      type="text"
                      value={prefs.routineTime}
                      onChange={(e) => handleSavePrefs({ ...prefs, routineTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Daily Focus Goal
                    </label>
                    <input
                      type="text"
                      value={prefs.focusGoal}
                      onChange={(e) => handleSavePrefs({ ...prefs, focusGoal: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff]"
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
                          className="px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white"
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
                              handleSavePrefs({ ...prefs, routineItems: nextItems });
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
            )}

            {/* Explicit Confirmation Preview (To / Subject / Body) */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Email Preview &amp; Confirmation
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
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Message
                </label>
                <textarea
                  rows={7}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-zinc-100 leading-relaxed focus:outline-none focus:border-[#00a6ff] resize-y"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              disabled={sendingKind !== null || !isSignedIn}
              onClick={() => handleConfirmSend(activeTab)}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] disabled:opacity-45 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(0,166,255,0.4)]"
            >
              {sendingKind !== null ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sending via Gmail...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>
                    {activeTab === 'welcome' ? 'Confirm & Send Welcome Gmail' : 'Confirm & Send Daily Routine'}
                  </span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

import { useEffect, useRef, useState } from 'react';
import { InteractiveRevealModal } from './components/InteractiveRevealModal';
import { LoginModal } from './components/LoginModal';
import { GmailRoutineModal } from './components/GmailRoutineModal';
import { getCurrentUser, subscribeToAuth } from './firebase';
import {
  fetchEmailPreferences,
  getTodayDateKey,
  triggerWelcomeEmailAutomation,
} from './utils/gmailClient';

export default function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [gmailModalTab, setGmailModalTab] = useState<'welcome' | 'routine' | 'logs'>('welcome');
  const welcomeAttemptedForUid = useRef<Set<string>>(new Set());

  useEffect(() => {
    const runAutomaticWelcomeAndSync = async (user: ReturnType<typeof getCurrentUser>) => {
      if (!user || user.isAnonymous || !user.email) return;

      // Idempotently ensure server preference record exists and auto-send welcome email
      if (!welcomeAttemptedForUid.current.has(user.uid)) {
        welcomeAttemptedForUid.current.add(user.uid);
        await triggerWelcomeEmailAutomation(user, {
          forceResend: false,
          allowClientOAuthFallback: true,
        }).catch(() => {});
      }

      // Sync preferences (respecting opt-in daily default = false for new accounts)
      const { preferences, backendMailConfigured } = await fetchEmailPreferences(user).catch(() => ({
        preferences: null,
        backendMailConfigured: false,
      }));
      if (!preferences) return;

      const today = getTodayDateKey();
      const wantsDaily = preferences.dailyEmailsEnabled || preferences.dailyRoutineEnabled;
      if (!backendMailConfigured && wantsDaily && preferences.lastRoutineSentDate !== today) {
        try {
          const sessionKey = `tc_daily_routine_prompted_${user.uid}_${today}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, '1');
            setGmailModalTab('routine');
            setGmailModalOpen(true);
          }
        } catch {}
      }
    };

    const onAuthLogin = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const user = detail?.user || getCurrentUser();
      if (!user || user.isAnonymous || !user.email) return;
      welcomeAttemptedForUid.current.delete(user.uid);
      void runAutomaticWelcomeAndSync(user);
    };

    const onOpenGmailModal = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const requestedTab = detail?.tab;
      setGmailModalTab(
        requestedTab === 'routine' || requestedTab === 'logs' ? requestedTab : 'welcome'
      );
      setGmailModalOpen(true);
    };

    const unsubAuth = subscribeToAuth((user) => {
      if (!user || user.isAnonymous || !user.email) return;
      void runAutomaticWelcomeAndSync(user);
    });

    window.addEventListener('think-creative-auth-login', onAuthLogin as EventListener);
    window.addEventListener('open-gmail-routine-modal', onOpenGmailModal as EventListener);
    return () => {
      unsubAuth();
      window.removeEventListener('think-creative-auth-login', onAuthLogin as EventListener);
      window.removeEventListener('open-gmail-routine-modal', onOpenGmailModal as EventListener);
    };
  }, []);

  return (
    <>
      <InteractiveRevealModal isOpen onClose={() => {}} onOpenLogin={() => setLoginOpen(true)} />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <GmailRoutineModal
        isOpen={gmailModalOpen}
        initialTab={gmailModalTab}
        onClose={() => setGmailModalOpen(false)}
        onOpenLogin={() => setLoginOpen(true)}
      />
    </>
  );
}

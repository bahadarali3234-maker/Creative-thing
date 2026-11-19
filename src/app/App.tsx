import { useEffect, useState } from 'react';
import { InteractiveRevealModal } from './components/InteractiveRevealModal';
import { LoginModal } from './components/LoginModal';
import { GmailRoutineModal } from './components/GmailRoutineModal';
import { getCurrentUser, subscribeToAuth } from './firebase';
import { getTodayDateKey, loadGmailRoutinePrefs } from './utils/gmailClient';

export default function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [gmailModalTab, setGmailModalTab] = useState<'welcome' | 'routine'>('welcome');

  useEffect(() => {
    const onAuthLogin = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const user = detail?.user || getCurrentUser();
      if (!user || user.isAnonymous || !user.email) return;
      const prefs = loadGmailRoutinePrefs(user.uid);
      // Always prompt Welcome Gmail when a user logs in (or daily routine if already welcomed today)
      if (!prefs.welcomeSentAt) {
        setGmailModalTab('welcome');
        setGmailModalOpen(true);
      } else if (prefs.dailyRoutineEnabled && prefs.lastRoutineSentDate !== getTodayDateKey()) {
        setGmailModalTab('routine');
        setGmailModalOpen(true);
      } else {
        setGmailModalTab('welcome');
        setGmailModalOpen(true);
      }
    };

    const onOpenGmailModal = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setGmailModalTab(detail?.tab === 'routine' ? 'routine' : 'welcome');
      setGmailModalOpen(true);
    };

    const unsubAuth = subscribeToAuth((user) => {
      if (!user || user.isAnonymous || !user.email) return;
      try {
        const today = getTodayDateKey();
        const sessionKey = `tc_daily_routine_prompted_${user.uid}_${today}`;
        if (sessionStorage.getItem(sessionKey)) return;
        const prefs = loadGmailRoutinePrefs(user.uid);
        if (prefs.dailyRoutineEnabled && prefs.lastRoutineSentDate !== today) {
          sessionStorage.setItem(sessionKey, '1');
          setGmailModalTab('routine');
          setGmailModalOpen(true);
        }
      } catch {}
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

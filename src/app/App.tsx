import { useState } from 'react';
import { InteractiveRevealModal } from './components/InteractiveRevealModal';
import { LoginModal } from './components/LoginModal';

export default function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  return <>
    <InteractiveRevealModal isOpen onClose={() => {}} onOpenLogin={() => setLoginOpen(true)} />
    <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
  </>;
}

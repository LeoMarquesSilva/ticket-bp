import { createRoot } from 'react-dom/client';
import './services/ticketServiceExtension';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from '@/services/pushService';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);

import { createRoot } from 'react-dom/client';
import './services/ticketServiceExtension';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

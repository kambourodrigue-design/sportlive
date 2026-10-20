import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import './index.css';

// /admin : page de rédaction (protégée par mot de passe) ; sinon, le site
const isAdmin = window.location.pathname.startsWith('/admin');
createRoot(document.getElementById('root')!).render(isAdmin ? <AdminPanel /> : <App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

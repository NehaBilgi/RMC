import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installCloudStorage } from './lib/cloudStorage';

// Must run before <App /> so every page save is sent to Supabase.
installCloudStorage();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('App root element is missing.');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('CONCRETE360 offline support could not be registered.', error);
    });
  });
}

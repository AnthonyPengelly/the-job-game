import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/console/index.css';
import { App } from '@/console/app';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

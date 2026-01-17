import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../shared/styles/app.css';
import '../shared/lib/i18n';

// Auto-hide native scrollbars: show while scrolling, then hide again.
{
  const root = document.documentElement;
  let timeoutId: number | undefined;

  const activate = () => {
    root.classList.add('scrollbars-active');
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      root.classList.remove('scrollbars-active');
      timeoutId = undefined;
    }, 700);
  };

  window.addEventListener('scroll', activate, { capture: true, passive: true });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

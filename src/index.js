import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Ignore any AbortError / lock-broken errors (harmless)
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'AbortError' || e.reason?.message?.includes('Lock broken')) {
    e.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

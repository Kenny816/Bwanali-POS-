import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'AbortError' || e.reason?.message?.includes('Lock broken')) e.preventDefault();
});
ReactDOM.createRoot(document.getElementById('root')).render(<App />);

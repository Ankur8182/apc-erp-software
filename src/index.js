import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AppErrorBoundary from './Components/AppErrorBoundary';
import reportWebVitals from './reportWebVitals';
import { registerPwaServiceWorker } from './utils/pwa';
import { installProductionErrorMonitoring } from './utils/productionErrorMonitor';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
if (typeof window !== 'undefined') {
  installProductionErrorMonitoring();
  window.addEventListener('load', () => {
    registerPwaServiceWorker();
  });
}

reportWebVitals();

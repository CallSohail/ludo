import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { config } from './config';
import './styles.css';
import './redesign.css';
import './motion.css';

if (config.sohailFontUrl && !config.sohailFontUrl.includes('YOUR-USERNAME')) {
  const fontStyle = document.createElement('style');
  fontStyle.textContent = `@font-face { font-family: 'Sohail Hand'; src: url('${config.sohailFontUrl}') format('woff2'); font-style: normal; font-display: swap; }`;
  document.head.appendChild(fontStyle);
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

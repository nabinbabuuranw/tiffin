import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/young-serif/400.css';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/600.css';
import './styles.css';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

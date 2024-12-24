import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './CreateAgent.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

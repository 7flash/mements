import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ExploreAgents.tsx';
import { ErrorBoundary } from 'src/components/ErrorBoundary.tsx';
import { FallbackErrorUI } from 'src/components/FallbackErrorUI.tsx';

const RootApp = () => (
  <StrictMode>
    <ErrorBoundary fallback={<FallbackErrorUI />}>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find root element');

const root = createRoot(rootElement);
root.render(<RootApp />);
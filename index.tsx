import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './src/App';
import { ErrorBoundary } from './src/components/ErrorBoundary';

const container = document.getElementById('root');
if (!container) {
  document.body.innerHTML =
    '<div class="boot-error"><div class="boot-error-card"><h1>Error de arranque</h1><p>No se encontró el contenedor #root.</p></div></div>';
} else {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

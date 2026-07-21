import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  try {
    return JSON.stringify(error) || 'Error inesperado al renderizar.';
  } catch {
    return 'Error inesperado al renderizar.';
  }
}

/**
 * Evita pantalla en blanco total si un render falla.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: errorToMessage(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.assign('/login');
  };

  private retry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="boot-error" role="alert">
        <div className="boot-error-card">
          <h1>{this.props.fallbackTitle ?? 'No se pudo cargar la aplicación'}</h1>
          <p>{this.state.message || 'Ocurrió un error al iniciar el panel.'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={this.retry}>
              Reintentar
            </button>
            <button type="button" className="btn btn-primary" onClick={this.reload}>
              Ir al login
            </button>
          </div>
        </div>
      </div>
    );
  }
}

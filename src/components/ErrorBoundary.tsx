import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Evita pantalla en blanco total si un render falla.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reload = () => {
    window.location.assign('/login');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="boot-error" role="alert">
        <div className="boot-error-card">
          <h1>{this.props.fallbackTitle ?? 'No se pudo cargar la aplicación'}</h1>
          <p>{this.state.message || 'Ocurrió un error al iniciar el panel.'}</p>
          <button type="button" className="btn btn-primary" onClick={this.reload}>
            Ir al login
          </button>
        </div>
      </div>
    );
  }
}

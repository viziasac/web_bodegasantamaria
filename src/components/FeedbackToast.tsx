import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type FeedbackType = 'success' | 'error' | 'info';

interface FeedbackToastProps {
  type?: FeedbackType;
  message: string | null | undefined;
  onClose: () => void;
  /** Auto-cierre; errores duran más. 0 = no auto-cerrar. */
  autoHideMs?: number;
}

const ICONS: Record<FeedbackType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

/**
 * Ventana emergente centrada para confirmaciones / errores de registro.
 * Visible aunque el scroll esté abajo, junto al botón de guardar.
 */
export const FeedbackToast: React.FC<FeedbackToastProps> = ({
  type = 'success',
  message,
  onClose,
  autoHideMs,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!message) return;
    const ms = autoHideMs ?? (type === 'error' ? 6000 : 3200);
    if (ms <= 0) return;
    const id = window.setTimeout(() => onCloseRef.current(), ms);
    return () => window.clearTimeout(id);
  }, [message, type, autoHideMs]);

  useEffect(() => {
    if (!message) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [message]);

  if (!message) return null;

  return createPortal(
    <div
      className="feedback-toast-overlay"
      role="presentation"
      onClick={() => onCloseRef.current()}
    >
      <div
        className={`feedback-toast feedback-toast--${type}`}
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="material-icons-round feedback-toast-icon" aria-hidden>
          {ICONS[type]}
        </span>
        <p className="feedback-toast-msg">{message}</p>
        <button type="button" className="btn btn-primary feedback-toast-btn" onClick={() => onCloseRef.current()}>
          Entendido
        </button>
      </div>
    </div>,
    document.body,
  );
};

/** Prefiere success; si no, error. Un solo popup a la vez. */
export const PageFeedback: React.FC<{
  success?: string | null;
  error?: string | null;
  onClearSuccess: () => void;
  onClearError: () => void;
}> = ({ success, error, onClearSuccess, onClearError }) => {
  if (success) {
    return <FeedbackToast type="success" message={success} onClose={onClearSuccess} />;
  }
  if (error) {
    return <FeedbackToast type="error" message={error} onClose={onClearError} />;
  }
  return null;
};

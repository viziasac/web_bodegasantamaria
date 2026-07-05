import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toUserMessage } from '../components/ui';
import { getLoginGuardStatus } from '../utils/loginGuard';

const PUBLIC_WEB_URL = 'https://santamarialunahuana.com/';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guardMsg, setGuardMsg] = useState<string | null>(null);
  const [guardBlocked, setGuardBlocked] = useState(false);

  const refreshGuard = useCallback(() => {
    const status = getLoginGuardStatus();
    setGuardMsg(status.message);
    setGuardBlocked(!status.allowed);
    return status;
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    refreshGuard();
    const id = window.setInterval(refreshGuard, 1000);
    return () => window.clearInterval(id);
  }, [refreshGuard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (honeypot.trim()) {
      setError('No se pudo iniciar sesión. Intente de nuevo más tarde.');
      return;
    }

    const status = refreshGuard();
    if (!status.allowed) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      setPassword('');
      navigate('/');
    } catch (err) {
      setPassword('');
      setError(toUserMessage(err, 'Error al iniciar sesión'));
      refreshGuard();
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDisabled = isSubmitting || guardBlocked;

  return (
    <div className="login-page">
      <a
        href={PUBLIC_WEB_URL}
        className="login-public-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="material-icons-round">language</span>
        ¿Buscando nuestra web? <strong>Click aquí</strong>
      </a>

      <div className="login-card">
        <div className="gold-line" />
        <div className="login-brand">
          <span className="material-icons-round">local_bar</span>
          <h1>SANTA MARÍA</h1>
          <p>Bodega — Panel de Gestión</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Honeypot anti-bot — oculto para usuarios reales */}
          <label className="login-honeypot" aria-hidden="true">
            <span>No completar</span>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>

          <label className="form-group">
            <span className="form-label">Correo electrónico</span>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="usuario@empresa.com"
              autoComplete="email"
              autoFocus
              maxLength={254}
              disabled={submitDisabled}
            />
          </label>
          <label className="form-group">
            <span className="form-label">Contraseña</span>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mín. 8 caracteres, letras y números"
              autoComplete="current-password"
              maxLength={128}
              disabled={submitDisabled}
            />
          </label>

          {(guardMsg || error) && (
            <div className={`login-error${guardBlocked ? ' login-error-lock' : ''}`} role="alert">
              {guardMsg || error}
            </div>
          )}

          <button type="submit" className="btn btn-primary login-submit" disabled={submitDisabled}>
            <span className="material-icons-round">{isSubmitting ? 'hourglass_empty' : 'login'}</span>
            {isSubmitting ? 'Verificando…' : guardBlocked ? 'Acceso bloqueado' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="login-footer">
          &copy; {new Date().getFullYear()} Bodega Santa María — Sistema de Gestión Integral
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toUserMessage } from '../components/ui';
import { getLoginGuardStatus } from '../utils/loginGuard';

const PUBLIC_WEB_URL = 'https://santamarialunahuana.com/';

/**
 * Login siempre visible: no sustituye el formulario por un estado de carga
 * (evita pestaña “en blanco” si la sesión Supabase tarda o falla).
 */
const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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

  /** Lee flag de acceso denegado (query o sessionStorage tras bootstrap de sesión). */
  useEffect(() => {
    if (isLoading) return;
    const denied = searchParams.get('denied');
    let fromStorage = false;
    try {
      fromStorage = sessionStorage.getItem('bodega_auth_denied') === 'web';
      if (fromStorage) sessionStorage.removeItem('bodega_auth_denied');
    } catch { /* ignore */ }
    if (denied === 'web' || fromStorage) {
      setError('Su cuenta no tiene acceso a la web. Contacte al administrador.');
      if (denied === 'web') {
        searchParams.delete('denied');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [isLoading, searchParams, setSearchParams]);

  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery') || searchParams.get('type') === 'recovery') {
      setError(
        'Enlace de restablecimiento recibido. Inicie sesión con su correo; si aún no cambió la clave, use el correo del enlace o solicite uno nuevo en Configuración tras ingresar.',
      );
    }
  }, [searchParams]);

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

  const submitDisabled = isSubmitting || guardBlocked || isLoading;
  const alertText = error || guardMsg;

  return (
    <div className="login-page">
      <a
        href={PUBLIC_WEB_URL}
        className="login-public-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="material-icons-round" aria-hidden="true">language</span>
        ¿Buscando nuestra web? <strong>Click aquí</strong>
      </a>

      <div className="login-card">
        <div className="gold-line" />
        <div className="login-brand">
          <span className="material-icons-round" aria-hidden="true">local_bar</span>
          <h1>SANTA MARÍA</h1>
          <p>Bodega — Panel de Gestión</p>
        </div>

        {isLoading && (
          <p className="login-session-hint" aria-live="polite">
            Verificando sesión…
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="on">
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
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="usuario@empresa.com"
              autoComplete="username"
              autoFocus
              maxLength={254}
              disabled={isSubmitting || guardBlocked}
              inputMode="email"
              spellCheck={false}
            />
          </label>
          <label className="form-group">
            <span className="form-label">Contraseña</span>
            <input
              className="form-input"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Contraseña"
              autoComplete="current-password"
              maxLength={128}
              disabled={isSubmitting || guardBlocked}
            />
          </label>

          {alertText && (
            <div className={`login-error${guardBlocked && !error ? ' login-error-lock' : ''}`} role="alert">
              {alertText}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={submitDisabled}
          >
            <span className="material-icons-round" aria-hidden="true">
              {isSubmitting ? 'hourglass_empty' : 'login'}
            </span>
            {isSubmitting ? 'Verificando…' : guardBlocked ? 'Acceso bloqueado' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="login-footer">
          &copy; {new Date().getFullYear()} Bodega Santa María — Sistema de Gestión Integral
        </div>
      </div>

      <Link to="/privacidad" className="login-privacy-link">
        Política de privacidad
      </Link>
    </div>
  );
};

export default LoginPage;

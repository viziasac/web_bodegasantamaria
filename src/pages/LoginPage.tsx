import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toUserMessage } from '../components/ui';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(toUserMessage(err, 'Error al iniciar sesión'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="gold-line" />
        <div className="login-brand">
          <span className="material-icons-round">local_bar</span>
          <h1>SANTA MARÍA</h1>
          <p>Bodega — Panel de Gestión</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="form-group">
            <span className="form-label">Correo electrónico</span>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required placeholder="usuario@empresa.com" autoComplete="email" autoFocus />
          </label>
          <label className="form-group">
            <span className="form-label">Contraseña</span>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required placeholder="••••••••" autoComplete="current-password" />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
            <span className="material-icons-round">{isSubmitting ? 'hourglass_empty' : 'login'}</span>
            {isSubmitting ? 'Verificando…' : 'Iniciar sesión'}
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

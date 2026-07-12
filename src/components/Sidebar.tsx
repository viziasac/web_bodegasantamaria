// src/components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getModulesForRole } from '../config/moduleRegistry';

interface SidebarProps {
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operario: 'Operario',
};

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isOpen, onClose }) => {
  const { user } = useAuth();
  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'U';
  const modules = getModulesForRole(user?.role, { accesoVentas: user?.accesoVentas });
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? (user?.role || 'Operario');

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

  const operaciones = modules.filter(m =>
    !['reportes', 'configuracion', 'materiales_skus'].includes(m.id),
  );
  const admin = modules.filter(m =>
    ['materiales_skus', 'reportes', 'configuracion'].includes(m.id),
  );

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="material-icons-round brand-icon">local_bar</span>
          <div className="brand-name">SANTA MARÍA</div>
          <div className="brand-sub">Bodega ERP</div>
        </div>

        <nav>
          <NavLink to="/" end className={linkClass} onClick={onClose}>
            <span className="material-icons-round">dashboard</span>
            Dashboard
          </NavLink>

          <div className="nav-section">Operaciones</div>
          {operaciones.map(m => (
            <NavLink key={m.id} to={m.path} className={linkClass} onClick={onClose}>
              <span className="material-icons-round">{m.icon}</span>
              {m.title}
            </NavLink>
          ))}

          {admin.length > 0 && (
            <>
              <div className="nav-section nav-section--admin">Administración</div>
              {admin.map(m => (
                <NavLink key={m.id} to={m.path} className={linkClass} onClick={onClose}>
                  <span className="material-icons-round">{m.icon}</span>
                  {m.title}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="user-email">{user?.nombre || user?.email || 'Usuario'}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
          <button type="button" onClick={onLogout} className="btn-icon" title="Cerrar Sesión">
            <span className="material-icons-round">logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

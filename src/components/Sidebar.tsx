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

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isOpen, onClose }) => {
  const { user } = useAuth();
  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'U';
  const modules = getModulesForRole(user?.role);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

  const operaciones = modules.filter(m =>
    !['reportes', 'configuracion'].includes(m.id),
  );
  const admin = modules.filter(m =>
    ['reportes', 'configuracion'].includes(m.id),
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
              <div className="nav-section" style={{ marginTop: '1rem' }}>Administración</div>
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
            <div className="user-email">{user?.email || 'Usuario'}</div>
            <div className="user-role">{user?.role || 'operario'}</div>
          </div>
          <button onClick={onLogout} className="btn-icon" title="Cerrar Sesión" style={{ flexShrink: 0 }}>
            <span className="material-icons-round" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

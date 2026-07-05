// src/components/Layout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const Layout: React.FC = () => {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="material-icons-round">menu</span>
      </button>
      <Sidebar 
        onLogout={logout} 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-content">
        <Outlet />
      </main>
    </>
  );
};

export default Layout;
import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Upload, Users, Tag, UserCircle, Activity, FileText, Settings, Shield, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from './utils/AuthContext';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import Evaluations from './pages/Evaluations';
import EvaluationDetail from './pages/EvaluationDetail';
import Reports from './pages/Reports';
import Agents from './pages/Agents';
import Categories from './pages/Categories';
import Contacts from './pages/Contacts';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import Login from './pages/Login';

const SECTIONS = [
  {
    title: 'Gestión operativa',
    items: [
      { to: '/upload', icon: Upload, label: 'Evaluar', roles: ['admin', 'supervisor'] },
      { to: '/evaluations', icon: Activity, label: 'Evaluaciones', roles: ['admin', 'supervisor', 'viewer'] },
      { to: '/reports', icon: FileText, label: 'Reportes', roles: ['admin', 'supervisor', 'viewer'] },
    ],
  },
  {
    title: 'Analítica',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'supervisor', 'viewer'] },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { to: '/agents', icon: Users, label: 'Agentes', roles: ['admin', 'supervisor'] },
      { to: '/categories', icon: Tag, label: 'Categorías', roles: ['admin', 'supervisor'] },
      { to: '/contacts', icon: UserCircle, label: 'Contactos', roles: ['admin', 'supervisor'] },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/users', icon: Shield, label: 'Gestión de Usuarios', roles: ['admin'] },
      { to: '/settings', icon: Settings, label: 'Configuración', roles: ['admin'] },
    ],
  },
];

function Sidebar({ collapsed, toggle }) {
  const { user, logout } = useAuth();

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-sidebar-bg flex flex-col z-30 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-jel-orange flex items-center justify-center text-white font-bold text-sm shrink-0">JEL</div>
        {!collapsed && <span className="font-semibold text-sm text-white tracking-tight">QA Platform</span>}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(user?.role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.title} className="mb-4">
              {!collapsed && (
                <p className="px-5 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{section.title}</p>
              )}
              <div className="px-2 space-y-0.5">
                {visibleItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all ${
                        isActive
                          ? 'bg-jel-orange text-white font-medium shadow-lg shadow-jel-orange/20'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-2 py-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-jel-orange/20 flex items-center justify-center text-xs font-semibold text-jel-orange">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-500 capitalize">{user?.role}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <div className="w-8 h-8 rounded-full bg-jel-orange/20 flex items-center justify-center text-xs font-semibold text-jel-orange">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-slate-500 hover:text-red-400 hover:bg-white/5 w-full mt-1"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
        <button
          onClick={toggle}
          className="w-full mt-1 px-3 py-1.5 rounded-lg text-[11px] text-slate-600 hover:text-slate-400 hover:bg-white/5 text-center"
        >
          {collapsed ? '→' : '← Colapsar'}
        </button>
      </div>
    </aside>
  );
}

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AuthenticatedApp() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-surface-bg">
      <Sidebar collapsed={collapsed} toggle={() => setCollapsed(!collapsed)} />
      <main className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <div className="p-6 max-w-[1440px] mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/evaluations" element={<Evaluations />} />
            <Route path="/evaluations/:conversationId" element={<EvaluationDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/upload" element={<ProtectedRoute roles={['admin', 'supervisor']}><UploadPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute roles={['admin', 'supervisor']}><Agents /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute roles={['admin', 'supervisor']}><Categories /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute roles={['admin', 'supervisor']}><Contacts /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface-bg"><div className="text-slate-400">Cargando...</div></div>;
  if (!user) return <Login />;
  return <AuthenticatedApp />;
}

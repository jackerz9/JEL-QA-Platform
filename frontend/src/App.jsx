import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Upload, Users, Tag, UserCircle, Activity, FileText, Settings, Shield, LogOut } from 'lucide-react';
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

const ALL_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'supervisor', 'viewer'] },
  { to: '/upload', icon: Upload, label: 'Evaluar', roles: ['admin', 'supervisor'] },
  { to: '/evaluations', icon: Activity, label: 'Evaluaciones', roles: ['admin', 'supervisor', 'viewer'] },
  { to: '/reports', icon: FileText, label: 'Reportes', roles: ['admin', 'supervisor', 'viewer'] },
  { to: '/agents', icon: Users, label: 'Agentes', roles: ['admin', 'supervisor'] },
  { to: '/categories', icon: Tag, label: 'Categorías', roles: ['admin', 'supervisor'] },
  { to: '/contacts', icon: UserCircle, label: 'Contactos', roles: ['admin', 'supervisor'] },
  { to: '/users', icon: Shield, label: 'Usuarios', roles: ['admin'] },
  { to: '/settings', icon: Settings, label: 'Configuración', roles: ['admin'] },
];

const ROLE_COLORS = { admin: 'text-red-400', supervisor: 'text-blue-400', viewer: 'text-slate-400' };

function Sidebar({ collapsed, toggle }) {
  const { user, logout } = useAuth();
  const nav = ALL_NAV.filter(n => n.roles.includes(user?.role));

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-jel-navy-light border-r border-slate-700/50 flex flex-col z-30 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-jel-orange flex items-center justify-center text-white font-bold text-sm shrink-0">QA</div>
        {!collapsed && <span className="font-semibold text-sm text-gray-200 truncate">JEL QA Platform</span>}
      </div>
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-jel-orange/15 text-jel-orange font-medium'
                  : 'text-slate-400 hover:text-gray-200 hover:bg-slate-800'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-slate-700/50 px-2 py-3">
        {!collapsed ? (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-gray-200 truncate">{user?.name}</p>
            <p className={`text-xs capitalize ${ROLE_COLORS[user?.role] || 'text-slate-500'}`}>{user?.role}</p>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-300">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-slate-800 w-full"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      <button
        onClick={toggle}
        className="mx-2 mb-3 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-xs text-center"
      >
        {collapsed ? '→' : '← Colapsar'}
      </button>
    </aside>
  );
}

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AuthenticatedApp() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} toggle={() => setCollapsed(!collapsed)} />
      <main className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <div className="p-6 max-w-[1400px] mx-auto">
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jel-navy">
        <div className="text-slate-500">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Login />;
  return <AuthenticatedApp />;
}

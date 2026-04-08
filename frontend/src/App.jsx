import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Upload, Users, Tag, UserCircle, Activity } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import Evaluations from './pages/Evaluations';
import EvaluationDetail from './pages/EvaluationDetail';
import Agents from './pages/Agents';
import Categories from './pages/Categories';
import Contacts from './pages/Contacts';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Evaluar' },
  { to: '/evaluations', icon: Activity, label: 'Evaluaciones' },
  { to: '/agents', icon: Users, label: 'Agentes' },
  { to: '/categories', icon: Tag, label: 'Categorías' },
  { to: '/contacts', icon: UserCircle, label: 'Contactos' },
];

function Sidebar({ collapsed, toggle }) {
  return (
    <aside className={`fixed left-0 top-0 h-screen bg-jel-navy-light border-r border-slate-700/50 flex flex-col z-30 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-jel-orange flex items-center justify-center text-white font-bold text-sm shrink-0">QA</div>
        {!collapsed && <span className="font-semibold text-sm text-gray-200 truncate">JEL QA Platform</span>}
      </div>
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
        {NAV.map(({ to, icon: Icon, label }) => (
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
      <button
        onClick={toggle}
        className="mx-2 mb-3 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-xs text-center"
      >
        {collapsed ? '→' : '← Colapsar'}
      </button>
    </aside>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} toggle={() => setCollapsed(!collapsed)} />
      <main className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <div className="p-6 max-w-[1400px] mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/evaluations" element={<Evaluations />} />
            <Route path="/evaluations/:conversationId" element={<EvaluationDetail />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/contacts" element={<Contacts />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

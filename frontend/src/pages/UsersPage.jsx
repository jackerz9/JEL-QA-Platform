import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Shield, Eye, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';

const ROLE_LABELS = {
  admin: { label: 'Admin', color: 'bg-red-50 text-red-600 border-red-200' },
  supervisor: { label: 'Supervisor', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  viewer: { label: 'Viewer', color: 'bg-slate-100 text-slate-500 border-slate-300/30' },
};

export default function UsersPage() {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', name: '', email: '', password: '', role: 'viewer' });
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    authFetch('/api/auth/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        const body = { name: form.name, email: form.email, role: form.role };
        if (form.password) body.password = form.password;
        const res = await authFetch(`/api/auth/users/${editing}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        if (!form.username || !form.name || !form.password) {
          alert('Usuario, nombre y contraseña son requeridos');
          return;
        }
        const res = await authFetch('/api/auth/users', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      setForm({ username: '', name: '', email: '', password: '', role: 'viewer' });
      setEditing(null);
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (u) => {
    setEditing(u._id);
    setForm({ username: u.username, name: u.name, email: u.email || '', password: '', role: u.role });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return;
    try {
      const res = await authFetch(`/api/auth/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Shield size={20} /> Usuarios
        </h1>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ username: '', name: '', email: '', password: '', role: 'viewer' }); }}>
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Roles legend */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield size={12} className="text-red-600" /> Admin: acceso total
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <UsersIcon size={12} className="text-blue-600" /> Supervisor: evaluar, reportes, contactos
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Eye size={12} className="text-slate-500" /> Viewer: solo lectura
        </div>
      </div>

      {showAdd && (
        <div className="card mb-4">
          <div className="grid grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Usuario</label>
              <input className="input w-full text-sm" placeholder="jperez" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Nombre</label>
              <input className="input w-full text-sm" placeholder="Juan Pérez" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Email</label>
              <input className="input w-full text-sm" placeholder="juan@jel.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">{editing ? 'Nueva contraseña' : 'Contraseña'}</label>
              <input type="password" className="input w-full text-sm" placeholder={editing ? 'Dejar vacío para no cambiar' : 'Min 6 chars'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Rol</label>
              <select className="select w-full text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="viewer">Viewer</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary text-sm flex items-center gap-1" onClick={handleSave}>
                <Save size={14} /> {editing ? 'Actualizar' : 'Crear'}
              </button>
              <button className="btn-secondary text-sm" onClick={() => { setShowAdd(false); setEditing(null); }}>
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">Usuario</th>
              <th className="pb-2 font-medium">Nombre</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Rol</th>
              <th className="pb-2 font-medium">Estado</th>
              <th className="pb-2 font-medium">Último login</th>
              <th className="pb-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const r = ROLE_LABELS[u.role] || ROLE_LABELS.viewer;
              return (
                <tr key={u._id} className={`border-b border-slate-100 ${!u.active ? 'opacity-40' : ''}`}>
                  <td className="py-2.5 font-mono text-sm">{u.username}</td>
                  <td className="py-2.5">{u.name} {u._id === currentUser?.id && <span className="text-xs text-jel-orange">(tú)</span>}</td>
                  <td className="py-2.5 text-slate-500 text-xs">{u.email || '—'}</td>
                  <td className="py-2.5"><span className={`badge border ${r.color}`}>{r.label}</span></td>
                  <td className="py-2.5">
                    <span className={`badge ${u.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-500">{u.lastLogin ? new Date(u.lastLogin).toLocaleString('es-CL') : 'Nunca'}</td>
                  <td className="py-2.5 flex gap-2">
                    <button onClick={() => handleEdit(u)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700"><Pencil size={14} /></button>
                    {u._id !== currentUser?.id && (
                      <button onClick={() => handleDelete(u._id)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-500">Sin usuarios</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { api } from '../utils/api';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ respondioId: '', name: '', instance: 'venezuela' });
  const [showAdd, setShowAdd] = useState(false);

  const load = () => api.getAgents().then(setAgents).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await api.updateAgent(editing, form);
      } else {
        await api.createAgent(form);
      }
      setForm({ respondioId: '', name: '', instance: 'venezuela' });
      setEditing(null);
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (agent) => {
    setEditing(agent._id);
    setForm({ respondioId: agent.respondioId, name: agent.name, instance: agent.instance });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este agente?')) return;
    await api.deleteAgent(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agentes</h1>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ respondioId: '', name: '', instance: 'venezuela' }); }}>
          <Plus size={16} /> Agregar agente
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">ID Respond.io</label>
              <input className="input w-full text-sm" placeholder="324823" value={form.respondioId} onChange={e => setForm({ ...form, respondioId: e.target.value })} disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Nombre</label>
              <input className="input w-full text-sm" placeholder="Juan Pérez" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Instancia</label>
              <select className="select w-full text-sm" value={form.instance} onChange={e => setForm({ ...form, instance: e.target.value })}>
                <option value="venezuela">Venezuela</option>
                <option value="internacional">Internacional</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary text-sm flex items-center gap-1" onClick={handleSave}>
                <Save size={14} /> {editing ? 'Actualizar' : 'Guardar'}
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
              <th className="pb-2 font-medium">ID Respond.io</th>
              <th className="pb-2 font-medium">Nombre</th>
              <th className="pb-2 font-medium">Instancia</th>
              <th className="pb-2 font-medium">Estado</th>
              <th className="pb-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a._id} className="border-b border-slate-100">
                <td className="py-2.5 font-mono text-slate-500">{a.respondioId}</td>
                <td className="py-2.5">{a.name}</td>
                <td className="py-2.5 capitalize">{a.instance}</td>
                <td className="py-2.5">
                  <span className={`badge ${a.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {a.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-2.5 flex gap-2">
                  <button onClick={() => handleEdit(a)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(a._id)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">Sin agentes configurados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

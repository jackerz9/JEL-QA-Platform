import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Download } from 'lucide-react';
import { api } from '../utils/api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', group: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = () => api.getCategoryList().then(setCategories).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await api.updateCategory(editing, form);
      } else {
        await api.createCategory(form);
      }
      setForm({ code: '', name: '', group: '' });
      setEditing(null);
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await api.importCategories();
      alert(`Importadas ${result.imported} categorías (${result.upserted} nuevas)`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleEdit = (cat) => {
    setEditing(cat._id);
    setForm({ code: cat.code, name: cat.name, group: cat.group || '' });
    setShowAdd(true);
  };

  const groups = [...new Set(categories.map(c => c.group).filter(Boolean))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Categorías</h1>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2 text-sm" onClick={handleImport} disabled={importing}>
            <Download size={16} /> {importing ? 'Importando...' : 'Importar de conversaciones'}
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ code: '', name: '', group: '' }); }}>
            <Plus size={16} /> Nueva categoría
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Código</label>
              <input className="input w-full text-sm" placeholder="8. CLP - Retiro" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nombre</label>
              <input className="input w-full text-sm" placeholder="Estatus de Retiro" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Grupo</label>
              <input className="input w-full text-sm" placeholder="CLP, General, Usuarios..." value={form.group} onChange={e => setForm({ ...form, group: e.target.value })} list="group-list" />
              <datalist id="group-list">
                {groups.map(g => <option key={g} value={g} />)}
              </datalist>
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
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
              <th className="pb-2 font-medium">Código</th>
              <th className="pb-2 font-medium">Nombre</th>
              <th className="pb-2 font-medium">Grupo</th>
              <th className="pb-2 font-medium">Estado</th>
              <th className="pb-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c._id} className="border-b border-slate-800">
                <td className="py-2.5 text-xs text-slate-400 max-w-[300px] truncate">{c.code}</td>
                <td className="py-2.5">{c.name}</td>
                <td className="py-2.5">
                  {c.group && <span className="badge bg-slate-700 text-slate-300">{c.group}</span>}
                </td>
                <td className="py-2.5">
                  <span className={`badge ${c.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/30 text-slate-500'}`}>
                    {c.active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="py-2.5 flex gap-2">
                  <button onClick={() => handleEdit(c)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-gray-200"><Pencil size={14} /></button>
                  <button onClick={async () => { await api.deleteCategory(c._id); load(); }} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">Sin categorías. Usa "Importar de conversaciones" para cargar automáticamente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

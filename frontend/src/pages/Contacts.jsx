import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Save, X, Search, Upload } from 'lucide-react';
import { api } from '../utils/api';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ respondioId: '', name: '', phone: '', email: '', country: '', username: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [skip, setSkip] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const limit = 30;

  const load = useCallback(() => {
    api.getContacts({ search, limit, skip })
      .then(({ contacts, total }) => { setContacts(contacts); setTotal(total); })
      .catch(console.error);
  }, [search, skip]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSkip(0); load(); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleSave = async () => {
    try {
      if (editing) {
        await api.updateContact(editing, form);
      } else {
        await api.createContact(form);
      }
      setForm({ respondioId: '', name: '', phone: '', email: '', country: '', username: '' });
      setEditing(null);
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (c) => {
    setEditing(c._id);
    setForm({ respondioId: c.respondioId, name: c.name || '', phone: c.phone || '', email: c.email || '', country: c.country || '', username: c.username || '' });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar contacto?')) return;
    await api.deleteContact(id);
    load();
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/contacts/import-csv', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      alert(`Importados: ${result.total} contactos (${result.upserted} nuevos, ${result.modified} actualizados)`);
      load();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Contactos <span className="text-sm font-normal text-slate-500">({total})</span></h1>
        <div className="flex gap-2">
          <label className={`btn-secondary flex items-center gap-2 text-sm cursor-pointer ${importing ? 'opacity-50' : ''}`}>
            <Upload size={16} /> {importing ? 'Importando...' : 'Importar CSV'}
            <input type="file" accept=".csv" className="hidden" ref={fileRef} onChange={handleImportCSV} disabled={importing} />
          </label>
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ respondioId: '', name: '', phone: '', email: '', country: '', username: '' }); }}>
            <Plus size={16} /> Agregar contacto
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input w-full pl-9 text-sm"
          placeholder="Buscar por nombre, teléfono, usuario o ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {showAdd && (
        <div className="card mb-4">
          <div className="grid grid-cols-7 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">ID Respond.io</label>
              <input className="input w-full text-sm" value={form.respondioId} onChange={e => setForm({ ...form, respondioId: e.target.value })} disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nombre</label>
              <input className="input w-full text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Teléfono</label>
              <input className="input w-full text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email</label>
              <input className="input w-full text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">País</label>
              <input className="input w-full text-sm" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Usuario JEL</label>
              <input className="input w-full text-sm" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary text-sm flex items-center gap-1" onClick={handleSave}>
                <Save size={14} />
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
              <th className="pb-2 font-medium">ID</th>
              <th className="pb-2 font-medium">Nombre</th>
              <th className="pb-2 font-medium">Teléfono</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">País</th>
              <th className="pb-2 font-medium">Usuario JEL</th>
              <th className="pb-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c._id} className="border-b border-slate-800">
                <td className="py-2.5 font-mono text-xs text-slate-400">{c.respondioId}</td>
                <td className="py-2.5">{c.name || '—'}</td>
                <td className="py-2.5 text-slate-400">{c.phone || '—'}</td>
                <td className="py-2.5 text-slate-400 text-xs">{c.email || '—'}</td>
                <td className="py-2.5">{c.country || '—'}</td>
                <td className="py-2.5 font-mono text-xs">{c.username || '—'}</td>
                <td className="py-2.5 flex gap-2">
                  <button onClick={() => handleEdit(c)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-gray-200"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(c._id)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-500">Sin contactos</td></tr>
            )}
          </tbody>
        </table>

        {total > limit && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
            <span className="text-xs text-slate-500">{skip + 1}-{Math.min(skip + limit, total)} de {total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>Anterior</button>
              <button className="btn-secondary text-xs" disabled={skip + limit >= total} onClick={() => setSkip(skip + limit)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

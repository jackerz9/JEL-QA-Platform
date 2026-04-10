import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Radio } from 'lucide-react';
import { fetchAuth } from '../utils/api';

const COUNTRIES = [
  { value: 'VE', label: 'Venezuela', flag: '🇻🇪' },
  { value: 'CL', label: 'Chile', flag: '🇨🇱' },
  { value: 'PE', label: 'Perú', flag: '🇵🇪' },
  { value: 'MX', label: 'México', flag: '🇲🇽' },
  { value: 'EC', label: 'Ecuador', flag: '🇪🇨' },
  { value: 'INT', label: 'Internacional', flag: '🌎' },
];

const TYPES = [
  { value: 'website_chat', label: 'Website Chat', icon: '💬' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
  { value: 'facebook', label: 'Facebook', icon: '👤' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'google', label: 'Google', icon: '🔍' },
  { value: 'custom', label: 'Custom', icon: '⚙️' },
];

const COUNTRY_COLORS = {
  VE: 'bg-amber-50 text-amber-700 border-amber-200',
  CL: 'bg-red-50 text-red-700 border-red-200',
  PE: 'bg-rose-50 text-rose-700 border-rose-200',
  MX: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EC: 'bg-blue-50 text-blue-700 border-blue-200',
  INT: 'bg-slate-100 text-slate-600 border-slate-200',
};

const emptyForm = { channelId: '', name: '', country: 'VE', type: 'website_chat', instance: 'venezuela' };

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCountry, setFilterCountry] = useState('');

  const load = () => {
    const params = {};
    if (filterCountry) params.country = filterCountry;
    fetchAuth(`/channels?${new URLSearchParams(params)}`).then(r => r.json()).then(setChannels).catch(console.error);
  };

  useEffect(() => { load(); }, [filterCountry]);

  const handleSave = async () => {
    if (!form.channelId || !form.name) { alert('ID y nombre son requeridos'); return; }
    try {
      const url = editing ? `/channels/${editing}` : '/channels';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetchAuth(url, { method, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(emptyForm); setEditing(null); setShowForm(false); load();
    } catch (err) { alert(err.message); }
  };

  const handleEdit = (ch) => {
    setEditing(ch._id);
    setForm({ channelId: ch.channelId, name: ch.name, country: ch.country || 'VE', type: ch.type || 'website_chat', instance: ch.instance || 'venezuela' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este canal?')) return;
    await fetchAuth(`/channels/${id}`, { method: 'DELETE' });
    load();
  };

  const getFlag = (country) => COUNTRIES.find(c => c.value === country)?.flag || '❓';
  const getTypeIcon = (type) => TYPES.find(t => t.value === type)?.icon || '❓';
  const getTypeLabel = (type) => TYPES.find(t => t.value === type)?.label || type;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Radio size={22} className="text-jel-orange" /> Canales
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Canales de Respond.io por país y tipo</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm); }}>
          <Plus size={16} /> Agregar canal
        </button>
      </div>

      {/* Country filter */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilterCountry('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!filterCountry ? 'bg-jel-orange text-white' : 'bg-white border border-surface-border text-slate-500 hover:text-slate-700'}`}>
          Todos
        </button>
        {COUNTRIES.map(c => (
          <button key={c.value} onClick={() => setFilterCountry(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${filterCountry === c.value ? 'bg-jel-orange text-white' : 'bg-white border border-surface-border text-slate-500 hover:text-slate-700'}`}>
            {c.flag} {c.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{editing ? 'Editar canal' : 'Nuevo canal'}</h3>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">ID Respond.io</label>
              <input className="input w-full" placeholder="324856" value={form.channelId} onChange={e => setForm({ ...form, channelId: e.target.value })} disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Nombre</label>
              <input className="input w-full" placeholder="JEL MEX" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">País</label>
              <select className="select w-full" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.flag} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Tipo</label>
              <select className="select w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary text-sm flex items-center gap-1" onClick={handleSave}><Save size={14} /> {editing ? 'Actualizar' : 'Crear'}</button>
              <button className="btn-secondary text-sm" onClick={() => { setShowForm(false); setEditing(null); }}><X size={14} /></button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">ID</th>
              <th className="pb-2 font-medium">Nombre</th>
              <th className="pb-2 font-medium">País</th>
              <th className="pb-2 font-medium">Tipo</th>
              <th className="pb-2 font-medium">Instancia</th>
              <th className="pb-2 font-medium">Estado</th>
              <th className="pb-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(ch => (
              <tr key={ch._id} className={`border-b border-slate-100 hover:bg-slate-50 ${!ch.active ? 'opacity-40' : ''}`}>
                <td className="py-2.5 font-mono text-xs text-slate-500">{ch.channelId}</td>
                <td className="py-2.5 font-medium text-slate-700">{ch.name}</td>
                <td className="py-2.5">
                  <span className={`badge border text-[11px] ${COUNTRY_COLORS[ch.country] || COUNTRY_COLORS.INT}`}>
                    {getFlag(ch.country)} {ch.country}
                  </span>
                </td>
                <td className="py-2.5 text-slate-600 text-xs">{getTypeIcon(ch.type)} {getTypeLabel(ch.type)}</td>
                <td className="py-2.5 text-xs text-slate-500 capitalize">{ch.instance}</td>
                <td className="py-2.5">
                  <span className={`badge ${ch.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {ch.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-2.5 flex gap-1.5">
                  <button onClick={() => handleEdit(ch)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(ch._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {channels.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-400">Sin canales</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

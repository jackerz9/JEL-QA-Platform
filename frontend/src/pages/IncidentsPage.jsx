import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, AlertTriangle } from 'lucide-react';
import { fetchAuth } from '../utils/api';

const TYPES = [
  { value: 'bank_outage', label: 'Caída de banco/pasarela' },
  { value: 'platform_issue', label: 'Fallo de plataforma' },
  { value: 'provider_down', label: 'Proveedor caído' },
  { value: 'high_demand', label: 'Alta demanda' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'other', label: 'Otro' },
];

const TYPE_COLORS = {
  bank_outage: 'bg-red-50 text-red-700 border-red-200',
  platform_issue: 'bg-amber-50 text-amber-700 border-amber-200',
  provider_down: 'bg-orange-50 text-orange-700 border-orange-200',
  high_demand: 'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-slate-100 text-slate-600 border-slate-200',
  other: 'bg-slate-100 text-slate-600 border-slate-200',
};

const emptyForm = {
  title: '', description: '', type: 'platform_issue', instance: 'all',
  startedAt: '', endedAt: '', relaxFactor: 2,
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    fetchAuth('/incidents').then(r => r.json()).then(setIncidents).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.title || !form.startedAt || !form.endedAt) {
      alert('Título, inicio y fin son requeridos');
      return;
    }
    try {
      const url = editing ? `/incidents/${editing}` : '/incidents';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetchAuth(url, { method, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (inc) => {
    setEditing(inc._id);
    setForm({
      title: inc.title,
      description: inc.description || '',
      type: inc.type,
      instance: inc.instance,
      startedAt: inc.startedAt?.slice(0, 16),
      endedAt: inc.endedAt?.slice(0, 16),
      relaxFactor: inc.relaxFactor || 2,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este incidente?')) return;
    await fetchAuth(`/incidents/${id}`, { method: 'DELETE' });
    load();
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDuration = (start, end) => {
    if (!start || !end) return '';
    const ms = new Date(end) - new Date(start);
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle size={22} className="text-amber-500" /> Incidentes operativos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Registra eventos que afectan la operación. Las evaluaciones durante un incidente se relajan automáticamente.
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 text-sm"
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm); }}
        >
          <Plus size={16} /> Registrar incidente
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">{editing ? 'Editar incidente' : 'Nuevo incidente'}</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Título</label>
              <input className="input w-full" placeholder="Ej: Caída de Banesco" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Tipo</label>
              <select className="select w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-500 font-medium block mb-1.5">Descripción (opcional)</label>
            <textarea className="input w-full" rows={2} placeholder="Detalles del incidente..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Inicio</label>
              <input type="datetime-local" className="input w-full" value={form.startedAt} onChange={e => setForm({ ...form, startedAt: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Fin</label>
              <input type="datetime-local" className="input w-full" value={form.endedAt} onChange={e => setForm({ ...form, endedAt: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Instancia afectada</label>
              <select className="select w-full" value={form.instance} onChange={e => setForm({ ...form, instance: e.target.value })}>
                <option value="all">Todas</option>
                <option value="venezuela">Venezuela</option>
                <option value="internacional">Internacional</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Factor de relajación</label>
              <select className="select w-full" value={form.relaxFactor} onChange={e => setForm({ ...form, relaxFactor: Number(e.target.value) })}>
                <option value={1.5}>1.5x (leve)</option>
                <option value={2}>2x (moderado)</option>
                <option value={3}>3x (severo)</option>
                <option value={5}>5x (crítico)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Los umbrales de tiempo se multiplican por este factor</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={handleSave}>
              <Save size={14} /> {editing ? 'Actualizar' : 'Guardar'}
            </button>
            <button className="btn-secondary text-sm" onClick={() => { setShowForm(false); setEditing(null); }}>
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {incidents.length === 0 ? (
          <div className="card text-center py-12">
            <AlertTriangle size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No hay incidentes registrados</p>
            <p className="text-slate-400 text-sm mt-1">Registra uno cuando ocurra un evento que afecte la operación</p>
          </div>
        ) : (
          incidents.map(inc => (
            <div key={inc._id} className={`card flex items-start gap-4 ${!inc.active ? 'opacity-50' : ''}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-sm font-semibold text-slate-800">{inc.title}</h3>
                  <span className={`badge border text-[11px] ${TYPE_COLORS[inc.type] || TYPE_COLORS.other}`}>
                    {TYPES.find(t => t.value === inc.type)?.label || inc.type}
                  </span>
                  <span className="badge bg-slate-100 text-slate-500 text-[11px]">
                    {inc.instance === 'all' ? 'Todas' : inc.instance}
                  </span>
                  <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">
                    {inc.relaxFactor}x relajación
                  </span>
                </div>
                {inc.description && <p className="text-xs text-slate-500 mb-2">{inc.description}</p>}
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{formatDate(inc.startedAt)} → {formatDate(inc.endedAt)}</span>
                  <span className="text-slate-300">|</span>
                  <span>Duración: {getDuration(inc.startedAt, inc.endedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => handleEdit(inc)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(inc._id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

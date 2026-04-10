import React, { useState, useEffect, useMemo } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';

const STATUS_MAP = {
  uploading: { color: 'text-blue-600', label: 'Subiendo...' },
  parsing: { color: 'text-amber-600', label: 'Parseando...' },
  evaluating: { color: 'text-jel-orange', label: 'Evaluando...' },
  completed: { color: 'text-emerald-600', label: 'Completado' },
  error: { color: 'text-red-600', label: 'Error' },
};

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function EvalCalendar({ batches }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Build a map of evaluated dates -> { instance, count }
  const evalDates = useMemo(() => {
    const map = {};
    batches.forEach(b => {
      if (b.status !== 'completed') return;
      const d = new Date(b.date);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push({ instance: b.instance, evaluated: b.evaluatedCount || 0 });
    });
    return map;
  }, [batches]);

  const firstDay = new Date(month.year, month.month, 1);
  const lastDay = new Date(month.year, month.month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => {
    setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 });
  };
  const next = () => {
    setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1 rounded hover:bg-slate-100"><ChevronLeft size={16} className="text-slate-500" /></button>
        <span className="text-sm font-semibold text-slate-700">{MONTHS[month.month]} {month.year}</span>
        <button onClick={next} className="p-1 rounded hover:bg-slate-100"><ChevronRight size={16} className="text-slate-500" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map(d => <div key={d} className="text-[10px] text-slate-400 font-medium py-1">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const key = `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const evals = evalDates[key];
          const isToday = key === todayKey;
          const hasVen = evals?.some(e => e.instance === 'venezuela');
          const hasInt = evals?.some(e => e.instance === 'internacional');
          const totalEvals = evals?.reduce((s, e) => s + e.evaluated, 0) || 0;

          return (
            <div
              key={key}
              className={`relative py-1.5 rounded-lg text-xs transition-all cursor-default ${
                isToday ? 'ring-2 ring-jel-orange ring-offset-1' : ''
              } ${evals ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
              title={evals ? `${totalEvals} evaluaciones\n${hasVen ? '🇻🇪 Venezuela' : ''}${hasVen && hasInt ? ' + ' : ''}${hasInt ? '🌎 Internacional' : ''}` : ''}
            >
              {day}
              {evals && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {hasVen && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  {hasInt && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Venezuela</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Internacional</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Evaluado</span>
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [instance, setInstance] = useState('venezuela');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [convsFile, setConvsFile] = useState(null);
  const [msgsFile, setMsgsFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getBatches().then(setBatches).catch(() => {});
  }, []);

  // Poll batch status
  useEffect(() => {
    if (!currentBatch?._id || ['completed', 'error'].includes(currentBatch.status)) return;
    const interval = setInterval(async () => {
      try {
        const updated = await api.getBatchStatus(currentBatch._id);
        if (updated?.error) { clearInterval(interval); return; }
        setCurrentBatch(updated);
        if (['completed', 'error'].includes(updated.status)) {
          clearInterval(interval);
          api.getBatches().then(setBatches);
        }
      } catch (e) {
        console.error(e);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentBatch]);

  const handleUpload = async () => {
    if (!convsFile || !msgsFile) return setError('Selecciona ambos archivos CSV');
    setError('');
    setUploading(true);

    try {
      const form = new FormData();
      form.append('conversations', convsFile);
      form.append('messages', msgsFile);
      form.append('instance', instance);
      form.append('date', date);

      const token = localStorage.getItem('jel_token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Upload failed');
      setCurrentBatch(result);
      setConvsFile(null);
      setMsgsFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Active batch progress bar (inline in the page)
  const isProcessing = currentBatch && !['completed', 'error'].includes(currentBatch.status);
  const progress = currentBatch?.totalConversations > 0
    ? Math.round(((currentBatch.evaluatedCount || 0) / currentBatch.totalConversations) * 100)
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Evaluar conversaciones</h1>

      {/* Progress bar when processing */}
      {isProcessing && (
        <div className="card mb-4 border-jel-orange/30 bg-orange-50/50">
          <div className="flex items-center gap-3 mb-2">
            <Loader size={16} className="text-jel-orange animate-spin" />
            <span className="text-sm font-medium text-jel-orange">
              {currentBatch.status === 'parsing' ? 'Parseando CSVs...' : `Evaluando con IA... ${currentBatch.evaluatedCount || 0} de ${currentBatch.totalConversations || '?'}`}
            </span>
          </div>
          <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
            <div className="h-full bg-jel-orange rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{progress}%</span>
            <span>{currentBatch.errorCount > 0 ? `${currentBatch.errorCount} errores` : ''}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Upload form */}
        <div className="card col-span-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Subir archivos de Respond.io</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1.5">Instancia</label>
                <select className="select w-full" value={instance} onChange={e => setInstance(e.target.value)}>
                  <option value="venezuela">Venezuela</option>
                  <option value="internacional">Internacional</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1.5">Fecha a evaluar</label>
                <input type="date" className="input w-full" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">CSV Conversaciones</label>
              <label className="flex items-center gap-3 p-3.5 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-jel-orange/40 transition-colors">
                <FileText size={18} className={convsFile ? 'text-emerald-600' : 'text-slate-400'} />
                <span className="text-sm text-slate-600 flex-1 truncate">
                  {convsFile ? convsFile.name : 'Seleccionar archivo de conversaciones...'}
                </span>
                <input type="file" accept=".csv" className="hidden" onChange={e => setConvsFile(e.target.files[0])} />
              </label>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">CSV Mensajes</label>
              <label className="flex items-center gap-3 p-3.5 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-jel-orange/40 transition-colors">
                <FileText size={18} className={msgsFile ? 'text-emerald-600' : 'text-slate-400'} />
                <span className="text-sm text-slate-600 flex-1 truncate">
                  {msgsFile ? msgsFile.name : 'Seleccionar archivo de mensajes...'}
                </span>
                <input type="file" accept=".csv" className="hidden" onChange={e => setMsgsFile(e.target.files[0])} />
              </label>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <button
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleUpload}
              disabled={uploading || !convsFile || !msgsFile || isProcessing}
            >
              {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
              {isProcessing ? 'Evaluación en curso...' : uploading ? 'Subiendo...' : 'Subir y evaluar'}
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div className="card col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Días evaluados</h2>
          <EvalCalendar batches={batches} />
        </div>
      </div>

      {/* History */}
      <div className="card mt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Historial de cargas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Instancia</th>
                <th className="pb-2 font-medium text-center">Convs.</th>
                <th className="pb-2 font-medium text-center">Evaluados</th>
                <th className="pb-2 font-medium text-center">Errores</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Creado</th>
                <th className="pb-2 font-medium">Finalizado</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => {
                const S = STATUS_MAP[b.status] || {};
                return (
                  <tr key={b._id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-2.5 font-medium">{new Date(b.date).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</td>
                    <td className="py-2.5 capitalize">{b.instance}</td>
                    <td className="py-2.5 text-center">{b.totalConversations}</td>
                    <td className="py-2.5 text-center text-emerald-600 font-semibold">{b.evaluatedCount}</td>
                    <td className="py-2.5 text-center">{b.errorCount > 0 ? <span className="text-red-600">{b.errorCount}</span> : <span className="text-slate-300">0</span>}</td>
                    <td className="py-2.5"><span className={`text-xs font-medium ${S.color}`}>{S.label}</span></td>
                    <td className="py-2.5 text-xs text-slate-500">{new Date(b.createdAt).toLocaleString('es-CL')}</td>
                    <td className="py-2.5 text-xs text-slate-500">{b.completedAt ? new Date(b.completedAt).toLocaleString('es-CL') : '—'}</td>
                    <td className="py-2.5">
                      <button
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        onClick={async () => {
                          const d = new Date(b.date).toLocaleDateString('es-CL', { timeZone: 'UTC' });
                          if (!confirm(`¿Eliminar la carga del ${d} (${b.instance})?\n\nEsto borrará ${b.totalConversations} conversaciones, sus mensajes y evaluaciones.`)) return;
                          try {
                            const res = await fetch(`/api/upload/${b._id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${localStorage.getItem('jel_token')}` },
                            });
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.error);
                            alert(`Eliminado: ${result.deleted.conversations} convs, ${result.deleted.messages} msgs, ${result.deleted.evaluations} evals`);
                            api.getBatches().then(setBatches);
                          } catch (err) {
                            alert('Error: ' + err.message);
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">Sin cargas anteriores</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

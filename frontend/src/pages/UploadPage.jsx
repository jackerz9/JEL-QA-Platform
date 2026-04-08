import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Clock } from 'lucide-react';
import { api } from '../utils/api';

const STATUS_MAP = {
  uploading: { icon: Loader, color: 'text-blue-400', label: 'Subiendo...' },
  parsing: { icon: Loader, color: 'text-amber-400', label: 'Parseando CSVs...' },
  evaluating: { icon: Loader, color: 'text-jel-orange', label: 'Evaluando con IA...' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', label: 'Completado' },
  error: { icon: AlertCircle, color: 'text-red-400', label: 'Error' },
};

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

  const StatusInfo = STATUS_MAP[currentBatch?.status] || {};

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Evaluar conversaciones</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Upload form */}
        <div className="card">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Subir archivos de Respond.io</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Instancia</label>
                <select className="select w-full text-sm" value={instance} onChange={e => setInstance(e.target.value)}>
                  <option value="venezuela">Venezuela</option>
                  <option value="internacional">Internacional</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fecha a evaluar</label>
                <input type="date" className="input w-full text-sm" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            {/* Conversations file */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">CSV Conversaciones</label>
              <label className="flex items-center gap-3 p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-jel-orange/50 transition-colors">
                <FileText size={20} className={convsFile ? 'text-emerald-400' : 'text-slate-500'} />
                <span className="text-sm text-slate-300 flex-1 truncate">
                  {convsFile ? convsFile.name : 'Seleccionar archivo de conversaciones...'}
                </span>
                <input type="file" accept=".csv" className="hidden" onChange={e => setConvsFile(e.target.files[0])} />
              </label>
            </div>

            {/* Messages file */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">CSV Mensajes</label>
              <label className="flex items-center gap-3 p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-jel-orange/50 transition-colors">
                <FileText size={20} className={msgsFile ? 'text-emerald-400' : 'text-slate-500'} />
                <span className="text-sm text-slate-300 flex-1 truncate">
                  {msgsFile ? msgsFile.name : 'Seleccionar archivo de mensajes...'}
                </span>
                <input type="file" accept=".csv" className="hidden" onChange={e => setMsgsFile(e.target.files[0])} />
              </label>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleUpload}
              disabled={uploading || !convsFile || !msgsFile || (currentBatch && !['completed', 'error'].includes(currentBatch.status))}
            >
              {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
              {currentBatch && !['completed', 'error'].includes(currentBatch.status)
                ? 'Evaluación en curso...'
                : uploading ? 'Subiendo...' : 'Subir y evaluar'}
            </button>
          </div>
        </div>

        {/* Current batch status */}
        <div className="card">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Estado del procesamiento</h2>

          {currentBatch ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {StatusInfo.icon && (
                  <StatusInfo.icon
                    size={20}
                    className={`${StatusInfo.color} ${['uploading', 'parsing', 'evaluating'].includes(currentBatch.status) ? 'animate-spin' : ''}`}
                  />
                )}
                <span className={`text-sm font-medium ${StatusInfo.color}`}>{StatusInfo.label}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Conversaciones</p>
                  <p className="text-lg font-semibold">{currentBatch.totalConversations || 0}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Mensajes</p>
                  <p className="text-lg font-semibold">{currentBatch.totalMessages || 0}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Evaluados</p>
                  <p className="text-lg font-semibold text-emerald-400">{currentBatch.evaluatedCount || 0}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Errores</p>
                  <p className="text-lg font-semibold text-red-400">{currentBatch.errorCount || 0}</p>
                </div>
              </div>

              {currentBatch.status === 'evaluating' && currentBatch.totalConversations > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progreso</span>
                    <span>{Math.round(((currentBatch.evaluatedCount || 0) / currentBatch.totalConversations) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-jel-orange rounded-full transition-all duration-500"
                      style={{ width: `${((currentBatch.evaluatedCount || 0) / currentBatch.totalConversations) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">
              <Upload size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Sube archivos para comenzar la evaluación</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="card mt-6">
        <h2 className="text-sm font-medium text-slate-300 mb-4">Historial de cargas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Instancia</th>
                <th className="pb-2 font-medium">Conversaciones</th>
                <th className="pb-2 font-medium">Evaluados</th>
                <th className="pb-2 font-medium">Errores</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Creado</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => {
                const S = STATUS_MAP[b.status] || {};
                return (
                  <tr key={b._id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-2.5">{new Date(b.date).toLocaleDateString('es-CL')}</td>
                    <td className="py-2.5 capitalize">{b.instance}</td>
                    <td className="py-2.5">{b.totalConversations}</td>
                    <td className="py-2.5 text-emerald-400">{b.evaluatedCount}</td>
                    <td className="py-2.5 text-red-400">{b.errorCount || 0}</td>
                    <td className="py-2.5"><span className={`text-xs ${S.color}`}>{S.label}</span></td>
                    <td className="py-2.5 text-slate-500">{new Date(b.createdAt).toLocaleString('es-CL')}</td>
                    <td className="py-2.5">
                      <button
                        className="text-xs text-red-400 hover:text-red-300 hover:underline"
                        onClick={async () => {
                          const d = new Date(b.date).toLocaleDateString('es-CL');
                          if (!confirm(`¿Eliminar la carga del ${d} (${b.instance})?\n\nEsto borrará ${b.totalConversations} conversaciones, sus mensajes y evaluaciones. Esta acción no se puede deshacer.`)) return;
                          try {
                            const res = await fetch(`/api/upload/${b._id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${localStorage.getItem('jel_token')}` },
                            });
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.error);
                            alert(`Eliminado: ${result.deleted.conversations} conversaciones, ${result.deleted.messages} mensajes, ${result.deleted.evaluations} evaluaciones`);
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
                <tr><td colSpan={8} className="py-8 text-center text-slate-500">Sin cargas anteriores</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

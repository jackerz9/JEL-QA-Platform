import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api } from '../utils/api';

export default function Evaluations() {
  const navigate = useNavigate();
  const [evals, setEvals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ instance: '', agentId: '', grade: '', dateFrom: '', dateTo: '', sort: '-finalScore', limit: 50, skip: 0 });
  const [agents, setAgents] = useState([]);

  useEffect(() => { api.getAgents().then(setAgents).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    api.getEvaluations(clean)
      .then(({ evaluations, total }) => { setEvals(evaluations); setTotal(total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const setFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v, skip: 0 }));

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.instance) params.set('instance', filters.instance);
    window.open(`/api/evaluations/export/csv?${params.toString()}`, '_blank');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Evaluaciones <span className="text-sm font-normal text-slate-500">({total})</span></h1>
        <button className="btn-secondary text-sm flex items-center gap-2" onClick={handleExport}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select className="select text-sm" value={filters.instance} onChange={e => setFilter('instance', e.target.value)}>
          <option value="">Todas</option>
          <option value="venezuela">Venezuela</option>
          <option value="internacional">Internacional</option>
        </select>
        <select className="select text-sm" value={filters.agentId} onChange={e => setFilter('agentId', e.target.value)}>
          <option value="">Todos los agentes</option>
          {agents.map(a => <option key={a._id} value={a.respondioId}>{a.name}</option>)}
        </select>
        <select className="select text-sm" value={filters.grade} onChange={e => setFilter('grade', e.target.value)}>
          <option value="">Todas las notas</option>
          {['A', 'B', 'C', 'D', 'F'].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <input type="date" className="input text-sm" value={filters.dateFrom || ''} onChange={e => setFilter('dateFrom', e.target.value)} title="Desde" />
        <input type="date" className="input text-sm" value={filters.dateTo || ''} onChange={e => setFilter('dateTo', e.target.value)} title="Hasta" />
        <select className="select text-sm" value={filters.sort} onChange={e => setFilter('sort', e.target.value)}>
          <option value="-finalScore">Mayor score</option>
          <option value="finalScore">Menor score</option>
          <option value="-evaluatedAt">Más reciente</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">Conv.</th>
              <th className="pb-2 font-medium">Agente</th>
              <th className="pb-2 font-medium">Categoría IA</th>
              <th className="pb-2 font-medium text-center">Sent.</th>
              <th className="pb-2 font-medium text-center">Final</th>
              <th className="pb-2 font-medium text-center">Nota</th>
              <th className="pb-2 font-medium">Coaching</th>
              <th className="pb-2 font-medium text-center">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center text-slate-500">Cargando...</td></tr>
            ) : evals.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-slate-500">Sin evaluaciones</td></tr>
            ) : (
              evals.map((ev, idx) => (
                <tr
                  key={ev._id}
                  className={`border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer ${ev.needsAttention ? 'bg-red-50/50' : ''}`}
                  onClick={() => {
                    // Store list of conversation IDs for prev/next navigation
                    sessionStorage.setItem('evalList', JSON.stringify(evals.map(e => e.conversationId)));
                    sessionStorage.setItem('evalIndex', idx.toString());
                    navigate(`/evaluations/${ev.conversationId}`);
                  }}
                >
                  <td className="py-2.5 font-mono text-xs text-slate-500">{ev.conversationId?.slice(-8)}</td>
                  <td className="py-2.5 text-sm">{ev.agentName}</td>
                  <td className="py-2.5 text-xs text-slate-500 max-w-[180px] truncate">
                    {ev.aiCategory || ev.aiCategories?.[0] || '—'}
                  </td>
                  <td className="py-2.5 text-center text-base">
                    {ev.sentiment?.label === 'muy_positivo' ? '😊' :
                     ev.sentiment?.label === 'positivo' ? '🙂' :
                     ev.sentiment?.label === 'neutral' ? '😐' :
                     ev.sentiment?.label === 'negativo' ? '😠' :
                     ev.sentiment?.label === 'muy_negativo' ? '🤬' : '—'}
                  </td>
                  <td className="py-2.5 text-center font-semibold">{ev.finalScore}</td>
                  <td className="py-2.5 text-center">
                    <span className={`badge grade-${ev.grade}`}>{ev.grade}</span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-500 max-w-[220px] truncate">
                    {ev.coachingTip || ev.qualitative?.summary || '—'}
                  </td>
                  <td className="py-2.5 text-center">
                    {ev.needsAttention && <span className="text-red-600" title={ev.attentionReason}>⚠</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > parseInt(filters.limit) && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Mostrando {parseInt(filters.skip) + 1}-{Math.min(parseInt(filters.skip) + parseInt(filters.limit), total)} de {total}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-secondary text-xs"
                disabled={parseInt(filters.skip) === 0}
                onClick={() => setFilters(p => ({ ...p, skip: Math.max(0, parseInt(p.skip) - parseInt(p.limit)) }))}
              >
                Anterior
              </button>
              <button
                className="btn-secondary text-xs"
                disabled={parseInt(filters.skip) + parseInt(filters.limit) >= total}
                onClick={() => setFilters(p => ({ ...p, skip: parseInt(p.skip) + parseInt(p.limit) }))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

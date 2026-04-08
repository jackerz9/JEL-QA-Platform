import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api } from '../utils/api';

export default function Evaluations() {
  const navigate = useNavigate();
  const [evals, setEvals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ instance: '', agentId: '', grade: '', sort: '-finalScore', limit: 50, skip: 0 });
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
      <div className="flex gap-3 mb-4">
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
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
              <th className="pb-2 font-medium">Conversación</th>
              <th className="pb-2 font-medium">Agente</th>
              <th className="pb-2 font-medium">Categoría</th>
              <th className="pb-2 font-medium text-center">Cuant.</th>
              <th className="pb-2 font-medium text-center">Cual.</th>
              <th className="pb-2 font-medium text-center">Final</th>
              <th className="pb-2 font-medium text-center">Nota</th>
              <th className="pb-2 font-medium">Resumen IA</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center text-slate-500">Cargando...</td></tr>
            ) : evals.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-slate-500">Sin evaluaciones</td></tr>
            ) : (
              evals.map(ev => (
                <tr
                  key={ev._id}
                  className="border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer"
                  onClick={() => navigate(`/evaluations/${ev.conversationId}`)}
                >
                  <td className="py-2.5 font-mono text-xs text-slate-400">{ev.conversationId?.slice(-8)}</td>
                  <td className="py-2.5">{ev.agentName}</td>
                  <td className="py-2.5 text-xs text-slate-400 max-w-[200px] truncate">
                    {ev.aiCategories?.[0] || '—'}
                  </td>
                  <td className="py-2.5 text-center font-mono">{ev.quantitative?.totalScore ?? '—'}</td>
                  <td className="py-2.5 text-center font-mono">{ev.qualitative?.totalScore ?? '—'}</td>
                  <td className="py-2.5 text-center font-semibold">{ev.finalScore}</td>
                  <td className="py-2.5 text-center">
                    <span className={`badge grade-${ev.grade}`}>{ev.grade}</span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-400 max-w-[250px] truncate">
                    {ev.qualitative?.summary || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > parseInt(filters.limit) && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
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

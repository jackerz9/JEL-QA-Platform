import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';

const PAGE_SIZE = 30;

export default function Evaluations() {
  const navigate = useNavigate();
  const [evals, setEvals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ instance: '', agentId: '', grade: '', dateFrom: '', dateTo: '', sort: '-finalScore' });
  const [agents, setAgents] = useState([]);

  useEffect(() => { api.getAgents().then(setAgents).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const params = { ...filters, limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE };
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== 0));
    api.getEvaluations(clean)
      .then(({ evaluations, total }) => { setEvals(evaluations); setTotal(total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, page]);

  const setFilter = (k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // Build page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.instance) params.set('instance', filters.instance);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    const token = localStorage.getItem('jel_token');
    window.open(`/api/evaluations/export/csv?${params.toString()}&token=${token}`, '_blank');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Evaluaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total.toLocaleString()} evaluaciones en total</p>
        </div>
        <button className="btn-secondary text-sm flex items-center gap-2" onClick={handleExport}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select className="select text-sm" value={filters.instance} onChange={e => setFilter('instance', e.target.value)}>
          <option value="">Todas las instancias</option>
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
        <input type="date" className="input text-sm" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} title="Desde" />
        <input type="date" className="input text-sm" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} title="Hasta" />
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
              <tr><td colSpan={8} className="py-10 text-center text-slate-400">Cargando...</td></tr>
            ) : evals.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-slate-400">Sin evaluaciones para los filtros seleccionados</td></tr>
            ) : (
              evals.map((ev, idx) => (
                <tr
                  key={ev._id}
                  className={`border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors ${ev.needsAttention ? 'bg-red-50/50' : ''}`}
                  onClick={() => {
                    sessionStorage.setItem('evalList', JSON.stringify(evals.map(e => e.conversationId)));
                    sessionStorage.setItem('evalIndex', idx.toString());
                    navigate(`/evaluations/${ev.conversationId}`);
                  }}
                >
                  <td className="py-2.5 font-mono text-xs text-slate-500">{ev.conversationId?.slice(-8)}</td>
                  <td className="py-2.5 text-sm font-medium text-slate-700">{ev.agentName}</td>
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
                  <td className="py-2.5 text-center font-semibold"
                    style={{ color: ev.finalScore >= 75 ? '#059669' : ev.finalScore >= 50 ? '#D97706' : '#DC2626' }}>
                    {ev.finalScore}
                  </td>
                  <td className="py-2.5 text-center">
                    <span className={`badge grade-${ev.grade}`}>{ev.grade}</span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-500 max-w-[220px] truncate">
                    {ev.coachingTip || ev.qualitative?.summary || '—'}
                  </td>
                  <td className="py-2.5 text-center">
                    {ev.needsAttention && <span className="text-red-600" title={ev.attentionReason}>⚠</span>}
                    {ev.affectedByIncident && <span className="badge bg-amber-50 text-amber-600 border border-amber-200 text-[10px] ml-1" title={ev.incidentTitle}>⚡</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {from.toLocaleString()}–{to.toLocaleString()} de {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>

              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`dot${i}`} className="px-1 text-xs text-slate-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      page === p
                        ? 'bg-jel-orange text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

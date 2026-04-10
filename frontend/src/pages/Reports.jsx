import React, { useEffect, useState } from 'react';
import { Users, Tag, Heart, AlertTriangle, FileDown, Download, Radio } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { api, fetchAuth } from '../utils/api';

const TABS = [
  { id: 'agents', label: 'Por operador', icon: Users },
  { id: 'channels', label: 'Por canal', icon: Radio },
  { id: 'categories', label: 'Por categoría', icon: Tag },
  { id: 'sentiment', label: 'Sentimiento', icon: Heart },
  { id: 'incidents', label: 'Incidentes', icon: AlertTriangle },
];

const SENT_COLORS = { muy_positivo: '#059669', positivo: '#10B981', neutral: '#94A3B8', negativo: '#F59E0B', muy_negativo: '#EF4444' };
const SENT_LABELS = { muy_positivo: 'Muy positivo', positivo: 'Positivo', neutral: 'Neutral', negativo: 'Negativo', muy_negativo: 'Muy negativo' };
const GRADE_COLORS = { A: '#059669', B: '#2563EB', C: '#D97706', D: '#EA580C', F: '#DC2626' };

export default function Reports() {
  const [tab, setTab] = useState('agents');
  const [filters, setFilters] = useState({ instance: '', dateFrom: '', dateTo: '' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Análisis detallado de calidad de atención</p>
        </div>
        <div className="flex gap-3">
          <select className="select" value={filters.instance} onChange={e => setFilters({ ...filters, instance: e.target.value })}>
            <option value="">Todas</option>
            <option value="venezuela">Venezuela</option>
            <option value="internacional">Internacional</option>
          </select>
          <input type="date" className="input" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input type="date" className="input" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-surface-border rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-jel-orange text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'agents' && <AgentsReport filters={filters} />}
      {tab === 'channels' && <ChannelsReport filters={filters} />}
      {tab === 'categories' && <CategoriesReport filters={filters} />}
      {tab === 'sentiment' && <SentimentReport filters={filters} />}
      {tab === 'incidents' && <IncidentsReport filters={filters} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// AGENTS REPORT
// ═══════════════════════════════════════════════
function AgentsReport({ filters }) {
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const params = {};
    if (filters.instance) params.instance = filters.instance;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    fetchAuth(`/reports/agents-summary?${new URLSearchParams(params)}`)
      .then(r => r.json()).then(setAgents).catch(console.error);
  }, [filters]);

  const loadDetail = async (agentId) => {
    setSelected(agentId);
    const params = { agentId };
    if (filters.instance) params.instance = filters.instance;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (!params.dateFrom) params.dateFrom = '2020-01-01';
    const res = await fetchAuth(`/reports/agent-daily?${new URLSearchParams(params)}`);
    setDetail(await res.json());
  };

  const exportPDF = async () => {
    if (!selected || !detail) return;
    setExporting(true);
    try {
      const res = await fetchAuth(`/reports/agent-pdf?${new URLSearchParams({
        agentId: selected,
        instance: filters.instance || '',
        dateFrom: filters.dateFrom || '2020-01-01',
        dateTo: filters.dateTo || '',
      })}`);
      if (!res.ok) throw new Error('Error generando PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${detail?.agent?.name || 'agente'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exportando PDF: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const d = detail;
  const s = d?.summary;
  const gradeData = s ? [
    { name: 'A', value: s.grades?.A || 0 }, { name: 'B', value: s.grades?.B || 0 },
    { name: 'C', value: s.grades?.C || 0 }, { name: 'D', value: s.grades?.D || 0 },
    { name: 'F', value: s.grades?.F || 0 },
  ].filter(g => g.value > 0) : [];

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Agent list */}
      <div className="card col-span-1 max-h-[70vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Agentes</h3>
        <div className="space-y-1">
          {agents.map(a => (
            <button
              key={a._id}
              onClick={() => loadDetail(a._id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                selected === a._id ? 'bg-jel-orange text-white' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <p className="font-medium truncate">{a.agentName}</p>
              <p className={`text-xs ${selected === a._id ? 'text-white/70' : 'text-slate-400'}`}>
                {a.totalEvals} evals · Score: {Math.round(a.avgFinal)}
              </p>
            </button>
          ))}
          {agents.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin datos</p>}
        </div>
      </div>

      {/* Agent detail */}
      <div className="col-span-3">
        {!d || !s ? (
          <div className="card text-center py-16 text-slate-400">Selecciona un agente para ver su reporte</div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="card flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{d.agent?.name}</h2>
                <p className="text-sm text-slate-500">{s.totalEvals} evaluaciones · {d.agent?.instance}</p>
              </div>
              <button onClick={exportPDF} disabled={exporting} className="btn-primary text-sm flex items-center gap-2">
                <Download size={16} /> {exporting ? 'Generando...' : 'Exportar PDF'}
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Score final', value: s.avgFinal, color: s.avgFinal >= 75 ? '#059669' : s.avgFinal >= 50 ? '#D97706' : '#DC2626' },
                { label: 'Cuantitativo', value: s.avgQuant, color: '#2563EB' },
                { label: 'Cualitativo', value: s.avgQual, color: '#7C3AED' },
                { label: 'Sentimiento', value: s.avgSentiment > 0 ? `+${s.avgSentiment}` : s.avgSentiment, color: s.avgSentiment >= 0 ? '#059669' : '#DC2626' },
              ].map(kpi => (
                <div key={kpi.label} className="card text-center py-3">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Scores breakdown */}
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Scores detallados</h3>
                {[
                  { label: 'Tono', val: s.avgTone }, { label: 'Empatía', val: s.avgEmpathy },
                  { label: 'Resolución', val: s.avgResolution }, { label: 'Profesionalismo', val: s.avgProfessionalism },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-slate-500 w-28">{item.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.val}%`, backgroundColor: item.val >= 75 ? '#059669' : item.val >= 50 ? '#D97706' : '#DC2626' }} />
                    </div>
                    <span className="text-sm font-mono font-semibold w-8 text-right" style={{ color: item.val >= 75 ? '#059669' : item.val >= 50 ? '#D97706' : '#DC2626' }}>{item.val}</span>
                  </div>
                ))}
              </div>

              {/* Grades */}
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribución de notas</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={gradeData} layout="horizontal">
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {gradeData.map(d => <Cell key={d.name} fill={GRADE_COLORS[d.name]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Coaching */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-sm font-semibold text-emerald-700 mb-2">Fortalezas recurrentes</h3>
                {d.coaching?.topStrengths?.map((s, i) => (
                  <p key={i} className="text-xs text-slate-600 py-1 flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> {s.text} <span className="text-slate-400">({s.count}x)</span></p>
                ))}
                {(!d.coaching?.topStrengths || d.coaching.topStrengths.length === 0) && <p className="text-xs text-slate-400">Sin datos</p>}
              </div>
              <div className="card">
                <h3 className="text-sm font-semibold text-amber-700 mb-2">Áreas de mejora recurrentes</h3>
                {d.coaching?.topImprovements?.map((s, i) => (
                  <p key={i} className="text-xs text-slate-600 py-1 flex items-start gap-2"><span className="text-amber-500 mt-0.5">→</span> {s.text} <span className="text-slate-400">({s.count}x)</span></p>
                ))}
                {(!d.coaching?.topImprovements || d.coaching.topImprovements.length === 0) && <p className="text-xs text-slate-400">Sin datos</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CATEGORIES REPORT
// ═══════════════════════════════════════════════
function CategoriesReport({ filters }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const params = {};
    if (filters.instance) params.instance = filters.instance;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    fetchAuth(`/reports/categories?${new URLSearchParams(params)}`)
      .then(r => r.json()).then(setData).catch(console.error);
  }, [filters]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Total categorías</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{data.length}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Total evaluaciones</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{total}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Score promedio</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {data.length > 0 ? Math.round(data.reduce((s, d) => s + d.avgScore * d.count, 0) / total) : '—'}
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Categorías por volumen y calidad</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">Categoría</th>
              <th className="pb-2 font-medium text-center">Cantidad</th>
              <th className="pb-2 font-medium text-center">%</th>
              <th className="pb-2 font-medium text-center">Score prom.</th>
              <th className="pb-2 font-medium text-center">Sent. prom.</th>
              <th className="pb-2 font-medium text-center">Alertas</th>
              <th className="pb-2 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {data.map(cat => (
              <tr key={cat._id || 'none'} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 text-sm font-medium text-slate-700">{cat._id || 'Sin categoría'}</td>
                <td className="py-2.5 text-center font-mono">{cat.count}</td>
                <td className="py-2.5 text-center text-slate-500">{total > 0 ? ((cat.count / total) * 100).toFixed(1) : 0}%</td>
                <td className="py-2.5 text-center">
                  <span className="font-semibold" style={{ color: cat.avgScore >= 75 ? '#059669' : cat.avgScore >= 50 ? '#D97706' : '#DC2626' }}>
                    {Math.round(cat.avgScore)}
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  <span style={{ color: cat.avgSentiment >= 0 ? '#059669' : '#DC2626' }}>
                    {cat.avgSentiment > 0 ? '+' : ''}{Math.round(cat.avgSentiment)}
                  </span>
                </td>
                <td className="py-2.5 text-center">{cat.alertCount > 0 ? <span className="text-red-600 font-semibold">{cat.alertCount}</span> : '—'}</td>
                <td className="py-2.5">
                  <div className="flex gap-1">
                    {['A', 'B', 'C', 'D', 'F'].map(g => {
                      const v = cat[`grade${g}`] || 0;
                      return v > 0 ? <span key={g} className={`badge grade-${g} text-[10px]`}>{g}:{v}</span> : null;
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SENTIMENT REPORT
// ═══════════════════════════════════════════════
function SentimentReport({ filters }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = {};
    if (filters.instance) params.instance = filters.instance;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    fetchAuth(`/reports/sentiment?${new URLSearchParams(params)}`)
      .then(r => r.json()).then(setData).catch(console.error);
  }, [filters]);

  if (!data) return <div className="card text-center py-12 text-slate-400">Cargando...</div>;

  const dist = data.distribution || [];
  const total = dist.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-4">
      {/* Distribution */}
      <div className="grid grid-cols-5 gap-3">
        {['muy_positivo', 'positivo', 'neutral', 'negativo', 'muy_negativo'].map(label => {
          const item = dist.find(d => d._id === label);
          const count = item?.count || 0;
          return (
            <div key={label} className="card text-center py-4">
              <p className="text-xs text-slate-500">{SENT_LABELS[label]}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: SENT_COLORS[label] }}>{count}</p>
              <p className="text-xs text-slate-400">{total > 0 ? ((count / total) * 100).toFixed(0) : 0}%</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribución</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dist.map(d => ({ name: SENT_LABELS[d._id] || d._id, value: d.count, fill: SENT_COLORS[d._id] || '#94A3B8' }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                {dist.map(d => <Cell key={d._id} fill={SENT_COLORS[d._id] || '#94A3B8'} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Sentimiento por día</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.timeline || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12 }} />
              <Line type="monotone" dataKey="avgSentiment" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} name="Sentimiento" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By agent */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Sentimiento por agente</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">Agente</th>
              <th className="pb-2 font-medium text-center">Evaluaciones</th>
              <th className="pb-2 font-medium text-center">Sent. prom.</th>
              <th className="pb-2 font-medium text-center">Positivos</th>
              <th className="pb-2 font-medium text-center">Negativos</th>
              <th className="pb-2 font-medium">Ratio +/-</th>
            </tr>
          </thead>
          <tbody>
            {(data.byAgent || []).map(a => (
              <tr key={a._id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 font-medium text-slate-700">{a.agentName}</td>
                <td className="py-2.5 text-center">{a.totalEvals}</td>
                <td className="py-2.5 text-center font-semibold" style={{ color: a.avgSentiment >= 0 ? '#059669' : '#DC2626' }}>
                  {a.avgSentiment > 0 ? '+' : ''}{Math.round(a.avgSentiment)}
                </td>
                <td className="py-2.5 text-center text-emerald-600">{a.positive}</td>
                <td className="py-2.5 text-center text-red-600">{a.negative}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${a.totalEvals > 0 ? (a.positive / a.totalEvals) * 100 : 0}%` }} />
                      <div className="h-full bg-red-500" style={{ width: `${a.totalEvals > 0 ? (a.negative / a.totalEvals) * 100 : 0}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// INCIDENTS REPORT
// ═══════════════════════════════════════════════
function IncidentsReport({ filters }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const params = {};
    if (filters.instance) params.instance = filters.instance;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    fetchAuth(`/reports/incidents?${new URLSearchParams(params)}`)
      .then(r => r.json()).then(setData).catch(console.error);
  }, [filters]);

  const TYPE_LABELS = {
    bank_outage: 'Caída de banco', platform_issue: 'Fallo plataforma', provider_down: 'Proveedor caído',
    high_demand: 'Alta demanda', maintenance: 'Mantenimiento', other: 'Otro',
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const getDuration = (s, e) => {
    if (!s || !e) return '';
    const ms = new Date(e) - new Date(s);
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Total incidentes</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{data.length}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Evaluaciones afectadas</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{data.reduce((s, d) => s + (d.affectedEvaluations || 0), 0)}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Score prom. afectadas</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {data.filter(d => d.avgScore).length > 0
              ? Math.round(data.filter(d => d.avgScore).reduce((s, d) => s + d.avgScore, 0) / data.filter(d => d.avgScore).length)
              : '—'}
          </p>
        </div>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">Incidente</th>
              <th className="pb-2 font-medium">Tipo</th>
              <th className="pb-2 font-medium">Instancia</th>
              <th className="pb-2 font-medium">Período</th>
              <th className="pb-2 font-medium text-center">Duración</th>
              <th className="pb-2 font-medium text-center">Relajación</th>
              <th className="pb-2 font-medium text-center">Evals afectadas</th>
              <th className="pb-2 font-medium text-center">Score prom.</th>
            </tr>
          </thead>
          <tbody>
            {data.map(inc => (
              <tr key={inc._id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5">
                  <p className="font-medium text-slate-700">{inc.title}</p>
                  {inc.description && <p className="text-xs text-slate-400 mt-0.5">{inc.description}</p>}
                </td>
                <td className="py-2.5"><span className="badge bg-slate-100 text-slate-600 text-[11px]">{TYPE_LABELS[inc.type] || inc.type}</span></td>
                <td className="py-2.5 text-slate-500">{inc.instance === 'all' ? 'Todas' : inc.instance}</td>
                <td className="py-2.5 text-xs text-slate-500">{formatDate(inc.startedAt)} → {formatDate(inc.endedAt)}</td>
                <td className="py-2.5 text-center text-xs">{getDuration(inc.startedAt, inc.endedAt)}</td>
                <td className="py-2.5 text-center"><span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">{inc.relaxFactor}x</span></td>
                <td className="py-2.5 text-center font-semibold">{inc.affectedEvaluations || 0}</td>
                <td className="py-2.5 text-center">{inc.avgScore ? <span style={{ color: inc.avgScore >= 75 ? '#059669' : '#D97706' }}>{inc.avgScore}</span> : '—'}</td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No hay incidentes registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CHANNELS REPORT
// ═══════════════════════════════════════════════
const COUNTRY_INFO = {
  VE: { label: 'Venezuela', flag: '🇻🇪', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  CL: { label: 'Chile', flag: '🇨🇱', color: 'bg-red-50 text-red-700 border-red-200' },
  PE: { label: 'Perú', flag: '🇵🇪', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  MX: { label: 'México', flag: '🇲🇽', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EC: { label: 'Ecuador', flag: '🇪🇨', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  INT: { label: 'Internacional', flag: '🌎', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const TYPE_ICONS = { website_chat: '💬', whatsapp: '📱', telegram: '✈️', facebook: '👤', instagram: '📷', google: '🔍', custom: '⚙️' };

function ChannelsReport({ filters }) {
  const [data, setData] = useState([]);
  const [filterCountry, setFilterCountry] = useState('');

  useEffect(() => {
    const params = {};
    if (filters.instance) params.instance = filters.instance;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filterCountry) params.country = filterCountry;
    fetchAuth(`/reports/channels?${new URLSearchParams(params)}`)
      .then(r => r.json()).then(setData).catch(console.error);
  }, [filters, filterCountry]);

  const totalConvs = data.reduce((s, d) => s + d.conversations, 0);
  const totalEvals = data.reduce((s, d) => s + d.evaluated, 0);

  // Group by country for summary
  const byCountry = {};
  data.forEach(d => {
    if (!byCountry[d.country]) byCountry[d.country] = { conversations: 0, evaluated: 0, scores: [] };
    byCountry[d.country].conversations += d.conversations;
    byCountry[d.country].evaluated += d.evaluated;
    if (d.avgScore) byCountry[d.country].scores.push(d.avgScore);
  });

  return (
    <div className="space-y-4">
      {/* Country summary cards */}
      <div className="grid grid-cols-6 gap-3">
        {Object.entries(COUNTRY_INFO).map(([code, info]) => {
          const stats = byCountry[code];
          if (!stats) return (
            <div key={code} className="card text-center py-3 opacity-40">
              <p className="text-lg">{info.flag}</p>
              <p className="text-xs text-slate-400 mt-1">{info.label}</p>
              <p className="text-xs text-slate-300">Sin datos</p>
            </div>
          );
          const avgScore = stats.scores.length > 0 ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) : null;
          return (
            <button key={code} onClick={() => setFilterCountry(filterCountry === code ? '' : code)}
              className={`card text-center py-3 cursor-pointer transition-all ${filterCountry === code ? 'ring-2 ring-jel-orange' : ''}`}>
              <p className="text-lg">{info.flag}</p>
              <p className="text-xs font-semibold text-slate-700 mt-1">{info.label}</p>
              <p className="text-lg font-bold text-slate-800">{stats.conversations}</p>
              <p className="text-xs text-slate-400">convs</p>
              {avgScore && <p className="text-xs font-semibold mt-1" style={{ color: avgScore >= 75 ? '#059669' : avgScore >= 50 ? '#D97706' : '#DC2626' }}>Score: {avgScore}</p>}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Canales activos</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{data.length}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Total conversaciones</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalConvs}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-slate-500">Evaluadas</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalEvals}</p>
        </div>
      </div>

      {/* Channel table */}
      <div className="card overflow-x-auto">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Detalle por canal {filterCountry && <span className="text-jel-orange">— {COUNTRY_INFO[filterCountry]?.flag} {COUNTRY_INFO[filterCountry]?.label}</span>}
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">Canal</th>
              <th className="pb-2 font-medium">País</th>
              <th className="pb-2 font-medium">Tipo</th>
              <th className="pb-2 font-medium text-center">Convs.</th>
              <th className="pb-2 font-medium text-center">Evaluadas</th>
              <th className="pb-2 font-medium text-center">Score</th>
              <th className="pb-2 font-medium text-center">Sent.</th>
              <th className="pb-2 font-medium text-center">Alertas</th>
              <th className="pb-2 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {data.map(ch => {
              const ci = COUNTRY_INFO[ch.country] || COUNTRY_INFO.INT;
              return (
                <tr key={ch.channelId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 font-medium text-slate-700">{ch.channelName}</td>
                  <td className="py-2.5"><span className={`badge border text-[11px] ${ci.color}`}>{ci.flag} {ch.country}</span></td>
                  <td className="py-2.5 text-xs text-slate-500">{TYPE_ICONS[ch.type] || '❓'} {ch.type}</td>
                  <td className="py-2.5 text-center font-mono">{ch.conversations}</td>
                  <td className="py-2.5 text-center font-mono text-emerald-600">{ch.evaluated}</td>
                  <td className="py-2.5 text-center">
                    <span className="font-semibold" style={{ color: ch.avgScore >= 75 ? '#059669' : ch.avgScore >= 50 ? '#D97706' : '#DC2626' }}>
                      {ch.avgScore}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">
                    <span style={{ color: ch.avgSentiment >= 0 ? '#059669' : '#DC2626' }}>
                      {ch.avgSentiment > 0 ? '+' : ''}{ch.avgSentiment}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">{ch.alertCount > 0 ? <span className="text-red-600 font-semibold">{ch.alertCount}</span> : '—'}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1">
                      {['A', 'B', 'C', 'D', 'F'].map(g => {
                        const v = ch.grades?.[g] || 0;
                        return v > 0 ? <span key={g} className={`badge grade-${g} text-[10px]`}>{g}:{v}</span> : null;
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">Sin datos para este período</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

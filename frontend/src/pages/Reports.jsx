import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, AlertTriangle, TrendingUp, MessageSquare } from 'lucide-react';
import { api, fetchAuth } from '../utils/api';

const SENT_COLORS = { muy_positivo: '#10B981', positivo: '#34D399', neutral: '#94A3B8', negativo: '#F59E0B', muy_negativo: '#EF4444' };
const GRADE_COLORS = { A: '#10B981', B: '#3B82F6', C: '#F59E0B', D: '#F97316', F: '#EF4444' };

function ScoreRing({ value, label, color = '#F97316', size = 72 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#334155" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize="18" fontWeight="600">{value}</text>
      </svg>
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState('');
  const [instance, setInstance] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [agentsSummary, setAgentsSummary] = useState([]);

  useEffect(() => { api.getAgents().then(setAgents).catch(() => {}); }, []);

  // Load agents summary on date change
  useEffect(() => {
    if (!dateFrom) return;
    const params = { dateFrom };
    if (dateTo) params.dateTo = dateTo;
    if (instance) params.instance = instance;
    fetchAuth(`/reports/agents-summary?${new URLSearchParams(params)}`)
      .then(r => r.json()).then(setAgentsSummary).catch(() => {});
  }, [dateFrom, dateTo, instance]);

  const loadReport = async () => {
    if (!agentId || !dateFrom) return;
    setLoading(true);
    try {
      const params = { agentId, dateFrom };
      if (dateTo) params.dateTo = dateTo;
      if (instance) params.instance = instance;
      const res = await fetchAuth(`/reports/agent-daily?${new URLSearchParams(params)}`);
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const s = report?.summary;
  const h = report?.highlights;
  const c = report?.coaching;

  const gradeData = s ? Object.entries(s.grades).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value })) : [];
  const sentData = s ? Object.entries(s.sentiments).filter(([,v]) => v > 0).map(([name, value]) => ({ name: name.replace('_', ' '), value, key: name })) : [];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Reportes por agente</h1>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1">Agente</label>
            <select className="select w-full text-sm" value={agentId} onChange={e => setAgentId(e.target.value)}>
              <option value="">Seleccionar agente...</option>
              {agents.map(a => <option key={a._id} value={a.respondioId}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Desde</label>
            <input type="date" className="input text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Hasta (opcional)</label>
            <input type="date" className="input text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Instancia</label>
            <select className="select text-sm" value={instance} onChange={e => setInstance(e.target.value)}>
              <option value="">Todas</option>
              <option value="venezuela">Venezuela</option>
              <option value="internacional">Internacional</option>
            </select>
          </div>
          <button className="btn-primary text-sm" onClick={loadReport} disabled={!agentId || loading}>
            {loading ? 'Generando...' : 'Generar reporte'}
          </button>
        </div>
      </div>

      {/* Agents overview table */}
      {!report && agentsSummary.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Resumen de agentes — {dateFrom}</h2>
          <div className="space-y-2">
            {agentsSummary.map(a => (
              <div
                key={a._id}
                className="flex items-center gap-4 py-2.5 px-3 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800"
                onClick={() => { setAgentId(a._id); }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.agentName}</p>
                  <p className="text-xs text-slate-500">{a.totalEvals} evaluaciones</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold" style={{ color: a.avgFinal >= 75 ? '#10B981' : a.avgFinal >= 50 ? '#F59E0B' : '#EF4444' }}>
                    {Math.round(a.avgFinal)}
                  </p>
                  <p className="text-[10px] text-slate-500">score</p>
                </div>
                <div className="text-center">
                  <p className={`text-sm ${a.avgSentiment > 0 ? 'text-emerald-400' : a.avgSentiment < -20 ? 'text-red-400' : 'text-slate-400'}`}>
                    {a.avgSentiment > 0 ? '+' : ''}{Math.round(a.avgSentiment || 0)}
                  </p>
                  <p className="text-[10px] text-slate-500">sentimiento</p>
                </div>
                {a.alertCount > 0 && (
                  <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">
                    {a.alertCount} alertas
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report */}
      {report && s && (
        <div>
          {/* Header */}
          <div className="card mb-4 flex items-center gap-6">
            <div>
              <h2 className="text-lg font-semibold">{report.agent?.name}</h2>
              <p className="text-sm text-slate-400">{dateFrom}{dateTo ? ` — ${dateTo}` : ''} · {s.totalEvals} conversaciones</p>
            </div>
            <div className="ml-auto flex gap-6">
              <ScoreRing value={s.avgFinal} label="Final" color={s.avgFinal >= 75 ? '#10B981' : s.avgFinal >= 50 ? '#F59E0B' : '#EF4444'} />
              <ScoreRing value={s.avgQuant} label="Cuantitativo" color="#F97316" />
              <ScoreRing value={s.avgQual} label="Cualitativo" color="#3B82F6" />
            </div>
          </div>

          {/* Detail scores + charts */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="card text-center">
              <p className="text-2xl font-semibold">{s.avgTone}</p>
              <p className="text-xs text-slate-400">Tono</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold">{s.avgEmpathy}</p>
              <p className="text-xs text-slate-400">Empatía</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold">{s.avgResolution}</p>
              <p className="text-xs text-slate-400">Resolución</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold">{s.avgProfessionalism}</p>
              <p className="text-xs text-slate-400">Profesionalismo</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Grades */}
            <div className="card">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Notas</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={gradeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #475569', borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {gradeData.map(d => <Cell key={d.name} fill={GRADE_COLORS[d.name]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sentiment */}
            <div className="card">
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                Sentimiento <span className={`ml-2 font-mono text-sm ${s.avgSentiment > 0 ? 'text-emerald-400' : s.avgSentiment < -20 ? 'text-red-400' : 'text-slate-400'}`}>
                  {s.avgSentiment > 0 ? '+' : ''}{s.avgSentiment}
                </span>
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={sentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                    {sentData.map(d => <Cell key={d.key} fill={SENT_COLORS[d.key]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #475569', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Categories */}
            <div className="card">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Categorías</h3>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {s.categoryBreakdown.map(c => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-mono text-slate-500">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {h.alerts.length > 0 && (
            <div className="card mb-4 border-red-500/30">
              <h3 className="text-sm font-medium text-red-400 flex items-center gap-2 mb-3">
                <AlertTriangle size={16} /> Chats que requieren atención ({h.alerts.length})
              </h3>
              <div className="space-y-2">
                {h.alerts.map(a => (
                  <div
                    key={a.conversationId}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg bg-red-500/5 cursor-pointer hover:bg-red-500/10"
                    onClick={() => navigate(`/evaluations/${a.conversationId}`)}
                  >
                    <span className="text-red-400">⚠</span>
                    <div className="flex-1">
                      <p className="text-sm">{a.reason}</p>
                      <p className="text-xs text-slate-500">Conv: ...{a.conversationId?.slice(-8)}</p>
                    </div>
                    <span className="text-sm font-mono text-red-400">{a.finalScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Coaching */}
            <div className="card">
              <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2 mb-3">
                <MessageSquare size={16} /> Coaching — áreas de mejora recurrentes
              </h3>
              {c.topImprovements.length > 0 ? (
                <div className="space-y-2">
                  {c.topImprovements.map((imp, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="badge bg-amber-500/20 text-amber-400 shrink-0">{imp.count}x</span>
                      <p className="text-sm text-slate-300">{imp.text}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">Sin datos suficientes</p>}

              {c.tips.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Tips específicos por chat:</p>
                  {c.tips.slice(0, 5).map((t, i) => (
                    <div key={i} className="py-1.5 flex items-start gap-2">
                      <span className={`badge grade-${t.grade} shrink-0`}>{t.grade}</span>
                      <p className="text-xs text-slate-300">{t.tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strengths + Best/Worst */}
            <div className="card">
              <h3 className="text-sm font-medium text-emerald-400 flex items-center gap-2 mb-3">
                <TrendingUp size={16} /> Fortalezas recurrentes
              </h3>
              {c.topStrengths.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {c.topStrengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="badge bg-emerald-500/20 text-emerald-400 shrink-0">{s.count}x</span>
                      <p className="text-sm text-slate-300">{s.text}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 mb-4">Sin datos suficientes</p>}

              <div className="border-t border-slate-700 pt-3">
                <p className="text-xs text-emerald-400 mb-2">Mejores chats:</p>
                {h.best.map(b => (
                  <div key={b.conversationId} className="py-1 flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 rounded px-1"
                    onClick={() => navigate(`/evaluations/${b.conversationId}`)}>
                    <span className="text-sm font-mono text-emerald-400">{b.finalScore}</span>
                    <span className="text-xs text-slate-400 flex-1 truncate">{b.summary}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-xs text-red-400 mb-2">Chats a revisar:</p>
                {h.worst.map(b => (
                  <div key={b.conversationId} className="py-1 flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 rounded px-1"
                    onClick={() => navigate(`/evaluations/${b.conversationId}`)}>
                    <span className="text-sm font-mono text-red-400">{b.finalScore}</span>
                    <span className="text-xs text-slate-400 flex-1 truncate">{b.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* All evaluations */}
          <div className="card">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Todas las conversaciones ({s.totalEvals})</h3>
            <div className="space-y-1">
              {report.evaluations.map(ev => (
                <div
                  key={ev.conversationId}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer hover:bg-slate-800/50 ${ev.needsAttention ? 'bg-red-500/5' : ''}`}
                  onClick={() => navigate(`/evaluations/${ev.conversationId}`)}
                >
                  <span className={`badge grade-${ev.grade}`}>{ev.grade}</span>
                  <span className="text-sm font-mono w-8">{ev.finalScore}</span>
                  <span className="text-base">
                    {ev.sentiment?.label === 'muy_positivo' ? '😊' :
                     ev.sentiment?.label === 'positivo' ? '🙂' :
                     ev.sentiment?.label === 'neutral' ? '😐' :
                     ev.sentiment?.label === 'negativo' ? '😠' :
                     ev.sentiment?.label === 'muy_negativo' ? '🤬' : '—'}
                  </span>
                  <span className="text-xs text-slate-400 flex-1 truncate">{ev.summary}</span>
                  <span className="text-xs text-slate-500 truncate max-w-[180px]">{ev.aiCategory || ''}</span>
                  {ev.needsAttention && <span className="text-red-400">⚠</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

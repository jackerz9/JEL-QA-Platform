import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, MessageSquare, Award } from 'lucide-react';
import { api } from '../utils/api';

const GRADE_COLORS = { A: '#10B981', B: '#3B82F6', C: '#F59E0B', D: '#F97316', F: '#EF4444' };

function KPICard({ icon: Icon, label, value, sub, color = 'text-jel-orange' }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color === 'text-jel-orange' ? 'bg-jel-orange/15' : 'bg-slate-700'}`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function GradeBadge({ grade }) {
  return <span className={`badge grade-${grade}`}>{grade}</span>;
}

export default function Dashboard() {
  const [instance, setInstance] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState(null);
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const filters = {};
  if (instance) filters.instance = instance;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getSummary(filters),
      api.getAgentStats(filters),
      api.getCategories(filters),
      api.getTimeline(filters),
    ])
      .then(([s, a, c, t]) => {
        setSummary(s);
        setAgents(a);
        setCategories(c);
        setTimeline(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [instance, dateFrom, dateTo]);

  const gradeData = summary
    ? [
        { name: 'A', value: summary.gradeA || 0 },
        { name: 'B', value: summary.gradeB || 0 },
        { name: 'C', value: summary.gradeC || 0 },
        { name: 'D', value: summary.gradeD || 0 },
        { name: 'F', value: summary.gradeF || 0 },
      ].filter(d => d.value > 0)
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex gap-3">
          <select className="select text-sm" value={instance} onChange={e => setInstance(e.target.value)}>
            <option value="">Todas las instancias</option>
            <option value="venezuela">Venezuela</option>
            <option value="internacional">Internacional</option>
          </select>
          <input type="date" className="input text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Cargando datos...</div>
      ) : !summary || summary.totalEvaluations === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-400 text-lg">No hay evaluaciones aún</p>
          <p className="text-slate-500 text-sm mt-2">Sube archivos CSV en la sección "Evaluar" para comenzar</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPICard icon={Award} label="Score promedio" value={Math.round(summary.avgFinalScore)} sub={`de ${summary.totalEvaluations} evaluaciones`} />
            <KPICard icon={TrendingUp} label="Cuantitativo" value={Math.round(summary.avgQuantitative)} sub="Métricas de tiempo" color="text-emerald-400" />
            <KPICard icon={MessageSquare} label="Cualitativo" value={Math.round(summary.avgQualitative)} sub="Análisis IA" color="text-blue-400" />
            <KPICard icon={Clock} label="1ra respuesta" value={Math.round(summary.avgFirstResponse)} sub="Score promedio" color="text-amber-400" />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Timeline */}
            <div className="card col-span-2">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Score por día</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #475569', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="avgScore" stroke="#F97316" strokeWidth={2} dot={{ r: 4 }} name="Score" />
                  <Line type="monotone" dataKey="avgQuantitative" stroke="#10B981" strokeWidth={1.5} dot={false} name="Cuantitativo" />
                  <Line type="monotone" dataKey="avgQualitative" stroke="#3B82F6" strokeWidth={1.5} dot={false} name="Cualitativo" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Grade distribution */}
            <div className="card">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Distribución de notas</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={gradeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {gradeData.map(d => (
                      <Cell key={d.name} fill={GRADE_COLORS[d.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #475569', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3 mt-2">
                {gradeData.map(d => (
                  <span key={d.name} className="text-xs text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: GRADE_COLORS[d.name] }} />
                    {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Agent ranking */}
            <div className="card">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Ranking de agentes</h3>
              <div className="space-y-2">
                {agents.map((a, i) => (
                  <div key={a._id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/50">
                    <span className="text-xs text-slate-500 w-5 text-center font-mono">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.agentName}</p>
                      <p className="text-xs text-slate-500">{a.totalEvals} evaluaciones</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold" style={{ color: a.avgFinalScore >= 75 ? '#10B981' : a.avgFinalScore >= 50 ? '#F59E0B' : '#EF4444' }}>
                        {Math.round(a.avgFinalScore)}
                      </p>
                    </div>
                    <div className="w-24">
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${a.avgFinalScore}%`,
                            backgroundColor: a.avgFinalScore >= 75 ? '#10B981' : a.avgFinalScore >= 50 ? '#F59E0B' : '#EF4444',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {agents.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Sin datos</p>}
              </div>
            </div>

            {/* Category distribution */}
            <div className="card">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Categorías más frecuentes</h3>
              <div className="space-y-2">
                {categories.slice(0, 10).map(c => (
                  <div key={c._id || 'sin-cat'} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c._id || 'Sin categoría'}</p>
                    </div>
                    <span className="text-sm font-mono text-slate-400">{c.count}</span>
                    <div className="w-20">
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-jel-orange rounded-full"
                          style={{ width: `${(c.count / (categories[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Sin datos</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

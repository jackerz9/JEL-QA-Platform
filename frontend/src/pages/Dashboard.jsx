import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area } from 'recharts';
import { TrendingUp, Clock, MessageSquare, Award, AlertTriangle } from 'lucide-react';
import { api, fetchAuth } from '../utils/api';

const GRADE_COLORS = { A: '#059669', B: '#2563EB', C: '#D97706', D: '#EA580C', F: '#DC2626' };
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function KPICard({ icon: Icon, label, value, sub, iconBg = 'bg-orange-50', iconColor = 'text-jel-orange' }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Heatmap component
function Heatmap({ data }) {
  // Build 7x24 matrix (days x hours)
  const matrix = {};
  let maxCount = 0;
  data.forEach(d => {
    const day = d._id.dayOfWeek; // 1=Sun, 7=Sat
    const hour = d._id.hour;
    const key = `${day}-${hour}`;
    matrix[key] = d.count;
    if (d.count > maxCount) maxCount = d.count;
  });

  // Reorder: Mon(2) to Sun(1)
  const dayOrder = [2, 3, 4, 5, 6, 7, 1];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getColor = (count) => {
    if (!count || count === 0) return '#F8FAFC';
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return '#DCFCE7';
    if (intensity < 0.5) return '#86EFAC';
    if (intensity < 0.75) return '#F97316';
    return '#DC2626';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex ml-10">
          {hours.map(h => (
            <div key={h} className="flex-1 text-center text-[9px] text-slate-400 font-mono">{String(h).padStart(2, '0')}</div>
          ))}
        </div>
        {/* Rows */}
        {dayOrder.map(day => (
          <div key={day} className="flex items-center gap-1 my-[2px]">
            <span className="w-9 text-[10px] text-slate-500 font-medium text-right">{DAY_NAMES[day - 1]}</span>
            <div className="flex flex-1 gap-[2px]">
              {hours.map(h => {
                const count = matrix[`${day}-${h}`] || 0;
                return (
                  <div
                    key={h}
                    className="flex-1 aspect-square rounded-sm transition-all hover:ring-2 hover:ring-slate-400 cursor-default"
                    style={{ backgroundColor: getColor(count), minHeight: '16px' }}
                    title={`${DAY_NAMES_FULL[day - 1]} ${String(h).padStart(2, '0')}:00 — ${count} conversaciones`}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-slate-400">
          <span>Menos</span>
          {['#F8FAFC', '#DCFCE7', '#86EFAC', '#F97316', '#DC2626'].map(c => (
            <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          <span>Más</span>
        </div>
      </div>
    </div>
  );
}

// Volume bar with color coding
function VolumeBarCustom(props) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  let fill = '#3B82F6'; // Weekday - blue
  if (payload.isWeekend) fill = '#8B5CF6'; // Weekend - purple
  if (payload.isAnomaly) fill = '#EF4444'; // Anomaly - red
  return <rect x={x} y={y} width={width} height={height} rx={3} fill={fill} />;
}

function VolumeTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const dayName = d.dayOfWeek ? DAY_NAMES_FULL[d.dayOfWeek - 1] : '';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700">{d.date} <span className="text-slate-400 font-normal">({dayName})</span></p>
      <p className="text-blue-600">{d.conversations} conversaciones</p>
      {d.avgScore && <p className="text-jel-orange">Score: {d.avgScore}</p>}
      {d.isAnomaly && <p className="text-red-600 text-xs mt-1">⚠ Volumen anómalo</p>}
      {d.isWeekend && <p className="text-purple-600 text-xs mt-1">Fin de semana</p>}
    </div>
  );
}

export default function Dashboard() {
  const [instance, setInstance] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState(null);
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [volume, setVolume] = useState({ data: [], avgVolume: 0 });
  const [loading, setLoading] = useState(true);

  const filters = {};
  if (instance) filters.instance = instance;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams(filters).toString();
    Promise.all([
      api.getSummary(filters),
      api.getAgentStats(filters),
      api.getCategories(filters),
      api.getTimeline(filters),
      fetchAuth(`/dashboard/heatmap?${qs}`).then(r => r.json()),
      fetchAuth(`/dashboard/volume?${qs}`).then(r => r.json()),
    ])
      .then(([s, a, c, t, h, v]) => {
        setSummary(s); setAgents(a); setCategories(c); setTimeline(t);
        setHeatmap(h); setVolume(v);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [instance, dateFrom, dateTo]);

  const gradeData = summary
    ? [
        { name: 'A', value: summary.gradeA || 0 }, { name: 'B', value: summary.gradeB || 0 },
        { name: 'C', value: summary.gradeC || 0 }, { name: 'D', value: summary.gradeD || 0 },
        { name: 'F', value: summary.gradeF || 0 },
      ].filter(d => d.value > 0)
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Resumen de calidad de atención</p>
        </div>
        <div className="flex gap-3">
          <select className="select" value={instance} onChange={e => setInstance(e.target.value)}>
            <option value="">Todas las instancias</option>
            <option value="venezuela">Venezuela</option>
            <option value="internacional">Internacional</option>
          </select>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Cargando datos...</div>
      ) : !summary || summary.totalEvaluations === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-500 text-lg">No hay evaluaciones aún</p>
          <p className="text-slate-400 text-sm mt-2">Sube archivos CSV en la sección "Evaluar" para comenzar</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPICard icon={Award} label="Score promedio" value={Math.round(summary.avgFinalScore)} sub={`de ${summary.totalEvaluations} evaluaciones`} />
            <KPICard icon={TrendingUp} label="Cuantitativo" value={Math.round(summary.avgQuantitative)} sub="Métricas de tiempo" iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <KPICard icon={MessageSquare} label="Cualitativo" value={Math.round(summary.avgQualitative)} sub="Análisis IA" iconBg="bg-blue-50" iconColor="text-blue-600" />
            <KPICard icon={Clock} label="1ra respuesta" value={Math.round(summary.avgFirstResponse)} sub="Score promedio" iconBg="bg-amber-50" iconColor="text-amber-600" />
          </div>

          {/* Sentiment + Alerts */}
          {(summary.avgSentiment !== undefined || summary.alertCount > 0) && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="kpi-card col-span-2">
                <div className="kpi-icon bg-violet-50"><MessageSquare size={20} className="text-violet-600" /></div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Sentimiento promedio</p>
                  <p className={`text-2xl font-bold mt-0.5 ${(summary.avgSentiment || 0) > 0 ? 'text-emerald-600' : (summary.avgSentiment || 0) < -20 ? 'text-red-600' : 'text-slate-600'}`}>
                    {(summary.avgSentiment || 0) > 0 ? '+' : ''}{Math.round(summary.avgSentiment || 0)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {summary.sentimentPositive || 0} positivos · {summary.sentimentNeutral || 0} neutrales · {summary.sentimentNegative || 0} negativos
                  </p>
                </div>
              </div>
              {summary.alertCount > 0 && (
                <div className="kpi-card col-span-2 border-red-200 bg-red-50/50">
                  <div className="kpi-icon bg-red-100"><AlertTriangle size={20} className="text-red-600" /></div>
                  <div>
                    <p className="text-xs text-red-600 font-medium">Chats con alerta</p>
                    <p className="text-2xl font-bold text-red-700 mt-0.5">{summary.alertCount}</p>
                    <p className="text-xs text-red-500 mt-0.5">Requieren revisión de supervisor</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ VOLUME + CORRELATION CHART ═══════ */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Volumen diario + Calidad</h3>
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Día normal</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Fin de semana</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> Anomalía</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-jel-orange" /> Score</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={volume.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => v?.slice(5)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94A3B8' }} label={{ value: 'Convs.', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94A3B8' } }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#F97316' }} label={{ value: 'Score', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#F97316' } }} />
                <Tooltip content={<VolumeTooltip />} />
                <Bar yAxisId="left" dataKey="conversations" shape={<VolumeBarCustom />} />
                <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#F97316" strokeWidth={2.5} dot={{ r: 3, fill: '#F97316' }} connectNulls />
                {/* Average line */}
                {volume.avgVolume > 0 && (
                  <Line yAxisId="left" dataKey={() => volume.avgVolume} stroke="#94A3B8" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Promedio" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ═══════ HEATMAP + GRADES ═══════ */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card col-span-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Horas pico</h3>
              <Heatmap data={heatmap} />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Distribución de notas</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={gradeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                    {gradeData.map(d => <Cell key={d.name} fill={GRADE_COLORS[d.name]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {gradeData.map(d => (
                  <span key={d.name} className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GRADE_COLORS[d.name] }} />
                    {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ SCORE TIMELINE ═══════ */}
          <div className="card mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Score por día</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => v?.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                <Line type="monotone" dataKey="avgScore" stroke="#F97316" strokeWidth={2.5} dot={{ r: 4, fill: '#F97316' }} name="Score" />
                <Line type="monotone" dataKey="avgQuantitative" stroke="#059669" strokeWidth={1.5} dot={false} name="Cuantitativo" />
                <Line type="monotone" dataKey="avgQualitative" stroke="#2563EB" strokeWidth={1.5} dot={false} name="Cualitativo" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ═══════ AGENTS + CATEGORIES ═══════ */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Desempeño por agente</h3>
              <div className="space-y-2">
                {agents.map((a, i) => (
                  <div key={a._id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                    <span className="text-xs text-slate-400 w-5 text-center font-mono font-semibold">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{a.agentName}</p>
                      <p className="text-xs text-slate-400">{a.totalEvals} evaluaciones</p>
                    </div>
                    <p className="text-xl font-bold" style={{ color: a.avgFinalScore >= 75 ? '#059669' : a.avgFinalScore >= 50 ? '#D97706' : '#DC2626' }}>
                      {Math.round(a.avgFinalScore)}
                    </p>
                    <div className="w-20">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.avgFinalScore}%`, backgroundColor: a.avgFinalScore >= 75 ? '#059669' : a.avgFinalScore >= 50 ? '#D97706' : '#DC2626' }} />
                      </div>
                    </div>
                  </div>
                ))}
                {agents.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin datos</p>}
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Categorías más frecuentes</h3>
              <div className="space-y-2">
                {categories.slice(0, 10).map(c => (
                  <div key={c._id || 'sin-cat'} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{c._id || 'Sin categoría'}</p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-slate-500">{c.count}</span>
                    <div className="w-20">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-jel-orange rounded-full" style={{ width: `${(c.count / (categories[0]?.count || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin datos</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

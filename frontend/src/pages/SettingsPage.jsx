import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async (section, data) => {
    setSaving(true);
    setSaved('');
    try {
      const res = await fetch(`/api/settings/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      setSettings(updated);
      setSaved(section);
      setTimeout(() => setSaved(''), 2000);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('¿Restaurar toda la configuración a valores por defecto? Esto no se puede deshacer.')) return;
    const res = await fetch('/api/settings/reset', { method: 'POST' });
    const updated = await res.json();
    setSettings(updated);
    setSaved('reset');
    setTimeout(() => setSaved(''), 2000);
  };

  const update = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const updateNested = (section, parent, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parent]: { ...prev[section]?.[parent], [key]: value },
      },
    }));
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Cargando configuración...</div>;
  if (!settings) return <div className="text-center py-20 text-slate-500">Error cargando configuración</div>;

  const f = settings.filters || {};
  const w = settings.weights || {};
  const ai = settings.ai || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <SettingsIcon size={20} /> Configuración de evaluaciones
        </h1>
        <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={reset}>
          <RotateCcw size={14} /> Restaurar por defecto
        </button>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          Configuración guardada correctamente
        </div>
      )}

      {/* ═══ FILTROS ═══ */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium">Filtros de evaluación</h2>
            <p className="text-xs text-slate-500 mt-0.5">Qué conversaciones se evalúan y cuáles se omiten</p>
          </div>
          <button
            className="btn-primary text-sm flex items-center gap-1.5"
            onClick={() => save('filters', f)}
            disabled={saving}
          >
            <Save size={14} /> {saved === 'filters' ? 'Guardado' : 'Guardar filtros'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Mínimo de mensajes totales</label>
            <input
              type="number" min="0" max="50" className="input w-full text-sm"
              value={f.minTotalMessages ?? 3}
              onChange={e => update('filters', 'minTotalMessages', parseInt(e.target.value) || 0)}
            />
            <p className="text-[11px] text-slate-600 mt-1">Conversaciones con menos mensajes se omiten. Recomendado: 3</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Mínimo de mensajes del agente</label>
            <input
              type="number" min="0" max="50" className="input w-full text-sm"
              value={f.minAgentMessages ?? 1}
              onChange={e => update('filters', 'minAgentMessages', parseInt(e.target.value) || 0)}
            />
            <p className="text-[11px] text-slate-600 mt-1">Omite chats donde el agente no participó. Recomendado: 1</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="excludeBotOnly"
              checked={f.excludeBotOnly ?? true}
              onChange={e => update('filters', 'excludeBotOnly', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-jel-navy accent-jel-orange"
            />
            <label htmlFor="excludeBotOnly" className="text-sm text-slate-300">Excluir conversaciones solo-bot (sin agente humano)</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="excludeUnresolved"
              checked={f.excludeUnresolved ?? false}
              onChange={e => update('filters', 'excludeUnresolved', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-jel-navy accent-jel-orange"
            />
            <label htmlFor="excludeUnresolved" className="text-sm text-slate-300">Excluir conversaciones no resueltas</label>
          </div>
        </div>
      </div>

      {/* ═══ PONDERACIONES ═══ */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium">Ponderaciones del score</h2>
            <p className="text-xs text-slate-500 mt-0.5">Cómo se calcula el score final y los umbrales de cada métrica</p>
          </div>
          <button
            className="btn-primary text-sm flex items-center gap-1.5"
            onClick={() => save('weights', w)}
            disabled={saving}
          >
            <Save size={14} /> {saved === 'weights' ? 'Guardado' : 'Guardar pesos'}
          </button>
        </div>

        {/* Main weights */}
        <div className="mb-6">
          <h3 className="text-sm text-slate-400 mb-3">Score final = Cuantitativo × peso + Cualitativo × peso</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Peso cuantitativo (%)</label>
              <input
                type="number" min="0" max="100" className="input w-full text-sm"
                value={w.quantitativeWeight ?? 60}
                onChange={e => {
                  const v = parseInt(e.target.value) || 0;
                  update('weights', 'quantitativeWeight', v);
                  update('weights', 'qualitativeWeight', 100 - v);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Peso cualitativo (%)</label>
              <input
                type="number" min="0" max="100" className="input w-full text-sm"
                value={w.qualitativeWeight ?? 40}
                onChange={e => {
                  const v = parseInt(e.target.value) || 0;
                  update('weights', 'qualitativeWeight', v);
                  update('weights', 'quantitativeWeight', 100 - v);
                }}
              />
            </div>
          </div>
          <div className="mt-2 h-3 bg-slate-700 rounded-full overflow-hidden flex">
            <div className="bg-jel-orange transition-all" style={{ width: `${w.quantitativeWeight ?? 60}%` }} />
            <div className="bg-blue-500 transition-all" style={{ width: `${w.qualitativeWeight ?? 40}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[11px] text-slate-500">
            <span>Cuantitativo {w.quantitativeWeight ?? 60}%</span>
            <span>Cualitativo {w.qualitativeWeight ?? 40}%</span>
          </div>
        </div>

        {/* Sub-weights */}
        <div className="mb-6">
          <h3 className="text-sm text-slate-400 mb-3">Sub-pesos cuantitativos (deben sumar 100)</h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { key: 'firstResponseWeight', label: '1ra respuesta', def: 30 },
              { key: 'resolutionTimeWeight', label: 'Resolución', def: 25 },
              { key: 'responseRatioWeight', label: 'Ratio resp.', def: 20 },
              { key: 'avgResponseTimeWeight', label: 'Prom. resp.', def: 15 },
              { key: 'messageEfficiencyWeight', label: 'Eficiencia', def: 10 },
            ].map(({ key, label, def }) => (
              <div key={key}>
                <label className="text-[11px] text-slate-400 block mb-1">{label}</label>
                <input
                  type="number" min="0" max="100" className="input w-full text-sm"
                  value={w[key] ?? def}
                  onChange={e => update('weights', key, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Total: {(w.firstResponseWeight ?? 30) + (w.resolutionTimeWeight ?? 25) + (w.responseRatioWeight ?? 20) + (w.avgResponseTimeWeight ?? 15) + (w.messageEfficiencyWeight ?? 10)}%
            {((w.firstResponseWeight ?? 30) + (w.resolutionTimeWeight ?? 25) + (w.responseRatioWeight ?? 20) + (w.avgResponseTimeWeight ?? 15) + (w.messageEfficiencyWeight ?? 10)) !== 100 &&
              <span className="text-red-400 ml-2">Debe sumar 100</span>
            }
          </p>
        </div>

        {/* Grade thresholds */}
        <div>
          <h3 className="text-sm text-slate-400 mb-3">Umbrales de notas (score mínimo para cada nota)</h3>
          <div className="grid grid-cols-4 gap-3">
            {['A', 'B', 'C', 'D'].map(g => (
              <div key={g}>
                <label className="text-xs text-slate-400 block mb-1">Nota {g} ≥</label>
                <input
                  type="number" min="0" max="100" className="input w-full text-sm"
                  value={w.grades?.[g] ?? { A: 90, B: 75, C: 60, D: 40 }[g]}
                  onChange={e => updateNested('weights', 'grades', g, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">Nota F = todo lo que esté por debajo de D</p>
        </div>
      </div>

      {/* ═══ CONFIGURACIÓN IA ═══ */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium">Configuración de IA (DeepSeek)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Instrucciones y parámetros para la evaluación cualitativa</p>
          </div>
          <button
            className="btn-primary text-sm flex items-center gap-1.5"
            onClick={() => save('ai', ai)}
            disabled={saving}
          >
            <Save size={14} /> {saved === 'ai' ? 'Guardado' : 'Guardar IA'}
          </button>
        </div>

        {/* Model params */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Modelo</label>
            <select className="select w-full text-sm" value={ai.model || 'deepseek-chat'} onChange={e => update('ai', 'model', e.target.value)}>
              <option value="deepseek-chat">deepseek-chat</option>
              <option value="deepseek-reasoner">deepseek-reasoner</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Max tokens</label>
            <input type="number" min="500" max="4000" className="input w-full text-sm" value={ai.maxTokens || 1000} onChange={e => update('ai', 'maxTokens', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Temperatura</label>
            <input type="number" min="0" max="1" step="0.1" className="input w-full text-sm" value={ai.temperature || 0.3} onChange={e => update('ai', 'temperature', parseFloat(e.target.value))} />
            <p className="text-[11px] text-slate-600 mt-1">0 = determinista, 1 = creativo</p>
          </div>
        </div>

        {/* Context */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1">Contexto de la empresa</label>
          <textarea
            className="input w-full text-sm h-24 resize-y"
            value={ai.companyContext || ''}
            onChange={e => update('ai', 'companyContext', e.target.value)}
            placeholder="Describe tu empresa, qué hace, qué productos ofrece..."
          />
          <p className="text-[11px] text-slate-600 mt-1">Se incluye al inicio del prompt para darle contexto a la IA</p>
        </div>

        {/* Treatment rules */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1">Reglas de trato al cliente</label>
          <textarea
            className="input w-full text-sm h-20 resize-y"
            value={ai.treatmentRules || ''}
            onChange={e => update('ai', 'treatmentRules', e.target.value)}
            placeholder="Ej: Usar usted, saludar siempre, ser cordial..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Qué penalizar</label>
            <textarea
              className="input w-full text-sm h-28 resize-y"
              value={ai.penalize || ''}
              onChange={e => update('ai', 'penalize', e.target.value)}
              placeholder="Comportamientos que bajan el score..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Qué premiar</label>
            <textarea
              className="input w-full text-sm h-28 resize-y"
              value={ai.reward || ''}
              onChange={e => update('ai', 'reward', e.target.value)}
              placeholder="Comportamientos que suben el score..."
            />
          </div>
        </div>

        {/* Attention criteria */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Criterios para "Requiere atención"</label>
          <textarea
            className="input w-full text-sm h-20 resize-y"
            value={ai.attentionCriteria || ''}
            onChange={e => update('ai', 'attentionCriteria', e.target.value)}
            placeholder="Cuándo marcar un chat como alerta para el supervisor..."
          />
        </div>
      </div>
    </div>
  );
}

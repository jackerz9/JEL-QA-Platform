import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bot, MessageSquare } from 'lucide-react';
import { api } from '../utils/api';

function ScoreBar({ label, score, max = 100 }) {
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${(score / max) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-mono w-8 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

function ChatBubble({ msg }) {
  const isAgent = msg.senderType === 'user';
  const isBot = msg.senderType === 'workflow';
  const isContact = msg.senderType === 'contact';
  const text = msg.content?.text || msg.rawContent || '';
  const time = new Date(msg.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (msg.senderType === 'echo') return null;

  return (
    <div className={`flex gap-2 ${isContact ? 'justify-start' : 'justify-end'}`}>
      {isContact && (
        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1">
          <User size={14} className="text-slate-400" />
        </div>
      )}
      <div className={`max-w-[70%] ${isContact ? '' : 'order-first'}`}>
        <div
          className={`rounded-xl px-3.5 py-2 text-sm leading-relaxed ${
            isContact
              ? 'bg-slate-700 text-gray-200 rounded-tl-sm'
              : isBot
              ? 'bg-slate-600 text-gray-300 rounded-tr-sm'
              : 'bg-jel-orange/20 text-orange-100 rounded-tr-sm'
          }`}
        >
          {text}
        </div>
        <p className={`text-[10px] text-slate-600 mt-0.5 ${isContact ? '' : 'text-right'}`}>
          {isBot ? 'Bot' : isAgent ? 'Agente' : 'Cliente'} · {time}
        </p>
      </div>
      {!isContact && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${isBot ? 'bg-slate-600' : 'bg-jel-orange/30'}`}>
          {isBot ? <Bot size={14} className="text-slate-300" /> : <MessageSquare size={14} className="text-jel-orange" />}
        </div>
      )}
    </div>
  );
}

export default function EvaluationDetail() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reevaling, setReevaling] = useState(false);

  const loadData = () => {
    setLoading(true);
    api.getEvaluationDetail(conversationId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [conversationId]);

  const handleReevaluate = async () => {
    if (!confirm('¿Re-evaluar esta conversación con DeepSeek? Esto reemplazará los scores actuales.')) return;
    setReevaling(true);
    try {
      await fetch(`/api/evaluations/${conversationId}/reevaluate`, { method: 'POST' });
      loadData();
    } catch (err) {
      alert('Error al re-evaluar: ' + err.message);
    } finally {
      setReevaling(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Cargando...</div>;
  if (!data) return <div className="text-center py-20 text-slate-500">Evaluación no encontrada</div>;

  const { evaluation: ev, conversation: conv, messages, agentName } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-gray-200">
          <ArrowLeft size={16} /> Volver
        </button>
        <button
          className="btn-secondary text-xs flex items-center gap-1.5"
          onClick={handleReevaluate}
          disabled={reevaling}
        >
          {reevaling ? '⟳ Evaluando...' : '⟳ Re-evaluar con IA'}
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold grade-${ev.grade}`}>
          {ev.grade}
        </div>
        <div>
          <h1 className="text-lg font-semibold">{agentName}</h1>
          <p className="text-sm text-slate-400">
            {conv?.respondioCategory || 'Sin categoría'} · {new Date(conv?.startedAt).toLocaleString('es-CL')}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-3xl font-bold" style={{ color: ev.finalScore >= 75 ? '#10B981' : ev.finalScore >= 50 ? '#F59E0B' : '#EF4444' }}>
            {ev.finalScore}
          </p>
          <p className="text-xs text-slate-500">Score final</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Chat */}
        <div className="col-span-2 card max-h-[600px] overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Conversación</h3>
          <div className="space-y-3">
            {messages.map(msg => <ChatBubble key={msg._id || msg.messageId} msg={msg} />)}
            {messages.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Sin mensajes</p>}
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-4">
          {/* Quantitative */}
          <div className="card">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Cuantitativo <span className="text-jel-orange font-mono ml-2">{ev.quantitative?.totalScore}</span>
            </h3>
            <div className="space-y-2.5">
              <ScoreBar label="1ra respuesta" score={ev.quantitative?.firstResponseScore || 0} />
              <ScoreBar label="Resolución" score={ev.quantitative?.resolutionTimeScore || 0} />
              <ScoreBar label="Ratio resp." score={ev.quantitative?.responseRatioScore || 0} />
              <ScoreBar label="Eficiencia" score={ev.quantitative?.messageCountScore || 0} />
            </div>
          </div>

          {/* Qualitative */}
          <div className="card">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Cualitativo (IA) <span className="text-blue-400 font-mono ml-2">{ev.qualitative?.totalScore}</span>
            </h3>
            <div className="space-y-2.5">
              <ScoreBar label="Tono" score={ev.qualitative?.toneScore || 0} />
              <ScoreBar label="Empatía" score={ev.qualitative?.empathyScore || 0} />
              <ScoreBar label="Resolución" score={ev.qualitative?.resolutionScore || 0} />
              <ScoreBar label="Profesional" score={ev.qualitative?.professionalismScore || 0} />
            </div>
          </div>

          {/* AI Summary */}
          <div className="card">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Resumen IA</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{ev.qualitative?.summary || 'Sin resumen'}</p>

            {ev.qualitative?.strengths?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-emerald-400 font-medium mb-1">Fortalezas</p>
                {ev.qualitative.strengths.map((s, i) => (
                  <p key={i} className="text-xs text-slate-400 ml-2">• {s}</p>
                ))}
              </div>
            )}

            {ev.qualitative?.improvements?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-amber-400 font-medium mb-1">Áreas de mejora</p>
                {ev.qualitative.improvements.map((s, i) => (
                  <p key={i} className="text-xs text-slate-400 ml-2">• {s}</p>
                ))}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="card text-xs text-slate-500 space-y-1">
            <p>ID: {ev.conversationId}</p>
            <p>Contacto: {ev.contactId}</p>
            <p>Canal: {conv?.openedByChannel}</p>
            <p>1ra resp: {conv?.firstResponseTime}</p>
            <p>Resolución: {conv?.resolutionTime}</p>
            <p>Msgs: {conv?.outgoingMessages} out / {conv?.incomingMessages} in</p>
          </div>
        </div>
      </div>
    </div>
  );
}

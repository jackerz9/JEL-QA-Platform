import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, User, Bot, MessageSquare } from 'lucide-react';
import { api } from '../utils/api';

function ScoreBar({ label, score, max = 100 }) {
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
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
  const d = new Date(msg.timestamp);
  const time = `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`;

  if (msg.senderType === 'echo') return null;

  // Parse content - handle text, attachments, images
  const content = msg.content || {};
  let text = content.text || '';
  let attachment = content.attachment || null;
  let imageUrl = null;
  let fileUrl = null;
  let fileName = null;

  // If content is a raw string, try parsing
  if (!text && msg.rawContent) {
    try {
      const parsed = JSON.parse(msg.rawContent);
      text = parsed.text || '';
      attachment = parsed.attachment || null;
    } catch {
      text = msg.rawContent;
    }
  }

  // Extract image/file from attachment
  if (attachment) {
    if (attachment.type === 'image' && attachment.url) {
      imageUrl = attachment.url;
    } else if (attachment.type === 'video' && attachment.url) {
      fileUrl = attachment.url;
      fileName = 'Video adjunto';
    } else if (attachment.type === 'file' && attachment.url) {
      fileUrl = attachment.url;
      fileName = attachment.fileName || 'Archivo adjunto';
    } else if (attachment.url) {
      // Generic attachment with URL
      const url = attachment.url;
      if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
        imageUrl = url;
      } else {
        fileUrl = url;
        fileName = attachment.fileName || 'Archivo adjunto';
      }
    }
  }

  const bubbleClass = isContact
    ? 'bg-slate-100 text-slate-700 rounded-tl-sm'
    : isBot
    ? 'bg-slate-100 text-slate-600 rounded-tr-sm'
    : 'bg-orange-50 text-orange-800 rounded-tr-sm border border-orange-100';

  return (
    <div className={`flex gap-2 ${isContact ? 'justify-start' : 'justify-end'}`}>
      {isContact && (
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
          <User size={14} className="text-slate-500" />
        </div>
      )}
      <div className={`max-w-[70%] ${isContact ? '' : 'order-first'}`}>
        <div className={`rounded-xl overflow-hidden ${!imageUrl ? 'px-3.5 py-2' : 'p-1'} text-sm leading-relaxed ${bubbleClass}`}>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={imageUrl}
                alt="Imagen adjunta"
                className="rounded-lg max-w-full max-h-[240px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span style={{ display: 'none' }} className="text-xs text-slate-500 px-2 py-1 block">Imagen no disponible</span>
            </a>
          )}
          {fileUrl && !imageUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
              <span className="text-lg">📎</span>
              <span className="text-sm">{fileName}</span>
            </a>
          )}
          {text && <p className={imageUrl ? 'px-2.5 py-1.5 text-sm' : ''}>{text}</p>}
          {!text && !imageUrl && !fileUrl && (
            <p className="text-xs text-slate-500 italic">Contenido no disponible</p>
          )}
        </div>
        <p className={`text-[10px] text-slate-500 mt-0.5 ${isContact ? '' : 'text-right'}`}>
          {isBot ? 'Bot' : isAgent ? 'Agente' : 'Cliente'} · {time}
        </p>
      </div>
      {!isContact && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${isBot ? 'bg-slate-200' : 'bg-orange-100'}`}>
          {isBot ? <Bot size={14} className="text-slate-600" /> : <MessageSquare size={14} className="text-jel-orange" />}
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

  // Navigation list from sessionStorage
  const evalList = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('evalList') || '[]'); }
    catch { return []; }
  }, []);
  const currentIndex = evalList.indexOf(conversationId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < evalList.length - 1;
  const goPrev = () => { if (hasPrev) navigate(`/evaluations/${evalList[currentIndex - 1]}`); };
  const goNext = () => { if (hasNext) navigate(`/evaluations/${evalList[currentIndex + 1]}`); };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && hasPrev) goPrev();
      if (e.key === 'ArrowRight' && hasNext) goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, evalList]);

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
      await fetch(`/api/evaluations/${conversationId}/reevaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('jel_token')}` },
      });
      loadData();
    } catch (err) {
      alert('Error al re-evaluar: ' + err.message);
    } finally {
      setReevaling(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Cargando...</div>;
  if (!data) return <div className="text-center py-20 text-slate-500">Evaluación no encontrada</div>;

  const { evaluation: ev, conversation: conv, messages, agentName, channelName } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/evaluations')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Volver a lista
        </button>
        <div className="flex items-center gap-2">
          {/* Prev/Next navigation */}
          {evalList.length > 1 && (
            <div className="flex items-center gap-1 mr-3">
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed"
                title="Anterior (←)"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs text-slate-500 min-w-[50px] text-center">
                {currentIndex + 1} / {evalList.length}
              </span>
              <button
                onClick={goNext}
                disabled={!hasNext}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed"
                title="Siguiente (→)"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          <button
            className="btn-secondary text-xs flex items-center gap-1.5"
            onClick={handleReevaluate}
            disabled={reevaling}
          >
            {reevaling ? '⟳ Evaluando...' : '⟳ Re-evaluar con IA'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold grade-${ev.grade}`}>
          {ev.grade}
        </div>
        <div>
          <h1 className="text-lg font-semibold">{agentName}</h1>
          <p className="text-sm text-slate-500">
            {conv?.respondioCategory || 'Sin categoría'} · {channelName} · {new Date(conv?.startedAt).toLocaleString('es-CL')}
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
          <h3 className="text-sm font-medium text-slate-600 mb-4">Conversación</h3>
          <div className="space-y-3">
            {messages.map(msg => <ChatBubble key={msg._id || msg.messageId} msg={msg} />)}
            {messages.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Sin mensajes</p>}
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-4">
          {/* Attention alert */}
          {ev.needsAttention && (
            <div className="card border-red-300 bg-red-50/50">
              <div className="flex items-start gap-2">
                <span className="text-red-600 text-lg leading-none">⚠</span>
                <div>
                  <p className="text-sm font-medium text-red-600">Requiere atención</p>
                  <p className="text-xs text-slate-500 mt-1">{ev.attentionReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sentiment */}
          {ev.sentiment?.label && (
            <div className="card">
              <h3 className="text-sm font-medium text-slate-600 mb-3">Sentimiento del cliente</h3>
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {ev.sentiment.label === 'muy_positivo' ? '😊' :
                   ev.sentiment.label === 'positivo' ? '🙂' :
                   ev.sentiment.label === 'neutral' ? '😐' :
                   ev.sentiment.label === 'negativo' ? '😠' : '🤬'}
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium capitalize ${
                    ev.sentiment.score > 30 ? 'text-emerald-600' :
                    ev.sentiment.score > -30 ? 'text-slate-600' : 'text-red-600'
                  }`}>
                    {ev.sentiment.label.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">{ev.sentiment.detail}</p>
                </div>
                <span className={`text-lg font-mono font-semibold ${
                  ev.sentiment.score > 30 ? 'text-emerald-600' :
                  ev.sentiment.score > -30 ? 'text-slate-500' : 'text-red-600'
                }`}>
                  {ev.sentiment.score > 0 ? '+' : ''}{ev.sentiment.score}
                </span>
              </div>
            </div>
          )}

          {/* AI Category */}
          {(ev.aiCategory || ev.aiSubCategory) && (
            <div className="card">
              <h3 className="text-sm font-medium text-slate-600 mb-2">Categoría IA</h3>
              <p className="text-xs text-jel-orange">{ev.aiCategory || 'Sin categoría'}</p>
              {ev.aiSubCategory && (
                <p className="text-xs text-slate-500 mt-1">Sub: {ev.aiSubCategory}</p>
              )}
              {ev.aiCategoryConfidence > 0 && (
                <div className="mt-2">
                  <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-jel-orange rounded-full" style={{ width: `${ev.aiCategoryConfidence * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">Confianza: {Math.round(ev.aiCategoryConfidence * 100)}%</p>
                </div>
              )}
            </div>
          )}

          {/* Quantitative */}
          <div className="card">
            <h3 className="text-sm font-medium text-slate-600 mb-3">
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
            <h3 className="text-sm font-medium text-slate-600 mb-3">
              Cualitativo (IA) <span className="text-blue-600 font-mono ml-2">{ev.qualitative?.totalScore}</span>
            </h3>
            <div className="space-y-2.5">
              <ScoreBar label="Tono" score={ev.qualitative?.toneScore || 0} />
              <ScoreBar label="Empatía" score={ev.qualitative?.empathyScore || 0} />
              <ScoreBar label="Resolución" score={ev.qualitative?.resolutionScore || 0} />
              <ScoreBar label="Profesional" score={ev.qualitative?.professionalismScore || 0} />
            </div>
          </div>

          {/* AI Summary + Coaching */}
          <div className="card">
            <h3 className="text-sm font-medium text-slate-600 mb-3">Resumen IA</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{ev.qualitative?.summary || 'Sin resumen'}</p>

            {ev.coachingTip && (
              <div className="mt-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-1">Tip de coaching</p>
                <p className="text-xs text-slate-600">{ev.coachingTip}</p>
              </div>
            )}

            {ev.qualitative?.strengths?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-emerald-600 font-medium mb-1">Fortalezas</p>
                {ev.qualitative.strengths.map((s, i) => (
                  <p key={i} className="text-xs text-slate-500 ml-2">• {s}</p>
                ))}
              </div>
            )}

            {ev.qualitative?.improvements?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-amber-600 font-medium mb-1">Áreas de mejora</p>
                {ev.qualitative.improvements.map((s, i) => (
                  <p key={i} className="text-xs text-slate-500 ml-2">• {s}</p>
                ))}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="card text-xs text-slate-500 space-y-1">
            <p>ID: {ev.conversationId}</p>
            <p>Contacto: {ev.contactId}</p>
            <p>Canal: {channelName}</p>
            <p>1ra resp: {conv?.firstResponseTime}</p>
            <p>Resolución: {conv?.resolutionTime}</p>
            <p>Msgs: {conv?.outgoingMessages} out / {conv?.incomingMessages} in</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { AppState, Subject, Topic } from '../types';
import { BrainCircuit, Play, FastForward, CheckSquare, RefreshCw, Send, ArrowLeft, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TutorViewProps {
  activeTopicId: number | null;
  setActiveTopic: (id: number | null) => void;
  setCurrentView: (view: AppState['currentView']) => void;
}

export const TutorView: React.FC<TutorViewProps> = ({ activeTopicId, setActiveTopic, setCurrentView }) => {
  const { getToken } = useAuth();
  const [chatLog, setChatLog] = useState<{role: 'tutor'|'user', content: string}[]>([
    {
      role: 'tutor', 
      content: 'Olá! Sou o seu Learn-Anything Tutor. Estou configurado para te ajudar a dominar todo o edital da Receita Federal. O que vamos estudar hoje?'
    }
  ]);
  const [input, setInput] = useState('');
  const [topicDetails, setTopicDetails] = useState<{subject: Subject, topic: Topic} | null>(null);
  const [mastery, setMastery] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!activeTopicId) return;
      const token = await getToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      const [syllabusRes, progressRes] = await Promise.all([
        fetch('/api/syllabus', { headers }),
        fetch('/api/progress', { headers })
      ]);

      if (syllabusRes.ok && progressRes.ok) {
        const syllabus = await syllabusRes.json();
        const prog = await progressRes.json();

        let found = null;
        for (const sub of syllabus) {
          const t = sub.topics.find((x: any) => x.id === activeTopicId);
          if (t) {
            found = { subject: sub, topic: t };
            break;
          }
        }
        setTopicDetails(found);

        const p = prog.find((x: any) => x.topicId === activeTopicId);
        if (p) {
          setMastery(p.masteryLevel);
        }
        
        if (found && chatLog.length === 1) {
          setChatLog([
            {
              role: 'tutor', 
              content: 'Olá! Sou o seu Learn-Anything Tutor. Estou configurado para te ajudar a dominar todo o edital da Receita Federal. O que vamos estudar hoje?'
            },
            { role: 'user', content: `Quero estudar: ${found.topic.title}` },
            { role: 'tutor', content: `Excelente escolha. Vamos começar com o tópico "${found.topic.title}" da matéria de ${found.subject.title}.\n\nPasso 1: Entendendo o Porquê.\nAntes de irmos para a teoria, sabe por que a banca FGV cobra isso para Auditor Fiscal?` }
          ]);
        }
      }
    };
    fetchTopic();
  }, [activeTopicId]);

  const increaseMastery = async () => {
    if (!activeTopicId) return;
    const token = await getToken();
    if (!token) return;
    
    const newMastery = Math.min(mastery + 20, 100);
    setMastery(newMastery);
    
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ topicId: activeTopicId, masteryLevel: newMastery })
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user' as const, content: input };
    const newChatLog = [...chatLog, userMessage];
    setChatLog(newChatLog);
    setInput('');
    setIsLoading(true);
    
    try {
      const token = await getToken();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          messages: newChatLog, 
          topicContext: topicDetails ? `${topicDetails.subject.title} - ${topicDetails.topic.title}` : '',
          subjectId: topicDetails?.subject.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChatLog(prev => [...prev, { role: 'tutor', content: data.text }]);
      } else {
        setChatLog(prev => [...prev, { role: 'tutor', content: 'Desculpe, ocorreu um erro na geração da resposta.' }]);
      }
    } catch (error) {
      setChatLog(prev => [...prev, { role: 'tutor', content: 'Desculpe, ocorreu um erro de conexão.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 px-6 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCurrentView('syllabus')}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
            <BrainCircuit size={18} />
            <span className="font-bold tracking-tight">Tutor Mode</span>
          </div>
        </div>
        
        {topicDetails ? (
          <div className="text-right flex items-center gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{topicDetails.subject.title}</p>
              <p className="text-sm font-medium text-slate-800 line-clamp-1 max-w-md" title={topicDetails.topic.title}>
                {topicDetails.topic.title}
              </p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-500 mb-1">Domínio: {mastery}%</span>
              <div className="w-24 bg-slate-200 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${mastery}%` }}></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-slate-500">
            Nenhum tópico selecionado
          </div>
        )}
      </div>

      {/* Quick Actions (SM-2 / Consolidation Gate simulation) */}
      <div className="bg-slate-900 text-white p-3 px-6 flex gap-4 text-sm justify-center items-center shadow-inner">
        <span className="text-slate-400 font-medium mr-4">Consolidation Gate:</span>
        <button onClick={increaseMastery} className="flex items-center gap-2 hover:text-green-400 transition-colors bg-white/10 px-3 py-1.5 rounded-md">
          <TrendingUp size={14} /> +20% Domínio (Demo)
        </button>
        <button className="flex items-center gap-2 hover:text-blue-400 transition-colors bg-white/10 px-3 py-1.5 rounded-md">
          <Play size={14} /> Learn New
        </button>
        <button className="flex items-center gap-2 hover:text-amber-400 transition-colors bg-white/10 px-3 py-1.5 rounded-md">
          <RefreshCw size={14} /> Review
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {chatLog.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
            }`}>
              {msg.role === 'tutor' && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                  <BrainCircuit size={16} className="text-blue-500" />
                  <span className="text-xs font-bold text-slate-500 tracking-wider">TUTOR</span>
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3 relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Responda ou peça para explicar um tópico..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-6 flex items-center justify-center transition-colors shadow-sm"
          >
            {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

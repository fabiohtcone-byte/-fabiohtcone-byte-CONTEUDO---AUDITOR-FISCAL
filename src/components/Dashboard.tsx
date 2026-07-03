import React, { useEffect, useState } from 'react';
import { AppState, DailyStudyPlan, Subject } from '../types';
import { Target, Book, Brain, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  setCurrentView: (view: AppState['currentView']) => void;
  setActiveSubject: (id: number) => void;
  setActiveTopic: (id: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentView, setActiveSubject, setActiveTopic }) => {
  const { getToken } = useAuth();
  const [dailyPlan, setDailyPlan] = useState<DailyStudyPlan[]>([]);
  const [stats, setStats] = useState({ percentage: 0, mastered: 0, total: 0, inProgress: 0 });
  const [recentProgress, setRecentProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = await getToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      
      const [planRes, progressRes, syllabusRes] = await Promise.all([
        fetch('/api/daily-plan', { headers }),
        fetch('/api/progress', { headers }),
        fetch('/api/syllabus', { headers })
      ]);

      if (planRes.ok && progressRes.ok && syllabusRes.ok) {
        const plan = await planRes.json();
        const progress = await progressRes.json();
        const syllabus = await syllabusRes.json();

        setDailyPlan(plan);
        
        let total = 0;
        const topicMap = new Map();
        syllabus.forEach((s: any) => {
          total += s.topics.length;
          s.topics.forEach((t: any) => {
            topicMap.set(t.id, { ...t, subject: s });
          });
        });
        
        let mastered = 0;
        let inProgress = 0;
        
        // Enrich progress with topic details for history
        const enrichedProgress = progress.map((p: any) => {
          if (p.masteryLevel >= 80) mastered++;
          else if (p.masteryLevel > 0) inProgress++;
          return {
            ...p,
            topic: topicMap.get(p.topicId)
          };
        }).filter((p: any) => p.topic && p.timesStudied > 0)
          .sort((a: any, b: any) => new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime())
          .slice(0, 5);
          
        setRecentProgress(enrichedProgress);

        setStats({
          percentage: total > 0 ? Math.round((mastered / total) * 100) : 0,
          mastered,
          total,
          inProgress,
        });
      }
      setLoading(false);
    };
    
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Carregando plano de estudos...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
        <p className="text-slate-500 mt-1">Seu plano diário e progresso geral.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Progresso Global</p>
            <p className="text-2xl font-bold text-slate-900">{stats.percentage}%</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <Target size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tópicos Dominados</p>
            <p className="text-2xl font-bold text-slate-900">{stats.mastered} <span className="text-sm font-normal text-slate-400">/ {stats.total}</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Book size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Em Andamento</p>
            <p className="text-2xl font-bold text-slate-900">{stats.inProgress}</p>
          </div>
        </div>
      </div>

      {/* Daily Plan */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Meta Diária (Máx 3 tópicos)</h3>
          <p className="text-sm text-slate-500 mt-1">
            Priorizamos assuntos onde o seu domínio é menor, misturados com revisões programadas. Bata 80% para desbloquear novos temas.
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dailyPlan.map(plan => (
              <div 
                key={plan.id} 
                className="group p-5 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all relative overflow-hidden bg-gradient-to-br from-white to-slate-50"
              >
                {plan.completed && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">
                    Concluído
                  </div>
                )}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-semibold text-blue-600 tracking-wider uppercase mb-1 block">
                      {plan.topic.subject.title}
                    </span>
                    <h4 className="font-bold text-slate-800 line-clamp-2" title={plan.topic.title}>{plan.topic.title}</h4>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setActiveSubject(plan.topic.subjectId);
                    setActiveTopic(plan.topic.id);
                    setCurrentView('tutor');
                  }}
                  className="mt-4 w-full py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
                >
                  <Brain size={16} />
                  Estudar Tópico
                </button>
              </div>
            ))}
            
            {dailyPlan.length === 0 && (
              <div className="col-span-3 text-center p-8 text-slate-500">
                Plano diário não gerado. Verifique os tópicos no edital.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Histórico Recente</h3>
          <p className="text-sm text-slate-500 mt-1">
            Matérias e conteúdos que você estudou recentemente e o número de vezes.
          </p>
        </div>
        <div className="p-0">
          <ul className="divide-y divide-slate-100">
            {recentProgress.map((prog, idx) => (
              <li key={idx} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-blue-600 tracking-wider uppercase mb-1 block">
                    {prog.topic.subject.title}
                  </span>
                  <h4 className="font-bold text-slate-800">{prog.topic.title}</h4>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm px-3 py-1 bg-slate-100 text-slate-600 rounded-full font-medium whitespace-nowrap">
                    Estudado {prog.timesStudied} vez{prog.timesStudied !== 1 ? 'es' : ''}
                  </span>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium whitespace-nowrap ${prog.masteryLevel >= 80 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    Domínio: {prog.masteryLevel}%
                  </span>
                </div>
              </li>
            ))}
            {recentProgress.length === 0 && (
              <li className="p-8 text-center text-slate-500">
                Nenhum tópico estudado ainda. Comece a estudar para ver seu histórico aqui!
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

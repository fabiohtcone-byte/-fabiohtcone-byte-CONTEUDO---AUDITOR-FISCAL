import React, { useEffect, useState } from 'react';
import { AppState, Subject, TopicStatus } from '../types';
import { CheckCircle2, Circle, Clock, PlayCircle, Brain, Book, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SyllabusViewProps {
  activeSubjectId: number | null;
  setActiveSubject: (id: number) => void;
  startTutorSession: (topicId: number) => void;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({ 
  activeSubjectId, 
  setActiveSubject,
  startTutorSession
}) => {
  const { getToken } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [progress, setProgress] = useState<Record<number, { masteryLevel: number, timesStudied: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
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
        
        setSubjects(syllabus);
        
        const progressMap: Record<number, { masteryLevel: number, timesStudied: number }> = {};
        prog.forEach((p: any) => {
          progressMap[p.topicId] = {
            masteryLevel: p.masteryLevel,
            timesStudied: p.timesStudied
          };
        });
        setProgress(progressMap);

        if (!activeSubjectId && syllabus.length > 0) {
          setActiveSubject(syllabus[0].id);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const getStatusIcon = (masteryLevel: number) => {
    if (masteryLevel >= 80) return <CheckCircle2 className="text-green-500" size={20} />;
    if (masteryLevel > 0) return <PlayCircle className="text-blue-500" size={20} />;
    return <Circle className="text-slate-300" size={20} />;
  };

  const getStatusColor = (masteryLevel: number) => {
    if (masteryLevel >= 80) return 'bg-green-50 text-green-700 border-green-200';
    if (masteryLevel > 0) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getStatusText = (masteryLevel: number) => {
    if (masteryLevel >= 80) return `Dominado (${masteryLevel}%)`;
    if (masteryLevel > 0) return `Em Estudo (${masteryLevel}%)`;
    return 'Não Iniciado';
  };

  if (loading) {
    return <div className="p-8">Carregando edital...</div>;
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-50">
      {/* Subjects List (Left Panel) */}
      <div className="w-1/3 bg-white border-r border-slate-200 flex flex-col h-full">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Matérias</h2>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {subjects.map(subject => {
            const isActive = subject.id === activeSubjectId;
            return (
              <button
                key={subject.id}
                onClick={() => setActiveSubject(subject.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors border ${
                  isActive 
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium shadow-sm' 
                    : 'bg-white border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                {subject.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Topics List (Right Panel) */}
      <div className="w-2/3 flex flex-col h-full">
        {activeSubjectId ? (
          <>
            <div className="p-6 border-b border-slate-200 bg-white shadow-sm z-10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {subjects.find(s => s.id === activeSubjectId)?.title}
                </h2>
                <p className="text-slate-500 text-sm mt-1">Acompanhe seu nível de domínio em cada tópico. Meta: 80%</p>
              </div>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  accept="application/pdf"
                  className="hidden" 
                  id="pdf-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !activeSubjectId) return;
                    
                    try {
                      const token = await getToken();
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      alert('Fazendo upload do PDF. Aguarde...');
                      
                      const res = await fetch(`/api/subjects/${activeSubjectId}/materials`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`
                        },
                        body: formData
                      });
                      
                      if (res.ok) {
                        alert('Material em PDF enviado com sucesso e servirá de base para o tutor!');
                      } else {
                        alert('Falha ao enviar o material.');
                      }
                    } catch (error) {
                      console.error(error);
                      alert('Erro ao enviar.');
                    }
                  }}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  <Upload size={16} />
                  Carregar PDF (Base)
                </label>
              </div>
            </div>
            <div className="overflow-y-auto p-6 flex-1 bg-slate-50">
              <div className="space-y-3">
                {subjects.find(s => s.id === activeSubjectId)?.topics.map(topic => {
                  const topicProgress = progress[topic.id];
                  const mastery = topicProgress?.masteryLevel || 0;
                  const timesStudied = topicProgress?.timesStudied || 0;
                  return (
                    <div key={topic.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:border-blue-300 transition-colors">
                      <div className="mt-1 flex-shrink-0">
                        {getStatusIcon(mastery)}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${mastery >= 80 ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {topic.title}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${getStatusColor(mastery)}`}>
                              {getStatusText(mastery)}
                            </span>
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-slate-100 text-slate-600 border-slate-200">
                              Estudado {timesStudied} vez{timesStudied !== 1 ? 'es' : ''}
                            </span>
                          </div>
                          <button 
                            onClick={() => startTutorSession(topic.id)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Brain size={14} />
                            Estudar com o Tutor
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-4">
            <Book size={48} className="opacity-20" />
            <p>Selecione uma matéria para ver o edital.</p>
          </div>
        )}
      </div>
    </div>
  );
};

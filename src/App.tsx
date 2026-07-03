import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SyllabusView } from './components/SyllabusView';
import { TutorView } from './components/TutorView';
import { AppState, TopicStatus } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { user, loading, signIn } = useAuth();
  const [state, setState] = useState<AppState>({
    activeSubjectId: null,
    activeTopicId: null,
    currentView: 'dashboard',
  });

  const setCurrentView = (view: AppState['currentView']) => {
    setState(prev => ({ ...prev, currentView: view }));
  };

  const setActiveSubject = (id: number | null) => {
    setState(prev => ({ ...prev, activeSubjectId: id }));
  };

  const setActiveTopic = (id: number | null) => {
    setState(prev => ({ ...prev, activeTopicId: id }));
  };

  const startTutorSession = (topicId: number) => {
    setActiveTopic(topicId);
    setCurrentView('tutor');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 flex-col gap-4">
        <h1 className="text-3xl font-bold text-slate-800">AuditorPro Receita Federal</h1>
        <p className="text-slate-500">Faça login para acessar seu plano de estudos diário e tutor inteligente.</p>
        <button onClick={signIn} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
          Entrar com Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      <Sidebar currentView={state.currentView} setCurrentView={setCurrentView} />
      
      <main className="flex-1 relative">
        {state.currentView === 'dashboard' && (
          <Dashboard 
            setCurrentView={setCurrentView}
            setActiveSubject={setActiveSubject}
            setActiveTopic={setActiveTopic}
          />
        )}
        
        {state.currentView === 'syllabus' && (
          <SyllabusView 
            activeSubjectId={state.activeSubjectId}
            setActiveSubject={setActiveSubject}
            startTutorSession={startTutorSession}
          />
        )}
        
        {state.currentView === 'tutor' && (
          <TutorView 
            activeTopicId={state.activeTopicId}
            setActiveTopic={setActiveTopic}
            setCurrentView={setCurrentView}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


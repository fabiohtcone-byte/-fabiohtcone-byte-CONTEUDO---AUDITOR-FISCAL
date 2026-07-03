import React from 'react';
import { LayoutDashboard, BookOpen, GraduationCap } from 'lucide-react';
import { AppState } from '../types';

interface SidebarProps {
  currentView: AppState['currentView'];
  setCurrentView: (view: AppState['currentView']) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'syllabus', label: 'Edital (Syllabus)', icon: BookOpen },
    { id: 'tutor', label: 'Learn-Anything Tutor', icon: GraduationCap },
  ] as const;

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-blue-400">AuditorPro</h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Receita Federal</p>
      </div>

      <nav className="flex-1 mt-6">
        <ul className="space-y-2 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        v1.0.0
      </div>
    </div>
  );
};

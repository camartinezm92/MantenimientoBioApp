import React, { useState, useEffect } from 'react';
import { ReportForm } from './components/ReportForm';
import { History } from './components/History';
import { PlusCircle, History as HistoryIcon, ClipboardList, LogIn, LogOut, User } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { Report } from './types';

type View = 'new' | 'history' | 'view';

export default function App() {
  const [view, setView] = useState<View>('new');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [autoDownload, setAutoDownload] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  const logout = () => {
    signOut(auth);
  };

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setAutoDownload(false);
    setView('view');
  };

  const handleDownloadReport = (report: Report) => {
    setSelectedReport(report);
    setAutoDownload(true);
    setView('view');
  };

  const handleNewReport = () => {
    setSelectedReport(null);
    setAutoDownload(false);
    setView('new');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 max-w-md w-full text-center flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="bg-black p-2 rounded-xl">
              <ClipboardList className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">UCI HONDA</h1>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Gestión Biomédica</h2>
            <p className="text-gray-500 mt-2">Inicie sesión para acceder al sistema de reportes.</p>
          </div>
          <button
            onClick={login}
            className="flex items-center justify-center gap-3 w-full py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg"
          >
            <LogIn size={20} />
            Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar / Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-black p-1.5 rounded-lg">
                <ClipboardList className="text-white" size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight leading-none">UCI HONDA</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gestión Biomédica</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 mr-4 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                <User size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-600">{user.email}</span>
              </div>
              <button
                onClick={handleNewReport}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  view === 'new' 
                    ? 'bg-black text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <PlusCircle size={18} />
                Nuevo
              </button>
              <button
                onClick={() => setView('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  view === 'history' 
                    ? 'bg-black text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <HistoryIcon size={18} />
                Historial
              </button>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8">
        {view === 'new' ? (
          <ReportForm onComplete={() => setView('history')} />
        ) : view === 'view' ? (
          <ReportForm 
            key={selectedReport?.id || 'view-report'}
            initialData={selectedReport || undefined} 
            onComplete={() => {
              setView('history');
              setSelectedReport(null);
            }} 
            isViewOnly={true}
            autoDownload={autoDownload}
          />
        ) : (
          <History 
            onViewReport={handleViewReport} 
            onDownloadReport={handleDownloadReport}
          />
        )}
      </main>

      <footer className="py-8 text-center text-gray-400 text-xs border-t border-gray-100 bg-white mt-12">
        <p>© 2026 Medicina Intensiva del Tolima S.A. - UCI Honda. Todos los derechos reservados.</p>
        <p className="mt-1">Desarrollado para Gestión de Tecnología Médica.</p>
      </footer>
    </div>
  );
}

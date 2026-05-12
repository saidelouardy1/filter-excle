import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import Statistics from './pages/Statistics';
import Import from './pages/Import';

const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

function MainApp() {
  const [sharedData, setSharedData] = useState<any[]>([]);
  const [sharedColumns, setSharedColumns] = useState<string[]>([]);

  // Load from session storage if exists
  useEffect(() => {
    const savedData = sessionStorage.getItem('excel_data');
    const savedCols = sessionStorage.getItem('excel_columns');
    if (savedData) setSharedData(JSON.parse(savedData));
    if (savedCols) setSharedColumns(JSON.parse(savedCols));
  }, []);

  const handleDataUpdate = (data: any[], cols: string[]) => {
    setSharedData(data);
    setSharedColumns(cols);
    sessionStorage.setItem('excel_data', JSON.stringify(data));
    sessionStorage.setItem('excel_columns', JSON.stringify(cols));
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-[#1E293B] overflow-hidden" dir="rtl">
      <Sidebar />
      
      <main className="flex-1 mr-72 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white/30 backdrop-blur-md border-b border-white flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Jamaa Platform</h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest -mt-1">نظام تحليل البيانات المؤسساتي الذكي</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
               <span className="text-xs font-black">EN</span>
             </div>
             <div className="px-5 py-2.5 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">
               Live v2.7
             </div>
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto scrollbar-hide">
          <div className="max-w-7xl mx-auto pb-10">
            <Routes>
              <Route path="/" element={<PageTransition><Import onDataUpdate={handleDataUpdate} initialData={sharedData} initialColumns={sharedColumns} /></PageTransition>} />
              <Route path="/statistics" element={<PageTransition><Statistics data={sharedData} columns={sharedColumns} /></PageTransition>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <footer className="mt-auto h-12 flex items-center justify-between py-8 text-[11px] font-medium text-slate-400 border-t border-slate-200 bg-white/50 px-8">
            <div>v2.7.0 • الإصدار المؤسساتي</div>
            <div>نظام إدارة الجماعة • تم التطوير بواسطة الجماعة</div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}

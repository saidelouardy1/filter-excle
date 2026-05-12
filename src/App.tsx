import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { FileUp, BarChart3 } from 'lucide-react';
import Statistics from './pages/Statistics';
import Import from './pages/Import';
import { cn } from './lib/utils';

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

// Navigation tabs — moved from sidebar into the header
const HeaderTabs = () => {
  const location = useLocation();
  
  const tabs = [
    { path: '/', label: 'الاستيراد', icon: FileUp },
    { path: '/statistics', label: 'الإحصائيات', icon: BarChart3 },
  ];

  return (
    <nav className="flex items-center gap-2 bg-slate-50/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-100">
      {tabs.map(tab => {
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-black transition-all relative",
              isActive
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon size={16} strokeWidth={2.5} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
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
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#1E293B]" dir="rtl">
      <main className="flex flex-col min-h-screen">
        <header className="h-24 bg-white/30 backdrop-blur-md border-b border-white flex items-center justify-between px-10 shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-10">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Jamaa Platform</h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest -mt-1">نظام تحليل البيانات المؤسساتي الذكي</p>
            </div>
            <HeaderTabs />
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto scrollbar-hide">
          <div className="w-full pb-10">
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
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

// NEW: shape that holds every sheet of the workbook for cross-sheet comparison
export interface SheetData {
  name: string;
  rows: any[];
  columns: string[];
}

function MainApp() {
  const [sharedData, setSharedData] = useState<any[]>([]);
  const [sharedColumns, setSharedColumns] = useState<string[]>([]);
  // NEW: all sheets of the workbook (each with its own rows + columns)
  const [allSheets, setAllSheets] = useState<SheetData[]>([]);

  useEffect(() => {
    const savedData = sessionStorage.getItem('excel_data');
    const savedCols = sessionStorage.getItem('excel_columns');
    const savedSheets = sessionStorage.getItem('excel_all_sheets');
    if (savedData) setSharedData(JSON.parse(savedData));
    if (savedCols) setSharedColumns(JSON.parse(savedCols));
    if (savedSheets) {
      try {
        const parsed = JSON.parse(savedSheets);
        // Dates were serialised to ISO strings — leave them as strings (parseDate handles both)
        setAllSheets(parsed);
      } catch {}
    }
  }, []);

  const handleDataUpdate = (
    data: any[], 
    cols: string[], 
    sheets?: SheetData[]
  ) => {
    setSharedData(data);
    setSharedColumns(cols);
    sessionStorage.setItem('excel_data', JSON.stringify(data));
    sessionStorage.setItem('excel_columns', JSON.stringify(cols));
    
    if (sheets) {
      setAllSheets(sheets);
      try {
        sessionStorage.setItem('excel_all_sheets', JSON.stringify(sheets));
      } catch (e) {
        // sessionStorage has size limits; if it fails just keep in-memory
        console.warn('Could not persist all sheets to sessionStorage:', e);
      }
    } else if (data.length === 0) {
      // Cleared
      setAllSheets([]);
      sessionStorage.removeItem('excel_all_sheets');
    }
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
              <Route 
                path="/" 
                element={
                  <PageTransition>
                    <Import 
                      onDataUpdate={handleDataUpdate} 
                      initialData={sharedData} 
                      initialColumns={sharedColumns} 
                    />
                  </PageTransition>
                } 
              />
              <Route 
                path="/statistics" 
                element={
                  <PageTransition>
                    <Statistics 
                      data={sharedData} 
                      columns={sharedColumns} 
                      allSheets={allSheets}
                    />
                  </PageTransition>
                } 
              />
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
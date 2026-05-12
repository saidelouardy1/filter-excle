import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  Download, 
  ArrowLeft,
  Filter,
  Hash,
  Activity,
  ChevronDown,
  TrendingUp,
  LayoutDashboard,
  Calendar,
  Layers,
  ArrowUpRight,
  UserCheck,
  Users
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

interface StatisticsProps {
  data: any[];
  columns: string[];
}

export default function Statistics({ data, columns }: StatisticsProps) {
  const [selectedCol, setSelectedCol] = useState(columns[0] || '');
  const [compareCol1, setCompareCol1] = useState(columns[0] || '');
  const [compareCol2, setCompareCol2] = useState(columns[1] || columns[0] || '');
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const pdfReportRef = useRef<HTMLDivElement>(null);

  // FIX: useEffect instead of useMemo for side effects
  useEffect(() => {
    if (columns.length > 0) {
      if (!selectedCol) setSelectedCol(columns[0]);
      if (!compareCol1) setCompareCol1(columns[0]);
      if (!compareCol2) setCompareCol2(columns[1] || columns[0]);
    }
  }, [columns]);

  const stats = useMemo(() => {
    if (!data.length) return null;

    if (isComparisonMode) {
      if (!compareCol1 || !compareCol2) return null;

      const count1 = data.filter(row => row[compareCol1] !== null && row[compareCol1] !== undefined && String(row[compareCol1]).trim() !== '').length;
      const count2 = data.filter(row => row[compareCol2] !== null && row[compareCol2] !== undefined && String(row[compareCol2]).trim() !== '').length;
      const total = count1 + count2;
      
      const labels = [compareCol1, compareCol2];
      const values = [count1, count2];
      const percentages = total > 0 
        ? [((count1 / total) * 100).toFixed(1), ((count2 / total) * 100).toFixed(1)]
        : ['0.0', '0.0'];

      return { labels, values, percentages, total, isComparison: true };
    } else {
      if (!selectedCol) return null;
      
      const counts: Record<string, number> = {};
      data.forEach(row => {
        const val = String(row[selectedCol] || 'غير محدد');
        counts[val] = (counts[val] || 0) + 1;
      });

      const labels = Object.keys(counts);
      const values = Object.values(counts);
      const total = data.length;
      const percentages = values.map(v => ((v / total) * 100).toFixed(1));

      return { labels, values, percentages, counts, total, isComparison: false };
    }
  }, [data, selectedCol, compareCol1, compareCol2, isComparisonMode]);

  const softColors = [
    'rgba(16, 185, 129, 0.75)',
    'rgba(139, 92, 246, 0.75)',
    'rgba(59, 130, 246, 0.65)',
    'rgba(236, 72, 153, 0.65)',
    'rgba(245, 158, 11, 0.7)',
    'rgba(20, 184, 166, 0.7)',
    'rgba(99, 102, 241, 0.7)',
    'rgba(100, 116, 139, 0.7)',
  ];

  const doughnutData = {
    labels: stats?.labels || [],
    datasets: [{
      data: stats?.values || [],
      backgroundColor: softColors,
      borderRadius: isComparisonMode ? 20 : 10,
      borderWidth: 0,
      spacing: 5,
    }]
  };

  const barData = {
    labels: stats?.labels || [],
    datasets: [{
      label: 'العدد',
      data: stats?.values || [],
      backgroundColor: softColors,
      borderRadius: 12,
    }]
  };

  const handleGeneratePDF = async () => {
    if (isGeneratingPDF) return;

    if (!data.length) {
      setErrorMsg("لا توجد بيانات للتقرير");
      return;
    }

    if (!pdfReportRef.current) {
      setErrorMsg("لا يمكن إنشاء التقرير حالياً.");
      return;
    }
    
    setIsGeneratingPDF(true);
    setErrorMsg(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const canvas = await html2canvas(pdfReportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      if (!canvas || canvas.width === 0) {
        throw new Error("Failed to capture report as image");
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`تقرير-إحصائيات-${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      setErrorMsg("حدث خطأ أثناء إنشاء ملف PDF. المرجو المحاولة مرة أخرى.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!data.length) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-8 text-center" dir="rtl">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-32 h-32 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 shadow-inner">
          <Activity size={64} strokeWidth={1} />
        </motion.div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">لا توجد بيانات للتحليل</h2>
          <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">قم باستيراد ملف Excel الخاص بك من الصفحة الرئيسية للبدء في رؤية التحليلات الذكية والرسومات البيانية.</p>
        </div>
        <Link to="/" className="group flex items-center gap-3 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
          <span>اذهب للاستيراد الآن</span>
          <ArrowLeft size={20} className="group-hover:translate-x-[-4px] transition-transform" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24 max-w-[1400px] mx-auto pt-8" dir="rtl">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] bg-indigo-50 w-fit px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              <LayoutDashboard size={14} />
              <span>Dashboard Intelligence</span>
            </div>
            <button 
              onClick={() => setIsComparisonMode(!isComparisonMode)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                isComparisonMode ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
              )}
            >
              {isComparisonMode ? "وضع المقارنة مفعّل" : "تفعيل وضع المقارنة"}
            </button>
          </div>
          <h1 className="text-5xl weapon-text text-slate-900">
            {isComparisonMode ? "مقارنة ثنائية ذكية" : "التحليلات والمؤشرات الرقمية"}
          </h1>
          <p className="text-slate-400 font-medium text-lg">
            {isComparisonMode 
              ? "قارن بين عمودين مهمين من بياناتك لرؤية العلاقة والتوزيع النسبي بينهما."
              : "استكشف البيانات الخاصة بك من خلال لوحة تحكم ذكية وعصرية."}
          </p>
          {errorMsg && (
            <p className="text-rose-600 font-black text-sm">{errorMsg}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {!isComparisonMode ? (
            <div className="relative group">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none">
                <Filter size={18} />
              </div>
              <select 
                className="bg-white/70 backdrop-blur-md border border-slate-200/50 hover:border-indigo-100 rounded-2xl pr-12 pl-12 h-14 min-w-[240px] font-black text-slate-700 outline-none appearance-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-500/5"
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
              >
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown size={18} />
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="relative group">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none text-xs font-black">1</div>
                <select 
                  className="bg-white/70 backdrop-blur-md border border-slate-200/50 hover:border-indigo-100 rounded-2xl pr-10 pl-10 h-14 min-w-[200px] font-black text-slate-700 outline-none appearance-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-500/5 text-xs"
                  value={compareCol1}
                  onChange={(e) => setCompareCol1(e.target.value)}
                >
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="relative group">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none text-xs font-black">2</div>
                <select 
                  className="bg-white/70 backdrop-blur-md border border-slate-200/50 hover:border-indigo-100 rounded-2xl pr-10 pl-10 h-14 min-w-[200px] font-black text-slate-700 outline-none appearance-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-500/5 text-xs"
                  value={compareCol2}
                  onChange={(e) => setCompareCol2(e.target.value)}
                >
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          <button 
            onClick={handleGeneratePDF} 
            disabled={isGeneratingPDF}
            className="flex items-center gap-3 bg-emerald-500/90 backdrop-blur-md text-white px-8 h-14 rounded-2xl font-black shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {isGeneratingPDF ? (
              <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={20} />
            )}
            <span>{isGeneratingPDF ? "جاري التحميل..." : "تقرير PDF"}</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {!isComparisonMode ? (
          <>
            {[
              { label: 'إجمالي السجلات', value: data.length, icon: Hash, color: 'text-blue-500', bg: 'bg-blue-50/50', subtitle: 'سجل مؤكد' },
              { label: 'الأعلى تكراراً', value: stats?.labels[stats?.values.indexOf(Math.max(...(stats?.values || [0])))] || '-', icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50/50', subtitle: 'النمط الغالب' },
              { label: 'أعلى نسبة', value: `${stats?.percentages[stats?.values.indexOf(Math.max(...(stats?.values || [0])))]}%`, icon: ArrowUpRight, color: 'text-pink-500', bg: 'bg-pink-50/50', subtitle: 'معدل الانتشار' },
              { label: 'عدد الفئات', value: stats?.labels.length || 0, icon: Layers, color: 'text-slate-500', bg: 'bg-slate-50/50', subtitle: 'تصنيف فريد' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-8 rounded-[2.5rem] hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
                <div className={`${item.bg} ${item.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <item.icon size={26} strokeWidth={2.5} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                <h3 className="text-2xl font-black text-slate-900 truncate mb-1">{item.value}</h3>
                <p className="text-xs font-bold text-slate-300">{item.subtitle}</p>
              </motion.div>
            ))}
          </>
        ) : (
          <>
            {[
              { label: compareCol1, value: stats?.values[0], icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-50/50', subtitle: `${stats?.percentages[0]}% من الإجمالي` },
              { label: compareCol2, value: stats?.values[1], icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50/50', subtitle: `${stats?.percentages[1]}% من الإجمالي` },
              { label: 'فارق الجمهور', value: Math.abs((stats?.values[0] || 0) - (stats?.values[1] || 0)), icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50/50', subtitle: 'الفرق العددي' },
              { label: 'إجمالي المقارنة', value: stats?.total, icon: Hash, color: 'text-slate-500', bg: 'bg-slate-50/50', subtitle: 'العينات المشمولة' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-8 rounded-[2.5rem] hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
                <div className={`${item.bg} ${item.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <item.icon size={26} strokeWidth={2.5} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{item.label}</p>
                <h3 className="text-2xl font-black text-slate-900 truncate mb-1">{item.value}</h3>
                <p className="text-xs font-bold text-slate-300">{item.subtitle}</p>
              </motion.div>
            ))}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-10 rounded-[3rem]">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500"><PieIcon size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900">توزيع النسب المئوية</h2>
              <p className="text-xs font-bold text-slate-400 italic">نظرة دائرية على حصص البيانات</p>
            </div>
          </div>
          <div className="h-[400px] relative flex items-center justify-center">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-300 tracking-[0.2em]">TOTAL</span>
              <span className="text-4xl font-black text-slate-900">{stats?.total}</span>
            </div>
            <Doughnut 
              data={doughnutData} 
              options={{ 
                maintainAspectRatio: false, 
                cutout: '80%', 
                plugins: { 
                  legend: { position: 'bottom', labels: { usePointStyle: true, padding: 30, font: { family: 'Tajawal', weight: 'bold', size: 12 }, color: '#94a3b8' } },
                  datalabels: { 
                    color: '#fff', 
                    font: { weight: 'bold', size: 12, family: 'Tajawal' }, 
                    formatter: (v) => {
                      const total = stats?.total || 1;
                      return v > (total * 0.05) ? `${v}\n(${((v/total)*100).toFixed(1)}%)` : '';
                    },
                    textAlign: 'center'
                  }
                } 
              }} 
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card p-10 rounded-[3rem]">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500"><BarChart3 size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900">تحليل التكرارات</h2>
              <p className="text-xs font-bold text-slate-400 italic">مقارنة كمية بين القيم المختلفة</p>
            </div>
          </div>
          <div className="h-[400px]">
             <Bar 
              data={barData} 
              options={{ 
                maintainAspectRatio: false, 
                plugins: { 
                  legend: { display: false },
                  datalabels: { 
                    anchor: 'end', 
                    align: 'top', 
                    color: '#6366f1', 
                    font: { weight: 'bold', size: 11, family: 'Tajawal' }, 
                    formatter: (v, ctx) => `${v}\n${stats?.percentages[ctx.dataIndex]}%`, 
                    textAlign: 'center',
                    offset: 4
                  }
                }, 
                scales: { 
                  y: { grid: { color: 'rgba(241, 245, 249, 0.5)' }, ticks: { font: { weight: 'bold', family: 'Tajawal' }, color: '#cbd5e1' } },
                  x: { grid: { display: false }, ticks: { font: { weight: 'bold', family: 'Tajawal' }, color: '#64748b' } }
                } 
              }} 
            />
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-[3rem] overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between">
           <div className="space-y-1">
             <h3 className="text-2xl font-black text-slate-900">الجدول التحليلي</h3>
             <p className="text-xs font-bold text-slate-400">توزيع الكثافة الرقمية للقيم المختارة</p>
           </div>
           <div className="bg-slate-50 text-slate-400 px-6 py-2 rounded-2xl flex items-center gap-2 font-black text-xs">
             <Calendar size={14} />
             <span>{new Date().toLocaleDateString('ar-EG')}</span>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white">الفئة / القيمة</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white">التكرار</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white text-left">التوزيع النسبي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50">
              {stats?.labels.map((label, i) => (
                <tr key={label} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-10 py-6"><span className="text-sm font-black text-slate-700">{label}</span></td>
                  <td className="px-10 py-6 text-sm font-black text-slate-400 font-mono italic">{stats.values[i]}</td>
                  <td className="px-10 py-6 text-left">
                    <div className="flex items-center gap-6 justify-end">
                      <div className="w-48 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner group-hover:scale-x-105 transition-transform duration-500">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${stats.percentages[i]}%` }} transition={{ duration: 1.5, delay: 0.5 }} className="h-full rounded-full" style={{ backgroundColor: softColors[i % softColors.length] }} />
                      </div>
                      <span className="min-w-[60px] font-black text-slate-900 text-sm font-mono">{stats.percentages[i]}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Hidden Printable Report Section */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1000px',
          opacity: 0,
          zIndex: -1,
          pointerEvents: 'none',
          overflow: 'hidden',
        }} 
        aria-hidden="true"
      >
        <div id="pdf-report" ref={pdfReportRef} className="p-20 space-y-12" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif', color: '#0f172a', width: '1000px', backgroundColor: '#ffffff' }}>
          <div className="flex justify-between items-start pb-10" style={{ borderBottom: '2px solid #f1f5f9' }}>
            <div className="space-y-2">
              <h1 className="text-5xl font-black" style={{ color: '#0f172a' }}>تقرير الإحصائيات</h1>
              <p className="font-bold text-xl uppercase tracking-widest" style={{ color: '#94a3b8' }}>Statistical Analysis Report</p>
            </div>
            <div className="text-right space-y-1">
              <p className="font-black text-lg" style={{ color: '#0f172a' }}>{new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' })}</p>
              <p className="font-bold uppercase text-[10px] tracking-tighter" style={{ color: '#94a3b8' }}>Generated by Jamaa Platform</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
             <div className="p-8 rounded-3xl space-y-1" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
               <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>نوع التحليل</p>
               <p className="text-2xl font-black" style={{ color: '#4f46e5' }}>
                 {isComparisonMode ? "مقارنة ثنائية" : `تحليل محتوى: ${selectedCol}`}
               </p>
             </div>
             <div className="p-8 rounded-3xl space-y-1" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
               <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>إجمالي السجلات</p>
               <p className="text-2xl font-black" style={{ color: '#0f172a' }}>{stats?.total} عينة</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-10">
               <h3 className="text-xl font-black pr-4" style={{ color: '#0f172a', borderRight: '4px solid #4f46e5' }}>الجدول الإحصائي</h3>
               <table className="w-full text-right" style={{ borderCollapse: 'collapse' }}>
                 <thead>
                   <tr style={{ backgroundColor: '#f8fafc' }}>
                     <th className="px-6 py-4 text-xs font-black uppercase" style={{ color: '#94a3b8' }}>القيمة</th>
                     <th className="px-6 py-4 text-xs font-black uppercase" style={{ color: '#94a3b8' }}>العدد</th>
                     <th className="px-6 py-4 text-xs font-black uppercase" style={{ color: '#94a3b8' }}>النسبة</th>
                   </tr>
                 </thead>
                 <tbody>
                   {stats?.labels.map((l, i) => (
                     <tr key={l} style={{ borderBottom: '1px solid #f1f5f9' }}>
                       <td className="px-6 py-4 font-black text-sm" style={{ color: '#475569' }}>{l}</td>
                       <td className="px-6 py-4 font-black text-sm" style={{ color: '#0f172a' }}>{stats.values[i]}</td>
                       <td className="px-6 py-4 font-black text-sm font-mono" style={{ color: '#4f46e5' }}>{stats.percentages[i]}%</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
            <div className="space-y-12">
               <div style={{ height: '256px' }}>
                 <h3 className="text-sm font-black uppercase mb-4 text-center" style={{ color: '#94a3b8' }}>التوزيع الدائري</h3>
                 <Doughnut 
                  data={doughnutData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { 
                      legend: { position: 'bottom', labels: { font: { weight: 'bold', size: 10, family: 'Tajawal' }, color: '#64748b' } },
                      datalabels: { color: '#fff', font: { weight: 'bold', size: 10, family: 'Tajawal' }, formatter: (v) => `${((v/(stats?.total || 1))*100).toFixed(0)}%` }
                    } 
                  }} 
                />
               </div>
               <div style={{ height: '256px', paddingTop: '32px' }}>
                 <h3 className="text-sm font-black uppercase mb-4 text-center" style={{ color: '#94a3b8' }}>التمثيل البياني</h3>
                 <Bar 
                  data={barData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { 
                      legend: { display: false },
                      datalabels: { anchor: 'end', align: 'top', color: '#4f46e5', font: { weight: 'bold', size: 8, family: 'Tajawal' }, formatter: (v, ctx) => `${stats?.percentages[ctx.dataIndex]}%` }
                    },
                    scales: { 
                      y: { display: false }, 
                      x: { ticks: { font: { weight: 'bold', size: 8, family: 'Tajawal' }, color: '#64748b' } } 
                    }
                  }} 
                />
               </div>
            </div>
          </div>

          <div className="pt-20 text-center" style={{ borderTop: '1px solid #f1f5f9' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.5em]" style={{ color: '#cbd5e1' }}>End of Official Report • Jamaa Stats</p>
          </div>
        </div>
      </div>
    </div>
  );
}
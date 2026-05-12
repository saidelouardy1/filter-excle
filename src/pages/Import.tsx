import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  Settings2, 
  BarChart3, 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon,
  Download,
  Trash2,
  Table as TableIcon,
  Check,
  ChevronDown,
  Search,
  Eye,
  EyeOff,
  LayoutGrid,
  AlertCircle
} from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement, 
  PointElement, 
  LineElement,
  Filler
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

interface ImportProps {
  onDataUpdate: (data: any[], cols: string[]) => void;
  initialData: any[];
  initialColumns: string[];
}

export default function Import({ onDataUpdate, initialData, initialColumns }: ImportProps) {
  const [data, setData] = useState<any[]>(initialData);
  const [columns, setColumns] = useState<string[]>(initialColumns);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(initialColumns);
  const [analysisColumn, setAnalysisColumn] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // FIX: Separate ref for the hidden PDF report (was colliding with the visible content ref before)
  const pdfReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialColumns.length > 0 && !analysisColumn) {
      setAnalysisColumn(initialColumns[0]);
    }
  }, [initialColumns]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const binaryStr = e.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        if (json.length > 0) {
          const cols = Object.keys(json[0] as object);
          setData(json);
          setColumns(cols);
          setVisibleColumns(cols);
          setAnalysisColumn(cols[0]);
          onDataUpdate(json, cols);
        } else {
          setErrorMsg("الملف المرفوع فارغ.");
        }
      } catch (err) {
        console.error("Error reading file:", err);
        setErrorMsg("حدث خطأ أثناء قراءة الملف. المرجو التأكد من صحة التنسيق.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, [onDataUpdate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  } as any);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const stats = useMemo(() => {
    if (!data.length || !analysisColumn) return null;
    
    const counts: Record<string, number> = {};
    data.forEach(row => {
      const val = String(row[analysisColumn] || 'غير محدد');
      counts[val] = (counts[val] || 0) + 1;
    });

    const total = data.length;
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const percentages = values.map(v => ((v / total) * 100).toFixed(1));

    return { labels, values, percentages, counts, total };
  }, [data, analysisColumn]);

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

  const chartData = {
    labels: stats?.labels || [],
    datasets: [{
      label: 'العدد',
      data: stats?.values || [],
      backgroundColor: softColors,
      borderWidth: 0,
      borderRadius: 8,
    }]
  };

  const handleGeneratePDF = async () => {
    if (isGeneratingPDF) return;

    if (!data.length) {
      setErrorMsg("المرجو رفع ملف Excel أولا");
      return;
    }

    if (!pdfReportRef.current) {
      setErrorMsg("لا يمكن إنشاء التقرير حالياً.");
      return;
    }

    try {
      setIsGeneratingPDF(true);
      setErrorMsg(null);
      
      // Give charts time to render fully
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
      pdf.save("تقرير-البيانات.pdf");
    } catch (error) {
      console.error("PDF Generation Error:", error);
      setErrorMsg("حدث خطأ أثناء إنشاء ملف PDF. المرجو المحاولة مرة أخرى.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const toggleColumnVisibility = (col: string) => {
    setVisibleColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const clearData = () => {
    setData([]);
    setColumns([]);
    setVisibleColumns([]);
    setAnalysisColumn('');
    onDataUpdate([], []);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-12 pb-24 max-w-[1400px] mx-auto pt-8" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl weapon-text text-slate-900">الاستيراد والتحليل</h2>
          <p className="text-slate-400 font-medium text-lg">قم برفع ملف Excel وتحليل محتوياته بدقة وعرضها بشكل منظم.</p>
        </div>
        {data.length > 0 && (
          <div className="flex gap-4">
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
              <span>{isGeneratingPDF ? "جاري التحميل..." : "تصدير PDF"}</span>
            </button>
            <button 
              onClick={clearData}
              className="flex items-center gap-3 bg-rose-500/90 backdrop-blur-md text-white px-8 h-14 rounded-2xl font-black shadow-lg shadow-rose-500/10 hover:bg-rose-600 transition-all active:scale-95"
            >
              <Trash2 size={20} />
              <span>مسح الكل</span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center gap-4 text-rose-600 font-black"
          >
            <AlertCircle size={24} />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {!data.length ? (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          {...getRootProps()}
          className={cn(
            "border-4 border-dashed rounded-[3.5rem] p-32 flex flex-col items-center justify-center gap-10 transition-all cursor-pointer group relative overflow-hidden glass-card",
            isDragActive ? "border-indigo-400 bg-indigo-50/50" : "border-slate-100 hover:border-indigo-200 hover:bg-white"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-28 h-28 bg-indigo-500 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 group-hover:scale-110 transition-transform">
            <FileUp size={48} strokeWidth={2.5} />
          </div>
          <div className="text-center space-y-2">
            <p className="text-3xl weapon-text text-slate-900">اسحب ملفاتك هنا أو تصفح</p>
            <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs">Excel Sheets (XLSX, XLS)</p>
          </div>
          {loading && (
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur px-8 py-3 rounded-full shadow-sm text-indigo-600 font-black">
              <div className="w-5 h-5 border-[3px] border-current border-t-transparent rounded-full animate-spin" />
              جاري معالجة البيانات...
            </div>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-8">
            <div className="glass-card rounded-[2.5rem] p-10 space-y-10">
              <div className="flex items-center gap-3 text-slate-900 font-black">
                <Settings2 size={24} className="text-indigo-500" />
                <h3 className="text-xl">تخصيص العرض</h3>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">الأعمدة الظاهرة في الجدول</label>
                <div className="flex flex-wrap gap-2">
                  {columns.map(col => (
                    <button
                      key={col}
                      onClick={() => toggleColumnVisibility(col)}
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-[11px] font-black border-2 transition-all flex items-center gap-3 uppercase tracking-wider",
                        visibleColumns.includes(col)
                          ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                          : "bg-white border-slate-50 text-slate-300"
                      )}
                    >
                      {visibleColumns.includes(col) ? <Eye size={14} /> : <EyeOff size={14} />}
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">تحديد عمود التحليل</label>
                <div className="relative group">
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none">
                     <LayoutGrid size={18} />
                   </div>
                  <select
                    value={analysisColumn}
                    onChange={(e) => setAnalysisColumn(e.target.value)}
                    className="w-full h-14 pr-12 pl-10 bg-slate-50/50 border border-slate-100 rounded-[1.25rem] font-black text-sm text-slate-700 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none appearance-none"
                  >
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">نمط الرؤية البيانية</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'bar', icon: BarChart3, label: 'أعمدة' },
                    { id: 'pie', icon: PieChartIcon, label: 'دائري' },
                    { id: 'line', icon: LineChartIcon, label: 'مسار' },
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setChartType(type.id as any)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-3",
                        chartType === type.id 
                          ? "border-indigo-500 bg-indigo-50/50 text-indigo-600 shadow-sm" 
                          : "border-slate-50 text-slate-300 hover:border-slate-100"
                      )}
                    >
                      <type.icon size={22} />
                      <span className="text-[10px] font-black uppercase">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {stats && (
              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl space-y-6 overflow-hidden relative group">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500 opacity-20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                <h3 className="font-black text-xl tracking-tight">خلاصة التحليل</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Row Count</span>
                    <span className="font-black font-mono text-indigo-400 text-lg">{stats.total}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Discrete Ops</span>
                    <span className="font-black font-mono text-indigo-400 text-lg">{stats.labels.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Focus Col</span>
                    <span className="font-black text-xs truncate max-w-[120px] text-slate-200">{analysisColumn}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FIX: removed ref={reportRef} from this visible content div (was colliding with hidden PDF div) */}
          <div className="lg:col-span-8 space-y-10">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-8 rounded-[2.5rem] flex items-center justify-between group">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">القيمة الطاغية</p>
                    <p className="text-2xl font-black text-indigo-600 truncate max-w-[200px]">{stats.labels[stats.values.indexOf(Math.max(...stats.values))]}</p>
                    <p className="text-[11px] font-bold text-slate-400">تحتل نسبة {stats.percentages[stats.values.indexOf(Math.max(...stats.values))]}%</p>
                  </div>
                  <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform"><Check size={32} strokeWidth={3} /></div>
                </div>
                 <div className="glass-card p-8 rounded-[2.5rem] flex items-center justify-between group">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">كثافة العينـات</p>
                    <p className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{(stats.total / stats.labels.length).toFixed(1)}</p>
                    <p className="text-[11px] font-bold text-slate-400">متوسط السجلات لكل فئة</p>
                  </div>
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform"><TableIcon size={32} /></div>
                </div>
              </div>
            )}

            <div className="glass-card rounded-[3rem] p-12 min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between mb-12">
                 <div className="space-y-1">
                   <h3 className="text-2xl weapon-text text-slate-900 tracking-tight">التمثيل البياني للتوزيع</h3>
                   <p className="text-xs font-bold text-slate-400 italic">عمود التحليل: {analysisColumn}</p>
                 </div>
                 {stats && <div className="px-4 py-1.5 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-black uppercase border border-indigo-100 shadow-sm">Real-time Feed</div>}
              </div>
              <div className="flex-1 relative">
                {chartType === 'bar' && (
                  <Bar 
                    data={chartData} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      plugins: { 
                        legend: { display: false },
                        tooltip: { backgroundColor: '#0F172A', titleFont: { family: 'Tajawal', weight: 'bold' }, bodyFont: { family: 'Tajawal' }, padding: 12, cornerRadius: 12 }
                      },
                      scales: {
                        y: { grid: { color: 'rgba(241, 245, 249, 0.5)' }, ticks: { font: { family: 'Tajawal', weight: 'bold' }, color: '#94a3b8' } },
                        x: { grid: { display: false }, ticks: { font: { family: 'Tajawal', weight: 'bold' }, color: '#64748b' } }
                      }
                    }} 
                  />
                )}
                {chartType === 'pie' && (
                  <Pie 
                    data={chartData} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom', labels: { font: { family: 'Tajawal', weight: 'bold' }, usePointStyle: true, padding: 25, color: '#64748b' } }
                      }
                    }} 
                  />
                )}
                {chartType === 'line' && <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}
              </div>
            </div>

            <div className="glass-card rounded-[3rem] overflow-hidden">
              <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><Search size={22} /></div>
                   <h3 className="text-xl weapon-text text-slate-900">سجل البيانات المستوردة</h3>
                </div>
                <div className="relative w-72">
                  <input
                    type="text"
                    placeholder="ابحث في السجلات..."
                    className="w-full pr-12 pl-4 h-12 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-sans"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-right border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md">
                    <tr>
                      {columns.filter(c => visibleColumns.includes(c)).map(col => (
                        <th key={col} className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/30">
                    {filteredData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-indigo-50/20 transition-all">
                        {columns.filter(c => visibleColumns.includes(c)).map(col => (
                          <td key={col} className="px-10 py-5 text-sm font-bold text-slate-600">
                            {row[col] !== undefined ? String(row[col]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredData.length > 50 && (
                <div className="px-10 py-5 text-center text-xs font-bold text-slate-400 bg-slate-50 border-t border-slate-100">
                  تم عرض أول 50 سجل من أصل {filteredData.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden Printable Report Section — uses opacity:0 + z-index:-1 instead of left:-9999px so html2canvas can measure it correctly */}
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
        <div id="pdf-report" ref={pdfReportRef} className="p-20 bg-white space-y-12" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif', color: '#0f172a', width: '1000px', backgroundColor: '#ffffff' }}>
          <div className="flex justify-between items-start pb-10" style={{ borderBottom: '2px solid #f1f5f9' }}>
            <div className="space-y-2">
              <h1 className="text-5xl font-black" style={{ color: '#0f172a' }}>تقرير البيانات المباشرة</h1>
              <p className="font-bold text-xl uppercase tracking-widest" style={{ color: '#94a3b8' }}>Live Data Analysis Report</p>
            </div>
            <div className="text-right space-y-1">
              <p className="font-black text-lg" style={{ color: '#0f172a' }}>{new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' })}</p>
              <p className="font-bold uppercase text-[10px] tracking-tighter" style={{ color: '#94a3b8' }}>Generated by Jamaa Platform</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
             <div className="p-8 rounded-3xl space-y-1" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
               <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>تحليل عمود</p>
               <p className="text-2xl font-black" style={{ color: '#4f46e5' }}>{analysisColumn || "غير محدد"}</p>
             </div>
             <div className="p-8 rounded-3xl space-y-1" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
               <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>إجمالي السجلات</p>
               <p className="text-2xl font-black" style={{ color: '#0f172a' }}>{data.length} سجل</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-10">
               <h3 className="text-xl font-black pr-4" style={{ color: '#0f172a', borderRight: '4px solid #4f46e5' }}>تفاصيل الفئات</h3>
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
                 <h3 className="text-sm font-black uppercase mb-4 text-center" style={{ color: '#94a3b8' }}>التوزيع النسبي</h3>
                 <Pie 
                  data={chartData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { 
                      legend: { position: 'bottom', labels: { font: { weight: 'bold', size: 10, family: 'Tajawal' }, color: '#64748b' } },
                    } 
                  }} 
                />
               </div>
               <div style={{ height: '256px', paddingTop: '32px' }}>
                 <h3 className="text-sm font-black uppercase mb-4 text-center" style={{ color: '#94a3b8' }}>التمثيل البياني</h3>
                 <Bar 
                  data={chartData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { 
                      legend: { display: false },
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
            <p className="text-[10px] font-black uppercase tracking-[0.5em]" style={{ color: '#cbd5e1' }}>End of Official Report • Jamaa System</p>
          </div>
        </div>
      </div>
    </div>
  );
}
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
  AlertCircle,
  Layers,
  X
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
  
  // NEW: workbook state for multi-sheet handling
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  
  const pdfReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialColumns.length > 0 && !analysisColumn) {
      setAnalysisColumn(initialColumns[0]);
    }
  }, [initialColumns]);

  // Extracted: load a specific sheet from the workbook into state
  const loadSheet = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
    try {
      const worksheet = wb.Sheets[sheetName];
      if (!worksheet) {
        setErrorMsg(`الورقة "${sheetName}" غير موجودة.`);
        return;
      }
      const json = XLSX.utils.sheet_to_json(worksheet);
      
      if (json.length > 0) {
        const cols = Object.keys(json[0] as object);
        setData(json);
        setColumns(cols);
        setVisibleColumns(cols);
        setAnalysisColumn(cols[0]);
        setCurrentSheet(sheetName);
        onDataUpdate(json, cols);
        setErrorMsg(null);
      } else {
        setErrorMsg(`الورقة "${sheetName}" فارغة.`);
      }
    } catch (err) {
      console.error("Error loading sheet:", err);
      setErrorMsg("حدث خطأ أثناء قراءة الورقة.");
    }
  }, [onDataUpdate]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const binaryStr = e.target?.result;
        const wb = XLSX.read(binaryStr, { type: 'binary' });
        const names = wb.SheetNames;
        
        if (names.length === 0) {
          setErrorMsg("الملف لا يحتوي على أي ورقة.");
          setLoading(false);
          return;
        }

        setWorkbook(wb);
        setSheetNames(names);

        if (names.length === 1) {
          // Single sheet — load directly
          loadSheet(wb, names[0]);
        } else {
          // Multiple sheets — show picker
          setShowSheetPicker(true);
        }
      } catch (err) {
        console.error("Error reading file:", err);
        setErrorMsg("حدث خطأ أثناء قراءة الملف. المرجو التأكد من صحة التنسيق.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, [loadSheet]);

  // Compute a quick preview (rows × columns) for each sheet, shown in the picker
  const sheetPreviews = useMemo(() => {
    if (!workbook) return {};
    const previews: Record<string, { rows: number; cols: number }> = {};
    sheetNames.forEach(name => {
      try {
        const ws = workbook.Sheets[name];
        const json = XLSX.utils.sheet_to_json(ws);
        const cols = json.length > 0 ? Object.keys(json[0] as object).length : 0;
        previews[name] = { rows: json.length, cols };
      } catch {
        previews[name] = { rows: 0, cols: 0 };
      }
    });
    return previews;
  }, [workbook, sheetNames]);

  const handleSheetSelect = (sheetName: string) => {
    if (!workbook) return;
    loadSheet(workbook, sheetName);
    setShowSheetPicker(false);
  };

  // Allow switching between sheets after the file is loaded
  const handleSwitchSheet = (sheetName: string) => {
    if (!workbook || sheetName === currentSheet) return;
    loadSheet(workbook, sheetName);
  };

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
    setWorkbook(null);
    setSheetNames([]);
    setCurrentSheet('');
    setFileName('');
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

      {/* NEW: Sheet tabs bar — shown when workbook has multiple sheets and one is loaded */}
      {data.length > 0 && sheetNames.length > 1 && (
        <div className="glass-card rounded-[2rem] p-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest px-3">
            <Layers size={14} />
            <span>أوراق الملف</span>
          </div>
          {sheetNames.map(name => (
            <button
              key={name}
              onClick={() => handleSwitchSheet(name)}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-xs font-black transition-all",
                currentSheet === name
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              {name}
              {sheetPreviews[name] && (
                <span className={cn(
                  "mr-2 text-[9px] font-mono",
                  currentSheet === name ? "text-indigo-200" : "text-slate-300"
                )}>
                  {sheetPreviews[name].rows}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

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
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Focus Col</span>
                    <span className="font-black text-xs truncate max-w-[120px] text-slate-200">{analysisColumn}</span>
                  </div>
                  {currentSheet && (
                    <div className="flex justify-between items-center py-3">
                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Active Sheet</span>
                      <span className="font-black text-xs truncate max-w-[120px] text-emerald-400">{currentSheet}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

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
      
      {/* NEW: Sheet picker modal — shown when file has multiple sheets */}
      <AnimatePresence>
        {showSheetPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6"
            onClick={() => {
              // Allow closing without selection only if data already exists
              if (data.length > 0) setShowSheetPicker(false);
            }}
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] p-12 max-w-2xl w-full shadow-2xl space-y-8 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
                    <Layers size={26} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">اختر ورقة للعرض</h3>
                    <p className="text-sm font-bold text-slate-400">
                      الملف <span className="text-indigo-500">{fileName}</span> يحتوي على {sheetNames.length} أوراق
                    </p>
                  </div>
                </div>
                {data.length > 0 && (
                  <button
                    onClick={() => setShowSheetPicker(false)}
                    className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 transition-all"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {sheetNames.map((name, i) => {
                  const preview = sheetPreviews[name];
                  const isEmpty = preview && preview.rows === 0;
                  return (
                    <button
                      key={name}
                      onClick={() => !isEmpty && handleSheetSelect(name)}
                      disabled={isEmpty}
                      className={cn(
                        "w-full text-right p-6 rounded-3xl border-2 transition-all flex items-center justify-between group",
                        isEmpty 
                          ? "border-slate-50 bg-slate-50/30 opacity-50 cursor-not-allowed"
                          : "border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer active:scale-[0.99]"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all",
                          isEmpty 
                            ? "bg-slate-100 text-slate-300"
                            : "bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white"
                        )}>
                          {i + 1}
                        </div>
                        <div className="space-y-0.5 text-right">
                          <p className="font-black text-base text-slate-900">{name}</p>
                          {preview && (
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {isEmpty ? "فارغة" : `${preview.rows} سجل × ${preview.cols} عمود`}
                            </p>
                          )}
                        </div>
                      </div>
                      {!isEmpty && (
                        <div className="w-10 h-10 bg-slate-50 group-hover:bg-indigo-500 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-white transition-all">
                          <Check size={18} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">
                يمكنك التبديل بين الأوراق لاحقاً من الشريط العلوي
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
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
              <h1 className="text-5xl font-black" style={{ color: '#0f172a' }}>تقرير البيانات المباشرة</h1>
              <p className="font-bold text-xl uppercase tracking-widest" style={{ color: '#94a3b8' }}>Live Data Analysis Report</p>
              {currentSheet && (
                <p className="font-black text-sm" style={{ color: '#4f46e5' }}>الورقة: {currentSheet}</p>
              )}
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
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, Settings2, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  Download, Trash2, Table as TableIcon, Check, ChevronDown, Search, Eye, EyeOff,
  LayoutGrid, AlertCircle, Layers, X
} from 'lucide-react';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, 
  Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../lib/utils';
import type { SheetData } from '../App';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler, ChartDataLabels
);

interface ImportProps {
  onDataUpdate: (data: any[], cols: string[], sheets?: SheetData[]) => void;
  initialData: any[];
  initialColumns: string[];
}

function excelSerialToDate(serial: number): Date | null {
  if (typeof serial !== 'number' || isNaN(serial)) return null;
  if (serial < 1 || serial > 100000) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return isNaN(date.getTime()) ? null : date;
}

function formatCellValue(value: any, isDateCol: boolean): string {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '-' : value.toLocaleDateString('fr-FR');
  }
  if (isDateCol && typeof value === 'number') {
    const d = excelSerialToDate(value);
    if (d) return d.toLocaleDateString('fr-FR');
  }
  return String(value);
}

function detectDateColumn(rows: any[], col: string): boolean {
  if (!rows.length) return false;
  let valid = 0, nonEmpty = 0;
  const sample = rows.slice(0, Math.min(30, rows.length));
  for (const r of sample) {
    const v = r[col];
    if (v === null || v === undefined || v === '') continue;
    nonEmpty++;
    if (v instanceof Date && !isNaN(v.getTime())) valid++;
    else if (typeof v === 'number' && excelSerialToDate(v)) valid++;
  }
  return nonEmpty > 0 && (valid / nonEmpty) >= 0.5;
}

// ============================================================================
// Smart sheet cleaning
// Strips unnamed columns (e.g. "__EMPTY", "__EMPTY_1"), columns where every
// cell is blank, and rows where every cell is blank. Returns the trimmed
// rows + the meaningful column order. Never throws — returns empty result
// if nothing useful is found so the caller can show a friendly message.
// ============================================================================
function cleanSheetData(rawRows: any[]): { rows: any[]; columns: string[] } {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { rows: [], columns: [] };
  }

  const isBlank = (v: any) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  // Pass 1: collect candidate columns from the union of all row keys
  // (using only the first row's keys misses sparse data).
  const allKeys = new Set<string>();
  for (const row of rawRows) {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach(k => allKeys.add(k));
    }
  }

  // Pass 2: keep columns that (a) have a real header name and (b) contain
  // at least one non-blank value across all rows.
  const keptColumns: string[] = [];
  for (const key of allKeys) {
    // SheetJS auto-names headerless columns "__EMPTY", "__EMPTY_1", etc.
    // Also skip purely-whitespace headers and stray blank keys.
    const trimmedKey = String(key).trim();
    if (!trimmedKey) continue;
    if (/^__EMPTY(_\d+)?$/i.test(trimmedKey)) continue;

    // Check if at least one row has data for this column
    let hasData = false;
    for (const row of rawRows) {
      if (row && !isBlank(row[key])) { hasData = true; break; }
    }
    if (hasData) keptColumns.push(key);
  }

  if (keptColumns.length === 0) {
    return { rows: [], columns: [] };
  }

  // Pass 3: rebuild rows containing only the kept columns, dropping
  // any row that has no values in any of those columns.
  const cleanedRows: any[] = [];
  for (const row of rawRows) {
    if (!row || typeof row !== 'object') continue;
    const cleanedRow: Record<string, any> = {};
    let rowHasAny = false;
    for (const col of keptColumns) {
      const v = row[col];
      if (!isBlank(v)) {
        cleanedRow[col] = v;
        rowHasAny = true;
      } else {
        cleanedRow[col] = '';
      }
    }
    if (rowHasAny) cleanedRows.push(cleanedRow);
  }

  return { rows: cleanedRows, columns: keptColumns };
}

// Shared chart option factories — same as Statistics for visual consistency
function buildDonutOptions(opts: { total: number; isPdf?: boolean; cutout?: string; valueSize?: number; legendSize?: number; }) {
  const { total, isPdf = false, cutout, valueSize, legendSize } = opts;
  return {
    maintainAspectRatio: false,
    cutout: cutout ?? (isPdf ? '55%' : '60%'),
    layout: { padding: isPdf ? 16 : 24 },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle' as const,
          padding: isPdf ? 18 : 30,
          boxWidth: 12, boxHeight: 12,
          font: { family: 'Tajawal', weight: 'bold' as const, size: legendSize ?? (isPdf ? 13 : 15) },
          color: '#475569',
        },
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold' as const, size: valueSize ?? (isPdf ? 16 : 20), family: 'Tajawal' },
        textAlign: 'center' as const,
        formatter: (v: number) => {
          if (!total) return '';
          if (v < total * 0.04) return '';
          const pct = ((v / total) * 100).toFixed(1);
          return `${v}\n${pct}%`;
        },
      },
      tooltip: {
        backgroundColor: '#0f172a', padding: 14, cornerRadius: 12,
        titleFont: { family: 'Tajawal', weight: 'bold' as const, size: 14 },
        bodyFont: { family: 'Tajawal', size: 13 },
      },
    },
  };
}

function buildBarOptions(opts: { isPdf?: boolean; showPercents?: number[] | string[]; color?: string; }) {
  const { isPdf = false, showPercents, color = '#6366f1' } = opts;
  return {
    maintainAspectRatio: false,
    layout: { padding: { top: isPdf ? 12 : 24 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end' as const,
        align: 'top' as const,
        color,
        font: { weight: 'bold' as const, size: isPdf ? 11 : 13, family: 'Tajawal' },
        textAlign: 'center' as const,
        offset: 6,
        formatter: (v: number, ctx: any) => {
          if (showPercents) return `${v}\n${showPercents[ctx.dataIndex]}%`;
          return v;
        },
      },
    },
    scales: {
      y: { grid: { color: 'rgba(241,245,249,0.7)' }, ticks: { font: { weight: 'bold' as const, family: 'Tajawal', size: isPdf ? 11 : 13 }, color: '#64748b' } },
      x: { grid: { display: false }, ticks: { font: { weight: 'bold' as const, family: 'Tajawal', size: isPdf ? 11 : 13 }, color: '#475569' } },
    },
  };
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
  
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [allSheets, setAllSheets] = useState<SheetData[]>([]);
  
  const pdfReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialColumns.length > 0 && !analysisColumn) {
      setAnalysisColumn(initialColumns[0]);
    }
  }, [initialColumns]);

  const dateColumnSet = useMemo(() => {
    const set = new Set<string>();
    columns.forEach(c => { if (detectDateColumn(data, c)) set.add(c); });
    return set;
  }, [data, columns]);

  const parseAllSheets = useCallback((wb: XLSX.WorkBook): SheetData[] => {
    const sheets: SheetData[] = [];
    wb.SheetNames.forEach(name => {
      try {
        const ws = wb.Sheets[name];
        // raw JSON first, then strip empty columns/rows so previews and
        // cross-sheet comparison only see meaningful data.
        const rawJson = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });
        const { rows, columns: cols } = cleanSheetData(rawJson);
        sheets.push({ name, rows, columns: cols });
      } catch (e) {
        // Never propagate — just record an empty sheet entry.
        console.warn(`Sheet "${name}" could not be parsed cleanly:`, e);
        sheets.push({ name, rows: [], columns: [] });
      }
    });
    return sheets;
  }, []);

  const loadSheet = useCallback((wb: XLSX.WorkBook, sheetName: string, sheets?: SheetData[]) => {
    try {
      const worksheet = wb.Sheets[sheetName];
      if (!worksheet) {
        setErrorMsg(`الورقة "${sheetName}" غير موجودة.`);
        return;
      }

      // Parse everything, then run through the cleaner to drop empty columns,
      // unnamed columns (__EMPTY*), and fully-blank rows.
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });
      const { rows, columns: cols } = cleanSheetData(rawJson);

      if (cols.length === 0 || rows.length === 0) {
        // No real data at all — show a soft message, don't throw.
        setData([]);
        setColumns([]);
        setVisibleColumns([]);
        setAnalysisColumn('');
        setCurrentSheet(sheetName);
        onDataUpdate([], [], sheets ?? allSheets);
        setErrorMsg(`الورقة "${sheetName}" لا تحتوي على بيانات قابلة للتحليل.`);
        return;
      }

      setData(rows);
      setColumns(cols);
      setVisibleColumns(cols);
      setAnalysisColumn(cols[0]);
      setCurrentSheet(sheetName);
      onDataUpdate(rows, cols, sheets ?? allSheets);
      setErrorMsg(null);
    } catch (err) {
      // Even on unexpected errors, fall back gracefully instead of leaving
      // the user staring at a hard error.
      console.error("Error loading sheet:", err);
      setErrorMsg(`تعذّر قراءة الورقة "${sheetName}" بشكل كامل. تم تخطّي الأعمدة الفارغة.`);
    }
  }, [onDataUpdate, allSheets]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setLoading(true); setErrorMsg(null); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const binaryStr = e.target?.result;
        const wb = XLSX.read(binaryStr, { type: 'binary', cellDates: true, cellNF: false, cellText: false });
        const names = wb.SheetNames;
        if (names.length === 0) { setErrorMsg("الملف لا يحتوي على أي ورقة."); setLoading(false); return; }
        setWorkbook(wb); setSheetNames(names);
        const parsed = parseAllSheets(wb);
        setAllSheets(parsed);
        if (names.length === 1) loadSheet(wb, names[0], parsed);
        else setShowSheetPicker(true);
      } catch (err) {
        console.error("Error reading file:", err);
        setErrorMsg("حدث خطأ أثناء قراءة الملف.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, [loadSheet, parseAllSheets]);

  const sheetPreviews = useMemo(() => {
    const previews: Record<string, { rows: number; cols: number }> = {};
    allSheets.forEach(s => { previews[s.name] = { rows: s.rows.length, cols: s.columns.length }; });
    return previews;
  }, [allSheets]);

  const handleSheetSelect = (sheetName: string) => {
    if (!workbook) return;
    loadSheet(workbook, sheetName, allSheets);
    setShowSheetPicker(false);
  };
  const handleSwitchSheet = (sheetName: string) => {
    if (!workbook || sheetName === currentSheet) return;
    loadSheet(workbook, sheetName, allSheets);
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
    return data.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [data, searchTerm]);

  const stats = useMemo(() => {
    if (!data.length || !analysisColumn) return null;
    const isDateCol = dateColumnSet.has(analysisColumn);
    const counts: Record<string, number> = {};
    data.forEach(row => {
      const raw = row[analysisColumn];
      let val: string;
      if (raw === null || raw === undefined || raw === '') val = 'غير محدد';
      else if (isDateCol) val = formatCellValue(raw, true);
      else val = String(raw);
      counts[val] = (counts[val] || 0) + 1;
    });
    const total = data.length;
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const percentages = values.map(v => ((v / total) * 100).toFixed(1));
    return { labels, values, percentages, counts, total };
  }, [data, analysisColumn, dateColumnSet]);

  const softColors = [
    'rgba(16, 185, 129, 0.85)','rgba(139, 92, 246, 0.85)','rgba(59, 130, 246, 0.85)',
    'rgba(236, 72, 153, 0.85)','rgba(245, 158, 11, 0.85)','rgba(20, 184, 166, 0.85)',
    'rgba(99, 102, 241, 0.85)','rgba(100, 116, 139, 0.85)',
  ];

  const chartData = {
    labels: stats?.labels || [],
    datasets: [{
      label: 'العدد', data: stats?.values || [],
      backgroundColor: softColors, borderWidth: 0, borderRadius: 8, spacing: 4,
    }]
  };

  const handleGeneratePDF = async () => {
    if (isGeneratingPDF) return;
    if (!data.length) { setErrorMsg("المرجو رفع ملف Excel أولا"); return; }
    if (!pdfReportRef.current) { setErrorMsg("لا يمكن إنشاء التقرير حالياً."); return; }
    try {
      setIsGeneratingPDF(true); setErrorMsg(null);
      // Wait for fonts to be fully loaded before snapshotting
      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch {}
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      const canvas = await html2canvas(pdfReportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      if (!canvas || canvas.width === 0) throw new Error("Failed to capture report as image");
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfPageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfPageHeight;
      }
      pdf.save("تقرير-الاحصائيات.pdf");
    } catch (error) {
      console.error("PDF Generation Error:", error);
      setErrorMsg("حدث خطأ أثناء إنشاء ملف PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const toggleColumnVisibility = (col: string) => {
    setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const clearData = () => {
    setData([]); setColumns([]); setVisibleColumns([]); setAnalysisColumn('');
    onDataUpdate([], []);
    setErrorMsg(null); setWorkbook(null); setSheetNames([]); setCurrentSheet(''); setFileName(''); setAllSheets([]);
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
            <button onClick={handleGeneratePDF} disabled={isGeneratingPDF}
              className="flex items-center gap-3 bg-emerald-500/90 text-white px-8 h-14 rounded-2xl font-black shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50">
              {isGeneratingPDF ? <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" /> : <Download size={20} />}
              <span>{isGeneratingPDF ? "جاري التحميل..." : "تصدير PDF"}</span>
            </button>
            <button onClick={clearData}
              className="flex items-center gap-3 bg-rose-500/90 text-white px-8 h-14 rounded-2xl font-black shadow-lg shadow-rose-500/10 hover:bg-rose-600 transition-all active:scale-95">
              <Trash2 size={20} />
              <span>مسح الكل</span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center gap-4 text-rose-600 font-black">
            <AlertCircle size={24} />{errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {data.length > 0 && sheetNames.length > 1 && (
        <div className="glass-card rounded-[2rem] p-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest px-3">
            <Layers size={14} /><span>أوراق الملف</span>
          </div>
          {sheetNames.map(name => (
            <button key={name} onClick={() => handleSwitchSheet(name)}
              className={cn("px-5 py-2.5 rounded-2xl text-xs font-black transition-all",
                currentSheet === name ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-slate-50 text-slate-500 hover:bg-slate-100")}>
              {name}
              {sheetPreviews[name] && (
                <span className={cn("mr-2 text-[9px] font-mono", currentSheet === name ? "text-indigo-200" : "text-slate-300")}>
                  {sheetPreviews[name].rows}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!data.length ? (
        // Note: getRootProps() is on a plain div so its native event-handler types
        // don't clash with motion.div's framer-motion-typed onAnimationStart.
        <div {...getRootProps()}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
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
        </div>
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
                    <button key={col} onClick={() => toggleColumnVisibility(col)}
                      className={cn("px-4 py-2.5 rounded-2xl text-[11px] font-black border-2 transition-all flex items-center gap-3 uppercase tracking-wider",
                        visibleColumns.includes(col) ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-white border-slate-50 text-slate-300")}>
                      {visibleColumns.includes(col) ? <Eye size={14} /> : <EyeOff size={14} />}
                      {col}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">تحديد عمود التحليل</label>
                <div className="relative group">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><LayoutGrid size={18} /></div>
                  <select value={analysisColumn} onChange={(e) => setAnalysisColumn(e.target.value)}
                    className="w-full h-14 pr-12 pl-10 bg-slate-50/50 border border-slate-100 rounded-[1.25rem] font-black text-sm text-slate-700 outline-none appearance-none">
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
                    <button key={type.id} onClick={() => setChartType(type.id as any)}
                      className={cn("flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-3",
                        chartType === type.id ? "border-indigo-500 bg-indigo-50/50 text-indigo-600 shadow-sm" : "border-slate-50 text-slate-300 hover:border-slate-100")}>
                      <type.icon size={22} />
                      <span className="text-[10px] font-black uppercase">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {stats && (
              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl space-y-6 overflow-hidden relative group">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500 opacity-20 rounded-full blur-3xl" />
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

            <div className="glass-card rounded-[3rem] p-12 min-h-[560px] flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h3 className="text-2xl weapon-text text-slate-900 tracking-tight">التمثيل البياني للتوزيع</h3>
                  <p className="text-xs font-bold text-slate-400 italic">عمود التحليل: {analysisColumn}</p>
                </div>
                {stats && <div className="px-4 py-1.5 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-black uppercase border border-indigo-100 shadow-sm">Real-time Feed</div>}
              </div>
              <div className="flex-1 relative min-h-[440px]">
                {chartType === 'bar' && stats && (
                  <Bar data={chartData} options={buildBarOptions({ showPercents: stats.percentages })} />
                )}
                {chartType === 'pie' && stats && (
                  <Doughnut data={chartData} options={buildDonutOptions({ total: stats.total, cutout: '60%', valueSize: 18, legendSize: 14 })} />
                )}
                {chartType === 'line' && (
                  <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                )}
              </div>
            </div>

            <div className="glass-card rounded-[3rem] overflow-hidden">
              <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><Search size={22} /></div>
                  <h3 className="text-xl weapon-text text-slate-900">سجل البيانات المستوردة</h3>
                </div>
                <div className="relative w-72">
                  <input type="text" placeholder="ابحث في السجلات..."
                    className="w-full pr-12 pl-4 h-12 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-sans"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-right border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md">
                    <tr>
                      {columns.filter(c => visibleColumns.includes(c)).map(col => (
                        <th key={col} className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white whitespace-nowrap">
                          {col}
                          {dateColumnSet.has(col) && (
                            <span className="mr-2 text-[8px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">📅</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/30">
                    {filteredData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-indigo-50/20 transition-all">
                        {columns.filter(c => visibleColumns.includes(c)).map(col => {
                          const isDateCol = dateColumnSet.has(col);
                          const display = formatCellValue(row[col], isDateCol);
                          return (
                            <td key={col} className={cn("px-10 py-5 text-sm font-bold whitespace-nowrap", isDateCol ? "text-indigo-600 font-mono" : "text-slate-600")}>
                              {display}
                            </td>
                          );
                        })}
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

      <AnimatePresence>
        {showSheetPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6"
            onClick={() => { if (data.length > 0) setShowSheetPicker(false); }} dir="rtl">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] p-12 max-w-2xl w-full shadow-2xl space-y-8 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                    <Layers size={26} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">اختر ورقة للعرض</h3>
                    <p className="text-sm font-bold text-slate-400">الملف <span className="text-indigo-500">{fileName}</span> يحتوي على {sheetNames.length} أوراق</p>
                  </div>
                </div>
                {data.length > 0 && (
                  <button onClick={() => setShowSheetPicker(false)} className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                    <X size={18} />
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {sheetNames.map((name, i) => {
                  const preview = sheetPreviews[name];
                  const isEmpty = preview && preview.rows === 0;
                  return (
                    <button key={name} onClick={() => !isEmpty && handleSheetSelect(name)} disabled={isEmpty}
                      className={cn("w-full text-right p-6 rounded-3xl border-2 transition-all flex items-center justify-between group",
                        isEmpty ? "border-slate-50 bg-slate-50/30 opacity-50 cursor-not-allowed" : "border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer")}>
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm",
                          isEmpty ? "bg-slate-100 text-slate-300" : "bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white")}>
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
                        <div className="w-10 h-10 bg-slate-50 group-hover:bg-indigo-500 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-white">
                          <Check size={18} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HIDDEN PDF — clean centered header, dynamic distribution content */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '1000px', opacity: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden="true">
        <div id="pdf-report" ref={pdfReportRef} className="p-20 space-y-10" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif', color: '#0f172a', width: '1000px', backgroundColor: '#ffffff' }}>
          
          {/* Clean centered header — fixed Arabic shaping */}
          <div className="text-center pb-8" style={{ borderBottom: '3px solid #4f46e5' }}>
            <h1
              style={{
                color: '#0f172a',
                fontSize: '44px',
                fontWeight: 800,
                fontFamily: "'Tajawal', 'Cairo', 'Segoe UI', 'Arial', sans-serif",
                letterSpacing: 'normal',
                wordSpacing: 'normal',
                lineHeight: 1.4,
                direction: 'rtl',
                unicodeBidi: 'embed',
                margin: 0,
              }}
            >
              تقرير الإحصائيات
            </h1>
          </div>

          {stats && (
            <div className="space-y-8">
              {/* Main indicators */}
              <div className="grid grid-cols-3 gap-6">
                <div className="p-6 rounded-3xl text-center" style={{ backgroundColor: '#eef2ff', border: '1px solid #e0e7ff' }}>
                  <p className="text-[10px] font-black uppercase" style={{ color: '#6366f1' }}>إجمالي السجلات</p>
                  <p className="text-5xl font-black font-mono mt-3" style={{ color: '#4f46e5' }}>{stats.total}</p>
                </div>
                <div className="p-6 rounded-3xl text-center" style={{ backgroundColor: '#fdf2f8', border: '1px solid #fce7f3' }}>
                  <p className="text-[10px] font-black uppercase" style={{ color: '#ec4899' }}>عدد الفئات</p>
                  <p className="text-5xl font-black font-mono mt-3" style={{ color: '#db2777' }}>{stats.labels.length}</p>
                </div>
                <div className="p-6 rounded-3xl text-center" style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7' }}>
                  <p className="text-[10px] font-black uppercase" style={{ color: '#10b981' }}>أعلى نسبة</p>
                  <p className="text-5xl font-black font-mono mt-3" style={{ color: '#059669' }}>
                    {stats.percentages[stats.values.indexOf(Math.max(...stats.values))]}%
                  </p>
                </div>
              </div>

              <p className="text-sm font-black text-center" style={{ color: '#64748b' }}>
                عمود التحليل: <span style={{ color: '#4f46e5' }}>{analysisColumn}</span>
              </p>

              {/* Both charts side-by-side */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl" style={{ backgroundColor: '#f8fafc' }}>
                  <h3 className="text-sm font-black uppercase text-center mb-4" style={{ color: '#94a3b8' }}>التوزيع الدائري</h3>
                  <div style={{ height: '300px' }}>
                    <Doughnut data={chartData} options={buildDonutOptions({ total: stats.total, isPdf: true, cutout: '55%', valueSize: 13, legendSize: 11 })} />
                  </div>
                </div>
                <div className="p-6 rounded-3xl" style={{ backgroundColor: '#f8fafc' }}>
                  <h3 className="text-sm font-black uppercase text-center mb-4" style={{ color: '#94a3b8' }}>التمثيل بالأعمدة</h3>
                  <div style={{ height: '300px' }}>
                    <Bar data={chartData} options={buildBarOptions({ isPdf: true, showPercents: stats.percentages, color: '#4f46e5' })} />
                  </div>
                </div>
              </div>

              {/* Distribution table */}
              <div>
                <h3 className="text-base font-black mb-4 pr-3" style={{ color: '#0f172a', borderRight: '4px solid #4f46e5' }}>
                  توزيع القيم
                </h3>
                <table className="w-full text-right" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th className="px-6 py-3 text-xs font-black" style={{ color: '#475569' }}>الفئة</th>
                      <th className="px-6 py-3 text-xs font-black" style={{ color: '#475569' }}>التكرار</th>
                      <th className="px-6 py-3 text-xs font-black" style={{ color: '#475569' }}>النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.labels.map((l, i) => (
                      <tr key={l} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="px-6 py-3 text-sm font-black" style={{ color: '#0f172a' }}>{l}</td>
                        <td className="px-6 py-3 text-sm font-black font-mono" style={{ color: '#475569' }}>{stats.values[i]}</td>
                        <td className="px-6 py-3 text-sm font-black font-mono" style={{ color: '#4f46e5' }}>{stats.percentages[i]}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Statistical interpretation */}
              <div className="p-6 rounded-3xl" style={{ backgroundColor: '#eef2ff', border: '1px solid #e0e7ff' }}>
                <h3 className="text-base font-black mb-3" style={{ color: '#3730a3' }}>التفسير الإحصائي</h3>
                <p className="text-sm font-bold leading-relaxed" style={{ color: '#1e3a8a' }}>
                  بناءً على تحليل {stats.total} سجل موزعين على {stats.labels.length} فئة في عمود "{analysisColumn}"، 
                  تتصدر الفئة "<strong>{stats.labels[stats.values.indexOf(Math.max(...stats.values))]}</strong>" بنسبة {stats.percentages[stats.values.indexOf(Math.max(...stats.values))]}% ({Math.max(...stats.values)} سجل)،
                  بينما تأتي الفئة "<strong>{stats.labels[stats.values.indexOf(Math.min(...stats.values))]}</strong>" في المرتبة الأخيرة بنسبة {stats.percentages[stats.values.indexOf(Math.min(...stats.values))]}%.
                  {' '}متوسط السجلات لكل فئة هو {(stats.total / stats.labels.length).toFixed(1)}.
                </p>
              </div>
            </div>
          )}

          <div className="pt-10 text-center" style={{ borderTop: '1px solid #f1f5f9' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: '#cbd5e1' }}>Jamaa Platform</p>
          </div>
        </div>
      </div>
    </div>
  );
}
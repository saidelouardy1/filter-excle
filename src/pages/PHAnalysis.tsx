import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  CalendarDays, TrendingUp, Award, BarChart3,
  LineChart as LineChartIcon, AlertCircle, Download, Loader2,
  Filter, ChevronDown, Hash, FileText, CheckCircle2, Circle, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import jamaaLogo from '../images/jamaa.png';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// DO NOT call ChartJS.register() here — it is already done in Statistics.tsx
// ─────────────────────────────────────────────────────────────────────────────

interface PHAnalysisProps {
  data: any[];
  columns: string[];
}

interface MonthYearEntry {
  month: number;
  year: number;
  label: string;
  sortKey: number;
  count: number;
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

function todayWestern(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseDate(value: any): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    if (value < 1 || value > 200000) return null;
    const d = new Date((value - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(value).trim();
  if (!str) return null;
  const native = new Date(str);
  if (!isNaN(native.getTime())) return native;
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const date = new Date(year, parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function isDateColumn(data: any[], column: string): boolean {
  if (!data.length) return false;
  let valid = 0, nonEmpty = 0;
  const sample = data.slice(0, Math.min(50, data.length));
  for (const row of sample) {
    const v = row[column];
    if (v === null || v === undefined || v === '') continue;
    nonEmpty++;
    if (parseDate(v) !== null) valid++;
  }
  if (nonEmpty === 0) return false;
  return (valid / nonEmpty) >= 0.5;
}

// ── Compute analysis ────────────────────────────────────────────────────────
function computeAnalysis(data: any[], phCol: string) {
  if (!data.length || !phCol) return null;

  const countMap: Record<number, MonthYearEntry> = {};
  let totalValid = 0;

  for (const row of data) {
    const date = parseDate(row[phCol]);
    if (!date) continue;
    totalValid++;
    const month = date.getMonth();
    const year = date.getFullYear();
    const sortKey = year * 100 + month;
    if (!countMap[sortKey]) {
      countMap[sortKey] = {
        month, year,
        label: `${MONTH_NAMES_FR[month]} ${year}`,
        sortKey, count: 0,
      };
    }
    countMap[sortKey].count++;
  }

  const entries = Object.values(countMap).sort((a, b) => a.sortKey - b.sortKey);
  const bestEntry = entries.length
    ? entries.reduce((b, e) => (e.count > b.count ? e : b), entries[0])
    : null;

  const yearMap: Record<number, number> = {};
  entries.forEach(e => { yearMap[e.year] = (yearMap[e.year] || 0) + e.count; });
  let bestYear = 0, bestYearCount = 0;
  Object.entries(yearMap).forEach(([y, c]) => {
    if (c > bestYearCount) { bestYearCount = c; bestYear = parseInt(y); }
  });

  return { totalRows: data.length, totalValid, entries, bestEntry, bestYear, bestYearCount, yearMap };
}

type PdfSection = 'chart' | 'table';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PHAnalysis({ data, columns }: PHAnalysisProps) {
  const [chartMode, setChartMode] = useState<'bar' | 'line'>('bar');
  const [selectedCol, setSelectedCol] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPdfPicker, setShowPdfPicker] = useState(false);
  const [pdfSections, setPdfSections] = useState<Set<PdfSection>>(new Set(['chart', 'table']));
  const [activePdfSections, setActivePdfSections] = useState<Set<PdfSection>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pdfReportRef = useRef<HTMLDivElement>(null);

  // ── Auto-detect date columns ──────────────────────────────────────────────
  const dateColumns = useMemo(() => columns.filter(col => isDateColumn(data, col)), [data, columns]);

  // Auto-select first date column on mount / columns change
  React.useEffect(() => {
    if (!selectedCol && dateColumns.length > 0) {
      setSelectedCol(dateColumns[0]);
    }
  }, [dateColumns]);

  const analysis = useMemo(() => computeAnalysis(data, selectedCol), [data, selectedCol]);

  // ── PDF generation (html2canvas — same as Statistics.tsx) ─────────────────
  const generatePDF = useCallback(async () => {
    if (isGeneratingPDF || !pdfReportRef.current) return;
    try {
      setIsGeneratingPDF(true);
      setErrorMsg(null);

      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch { }
      }
      await new Promise(resolve => setTimeout(resolve, 700));

      const canvas = await html2canvas(pdfReportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1000,
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const marginTopPage1 = 1;
      const marginTopRest = 14;
      const marginBottom = 8;
      const marginLeft = 12;
      const marginRight = 12;
      const usableWidth = pdfWidth - marginLeft - marginRight;

      let sourceY = 0;
      let pageIndex = 0;

      while (sourceY < canvas.height) {
        const marginTop = pageIndex === 0 ? marginTopPage1 : marginTopRest;
        const usableHeight = pdfHeight - marginTop - marginBottom;
        const sliceHeightPx = Math.floor((usableHeight * canvas.width) / usableWidth);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(sliceHeightPx, canvas.height - sourceY);

        const ctx = pageCanvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context error');

        ctx.drawImage(canvas, 0, sourceY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);

        const imgData = pageCanvas.toDataURL('image/png');
        const imgHeight = (pageCanvas.height * usableWidth) / canvas.width;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', marginLeft, marginTop, usableWidth, imgHeight);

        sourceY += sliceHeightPx;
        pageIndex++;
      }

      pdf.save(`تقرير-تحليل-PH-${Date.now()}.pdf`);
      setActivePdfSections(new Set());
    } catch (error) {
      console.error('PDF Generation Error:', error);
      setErrorMsg('حدث خطأ أثناء إنشاء ملف PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [isGeneratingPDF]);

  const handleOpenPdfPicker = () => {
    if (!data.length || !analysis || analysis.totalValid === 0) {
      setErrorMsg('لا توجد بيانات صالحة للتصدير.');
      return;
    }
    setErrorMsg(null);
    setPdfSections(new Set(['chart', 'table']));
    setShowPdfPicker(true);
  };

  const togglePdfSection = (s: PdfSection) => {
    setPdfSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const handleConfirmPdfExport = async () => {
    if (pdfSections.size === 0) { setErrorMsg('المرجو اختيار قسم واحد على الأقل.'); return; }
    setActivePdfSections(new Set(pdfSections));
    setShowPdfPicker(false);
    await new Promise(resolve => setTimeout(resolve, 500));
    await generatePDF();
  };

  // ── Empty states ──────────────────────────────────────────────────────────
  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <CalendarDays size={56} strokeWidth={1.5} className="text-slate-300" />
        <p className="font-black text-lg text-slate-400">
          Importez un fichier Excel pour analyser les PH
        </p>
      </div>
    );
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  const entries = analysis?.entries || [];
  const bestEntry = analysis?.bestEntry || null;
  const totalValid = analysis?.totalValid || 0;
  const bestYear = analysis?.bestYear || 0;
  const bestYearCount = analysis?.bestYearCount || 0;

  const chartLabels = entries.map(e => e.label);
  const chartValues = entries.map(e => e.count);

  const barChartData = {
    labels: chartLabels,
    datasets: [{
      label: 'PH délivrés',
      data: chartValues,
      backgroundColor: entries.map(e =>
        bestEntry && e.sortKey === bestEntry.sortKey
          ? 'rgba(99,102,241,0.95)'
          : 'rgba(99,102,241,0.45)'
      ),
      borderRadius: 8,
      borderWidth: 0,
    }],
  };

  const lineChartData = {
    labels: chartLabels,
    datasets: [{
      label: 'PH délivrés',
      data: chartValues,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      borderWidth: 3,
      pointBackgroundColor: '#6366f1',
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.35,
      fill: true,
    }],
  };

  const barOptions: any = {
    maintainAspectRatio: false,
    layout: { padding: { top: 32 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end', align: 'top', color: '#4f46e5',
        font: { weight: 'bold', size: 12, family: 'Tajawal' },
        offset: 4, formatter: (v: number) => v,
      },
      tooltip: {
        backgroundColor: '#0f172a', padding: 12, cornerRadius: 12,
        callbacks: { label: (ctx: any) => ` ${ctx.parsed.y} PH délivrés` },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(241,245,249,0.8)' },
        ticks: { font: { weight: 'bold', family: 'Tajawal', size: 12 }, color: '#94a3b8', stepSize: 1 },
      },
      x: {
        grid: { display: false },
        ticks: { font: { weight: 'bold', family: 'Tajawal', size: 11 }, color: '#475569', maxRotation: 45 },
      },
    },
  };

  const lineOptions: any = {
    maintainAspectRatio: false,
    layout: { padding: { top: 32 } },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: '#0f172a', padding: 12, cornerRadius: 12,
        callbacks: { label: (ctx: any) => ` ${ctx.parsed.y} PH délivrés` },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(241,245,249,0.8)' },
        ticks: { font: { weight: 'bold', family: 'Tajawal', size: 12 }, color: '#94a3b8', stepSize: 1 },
      },
      x: {
        grid: { display: false },
        ticks: { font: { weight: 'bold', family: 'Tajawal', size: 11 }, color: '#475569', maxRotation: 45 },
      },
    },
  };

  // PDF chart options (same shape, lighter)
  const pdfBarOptions: any = {
    ...barOptions,
    maintainAspectRatio: false,
    plugins: {
      ...barOptions.plugins,
      datalabels: {
        ...barOptions.plugins.datalabels,
        font: { weight: 'bold', size: 11, family: 'Tajawal' },
      },
    },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 pb-16 max-w-[1400px] mx-auto pt-8" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] bg-indigo-50 w-fit px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
            <CalendarDays size={14} />
            <span>Analyse PH</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">تحليل حسب تاريخ التسليم</h2>
          <p className="text-slate-400 font-medium text-lg">
            Analyse des permis d'habiter délivrés
          </p>
          {errorMsg && <p className="text-rose-600 font-black text-sm">{errorMsg}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* ── Column selector ── */}
          <div className="relative">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Filter size={18} />
            </div>
            <select
              className="bg-white/70 backdrop-blur-md border border-slate-200/50 hover:border-indigo-100 rounded-2xl pr-12 pl-12 h-14 min-w-[260px] font-black text-slate-700 outline-none appearance-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-500/5 text-sm"
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
            >
              <option value="">-- اختر عمود التاريخ --</option>
              {/* Date columns first, then all columns */}
              {dateColumns.length > 0 && (
                <>
                  <optgroup label="أعمدة التاريخ المكتشفة">
                    {dateColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="كل الأعمدة">
                    {columns.filter(c => !dateColumns.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                </>
              )}
              {dateColumns.length === 0 && columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <ChevronDown size={18} />
            </div>
          </div>

          {/* ── PDF Export Button ── */}
          <button
            onClick={handleOpenPdfPicker}
            disabled={isGeneratingPDF}
            className={cn(
              'flex items-center gap-3 px-7 py-3.5 rounded-2xl text-sm font-black transition-all shadow-lg h-14',
              isGeneratingPDF
                ? 'bg-emerald-300 text-white cursor-not-allowed shadow-emerald-200'
                : 'bg-emerald-500/90 hover:bg-emerald-600 active:scale-95 text-white shadow-emerald-500/20 hover:shadow-emerald-500/40'
            )}
          >
            {isGeneratingPDF
              ? <Loader2 size={18} className="animate-spin" />
              : <Download size={18} />
            }
            {isGeneratingPDF ? 'جاري التحميل...' : 'تقرير PDF'}
          </button>
        </div>
      </div>

      {/* ── No column selected ── */}
      {!selectedCol && (
        <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2rem] flex items-center gap-5 text-indigo-700 font-bold">
          <Filter size={28} className="shrink-0 text-indigo-400" />
          <div>
            <p className="font-black text-base">اختر عمود التاريخ</p>
            <p className="text-sm font-medium text-indigo-500 mt-1">
              اختر عمود يحتوي على تواريخ تسليم رخصة السكن من القائمة أعلاه.
            </p>
          </div>
        </div>
      )}

      {/* ── No valid dates ── */}
      {selectedCol && analysis && analysis.totalValid === 0 && (
        <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] flex items-center gap-5 text-amber-700 font-bold">
          <AlertCircle size={28} className="shrink-0 text-amber-400" />
          <div>
            <p className="font-black text-base">لا توجد تواريخ صالحة</p>
            <p className="text-sm font-medium text-amber-500 mt-1">
              العمود <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">{selectedCol}</code> لا يحتوي على تواريخ صالحة.
            </p>
          </div>
        </div>
      )}

      {/* ── Main content (only when we have valid data) ── */}
      {selectedCol && analysis && analysis.totalValid > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[2.5rem] p-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-indigo-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
                <Hash size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Nombre total de PH délivrés
                </p>
                <p className="text-4xl font-black font-mono text-indigo-600">{totalValid}</p>
                <p className="text-[11px] font-bold text-slate-400">من أصل {analysis.totalRows} سجل</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-[2.5rem] p-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
                <Award size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Année la plus active
                </p>
                <p className="text-4xl font-black font-mono text-emerald-600">{bestYear}</p>
                <p className="text-[11px] font-bold text-slate-400">{bestYearCount} PH délivrés</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-[2.5rem] p-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-violet-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30 shrink-0">
                <TrendingUp size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Mois le plus actif
                </p>
                <p className="text-2xl font-black text-violet-600 leading-tight">{bestEntry!.label}</p>
                <p className="text-[11px] font-bold text-slate-400">{bestEntry!.count} PH délivrés</p>
              </div>
            </motion.div>
          </div>

          {/* Chart */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-[3rem] p-12 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {chartMode === 'bar' ? 'PH délivrés par mois' : 'Évolution des PH délivrés'}
                </h3>
                <p className="text-xs font-bold text-slate-400 italic">
                  {entries.length} période(s) • عمود: <span className="text-indigo-500">{selectedCol}</span>
                </p>
              </div>
              <div className="flex gap-3">
                {([
                  { id: 'bar' as const, icon: BarChart3, label: 'Barres' },
                  { id: 'line' as const, icon: LineChartIcon, label: 'Courbe' },
                ]).map(t => (
                  <button key={t.id} onClick={() => setChartMode(t.id)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black border-2 transition-all',
                      chartMode === t.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600 shadow-sm'
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    )}>
                    <t.icon size={16} />{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: '420px' }}>
              {chartMode === 'bar'
                ? <Bar data={barChartData} options={barOptions} />
                : <Line data={lineChartData} options={lineOptions} />
              }
            </div>
          </motion.div>

          {/* Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-[3rem] overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-400">
                <CalendarDays size={22} />
              </div>
              <h3 className="text-xl font-black text-slate-900">PH délivrés par mois</h3>
              <span className="ml-auto px-4 py-1.5 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-black uppercase border border-indigo-100">
                {entries.length} entrées
              </span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md">
                  <tr>
                    {['Mois', 'Année', 'Nombre de PH délivrés'].map(h => (
                      <th key={h}
                        className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.sortKey}
                      className={cn(
                        'transition-all',
                        bestEntry && e.sortKey === bestEntry.sortKey
                          ? 'bg-indigo-50/40 hover:bg-indigo-50/60'
                          : 'hover:bg-slate-50/40'
                      )}>
                      <td className="px-10 py-4 text-sm font-bold text-slate-700 whitespace-nowrap">
                        {bestEntry && e.sortKey === bestEntry.sortKey && (
                          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-3 mb-0.5" />
                        )}
                        {MONTH_NAMES_FR[e.month]}
                      </td>
                      <td className="px-10 py-4 text-sm font-black font-mono text-slate-500">
                        {e.year}
                      </td>
                      <td className="px-10 py-4">
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            'text-sm font-black font-mono',
                            bestEntry && e.sortKey === bestEntry.sortKey ? 'text-indigo-600' : 'text-slate-700'
                          )}>
                            {e.count}
                          </span>
                          <div className="flex-1 max-w-[160px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-400 transition-all"
                              style={{ width: `${bestEntry ? (e.count / bestEntry.count) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HIDDEN PDF REPORT — same pattern as Statistics.tsx
      ══════════════════════════════════════════════════════════════════════ */}
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
        <div
          ref={pdfReportRef}
          dir="rtl"
          style={{
            fontFamily: "'Cairo', 'Tajawal', 'Segoe UI', 'Arial', sans-serif",
            color: '#0f172a',
            width: '1000px',
            backgroundColor: '#ffffff',
            direction: 'rtl',
            unicodeBidi: 'embed',
            padding: '36px 56px 56px 56px',
            display: 'flex',
            flexDirection: 'column',
            gap: '36px',
          }}
        >
          {/* ── PDF HEADER (identical to Statistics) ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '24px',
            borderBottom: '4px solid #1565c0',
          }}>
            <div style={{ width: '110px', flexShrink: 0 }}>
              <img
                src={jamaaLogo}
                alt="شعار جماعة إنزكان"
                style={{ width: '100px', height: '100px', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', direction: 'rtl', unicodeBidi: 'bidi-override' }}>
                <span style={{
                  color: '#0d3670',
                  fontSize: '38px',
                  fontWeight: 900,
                  lineHeight: 1.4,
                  fontFamily: "'Cairo', 'Tajawal', sans-serif",
                  unicodeBidi: 'bidi-override',
                  direction: 'rtl',
                  display: 'inline-block',
                }}>تقرير تحليل PH</span>
              </div>
              <div style={{ height: '12px' }} />
              <p style={{
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: "'Cairo', 'Tajawal', sans-serif",
                direction: 'ltr',
                unicodeBidi: 'plaintext',
                margin: 0,
              }}>
                {`تاريخ الإصدار: ${todayWestern()} — ${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}`}
              </p>
            </div>
            <div style={{ width: '110px', flexShrink: 0 }} />
          </div>

          {/* ── KPI SUMMARY ── */}
          {analysis && analysis.totalValid > 0 && (
            <div style={{ display: 'flex', gap: '16px', direction: 'ltr' }}>
              {/* KPI 1 — إجمالي */}
              <div style={{ flex: 1, padding: '20px', borderRadius: '16px', textAlign: 'center', backgroundColor: '#eef2ff', border: '1px solid #e0e7ff' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#4f46e5', direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                    إجمالي PH المسلّمة
                  </span>
                </div>
                <p style={{ fontSize: '36px', fontWeight: 900, color: '#4f46e5', fontFamily: 'monospace', margin: '8px 0 0 0', lineHeight: 1.2 }}>{totalValid}</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                    من أصل {analysis.totalRows} سجل
                  </span>
                </div>
              </div>
              {/* KPI 2 — السنة */}
              <div style={{ flex: 1, padding: '20px', borderRadius: '16px', textAlign: 'center', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#059669', direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                    السنة الأنشط
                  </span>
                </div>
                <p style={{ fontSize: '36px', fontWeight: 900, color: '#059669', fontFamily: 'monospace', margin: '8px 0 0 0', lineHeight: 1.2 }}>{bestYear}</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                    {bestYearCount} رخصة
                  </span>
                </div>
              </div>
              {/* KPI 3 — أكثر شهر */}
              <div style={{ flex: 1, padding: '20px', borderRadius: '16px', textAlign: 'center', backgroundColor: '#f5f3ff', border: '1px solid #ede9fe' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#7c3aed', direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                    أكثر شهر نشاطاً
                  </span>
                </div>
                <p style={{ fontSize: '28px', fontWeight: 900, color: '#7c3aed', fontFamily: 'monospace', margin: '8px 0 0 0', lineHeight: 1.3 }}>
                  {bestEntry?.label || '-'}
                </p>
              </div>
            </div>
          )}

          {/* ── COLUMN INFO ── */}
          {selectedCol && (
            <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', borderRight: '4px solid #6366f1', direction: 'rtl' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  عمود التحليل:
                </span>
                <span style={{ color: '#4f46e5', fontFamily: 'monospace', fontSize: '12px', fontWeight: 700 }}>{selectedCol}</span>
              </div>
            </div>
          )}

          {/* ── CHART SECTION ── */}
          {activePdfSections.has('chart') && analysis && analysis.totalValid > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', borderRight: '5px solid #4f46e5', paddingRight: '16px' }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', direction: 'ltr', unicodeBidi: 'plaintext', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  PH délivrés par mois
                </span>
              </div>
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '24px' }}>
                <div style={{ height: '320px' }}>
                  <Bar data={barChartData} options={pdfBarOptions} />
                </div>
              </div>

              {/* Year summary */}
              {Object.keys(analysis.yearMap || {}).length > 0 && (
                <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {Object.entries(analysis.yearMap)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([year, count]) => (
                      <div key={year} style={{
                        flex: '1', minWidth: '120px',
                        padding: '16px', borderRadius: '12px',
                        backgroundColor: '#eef2ff', border: '1px solid #e0e7ff',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontSize: '10px', fontWeight: 900, color: '#6366f1', margin: 0 }}>{year}</p>
                        <p style={{ fontSize: '28px', fontWeight: 900, color: '#4f46e5', fontFamily: 'monospace', margin: '4px 0 0 0' }}>{count as number}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── TABLE SECTION ── */}
          {activePdfSections.has('table') && analysis && analysis.totalValid > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', borderRight: '5px solid #6366f1', paddingRight: '16px' }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  جدول PH حسب الشهر
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#eef2ff' }}>
                    {['الشهر', 'السنة', 'عدد PH المسلّمة', 'النسبة'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 900, color: '#4f46e5' }}>
                        <span style={{ direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => (
                    <tr key={e.sortKey} style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: bestEntry && e.sortKey === bestEntry.sortKey ? '#eef2ff' : idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}>
                      <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700 }}>
                        {bestEntry && e.sortKey === bestEntry.sortKey && (
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4f46e5', marginLeft: '8px' }} />
                        )}
                        {MONTH_NAMES_FR[e.month]}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 900, fontFamily: 'monospace', color: '#64748b' }}>{e.year}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 900, fontFamily: 'monospace', color: bestEntry && e.sortKey === bestEntry.sortKey ? '#4f46e5' : '#0f172a' }}>{e.count}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>
                        {bestEntry ? ((e.count / totalValid) * 100).toFixed(1) : '0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={2} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 900, color: '#475569' }}>
                      <span style={{ direction: 'rtl', unicodeBidi: 'bidi-override', fontFamily: "'Cairo','Tajawal',sans-serif" }}>الإجمالي</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: '#4f46e5' }}>{totalValid}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 900, color: '#4f46e5' }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── PDF FOOTER ── */}
          <div style={{ paddingTop: '24px', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', color: '#cbd5e1', margin: 0 }}>
              Jamaa Platform — Analyse PH
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PDF PICKER MODAL — identical pattern to Statistics.tsx
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showPdfPicker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6"
            onClick={() => setShowPdfPicker(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] p-12 max-w-xl w-full shadow-2xl space-y-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
                    <FileText size={26} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">تخصيص محتوى التقرير</h3>
                    <p className="text-sm font-bold text-slate-400">اختر الأقسام التي تريد تضمينها في PDF</p>
                  </div>
                </div>
                <button onClick={() => setShowPdfPicker(false)} className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                  <X size={18} />
                </button>
              </div>

              {/* Quick select */}
              <div className="flex flex-wrap gap-2">
                <button type="button"
                  onClick={() => setPdfSections(new Set(['chart', 'table']))}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">
                  كل المحتوى
                </button>
                <button type="button"
                  onClick={() => setPdfSections(new Set())}
                  className="px-4 py-2 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                  مسح الكل
                </button>
              </div>

              {/* Section options */}
              <div className="space-y-3">
                {([
                  { id: 'chart' as PdfSection, label: 'الرسم البياني', fr: 'Graphique mensuel', icon: BarChart3, desc: 'مخطط الأعمدة + ملخص سنوي' },
                  { id: 'table' as PdfSection, label: 'جدول البيانات', fr: 'Tableau mensuel', icon: CalendarDays, desc: 'جدول كامل بالشهر والسنة والعدد والنسبة' },
                ] as const).map((opt) => {
                  const isSelected = pdfSections.has(opt.id);
                  return (
                    <button key={opt.id} onClick={() => togglePdfSection(opt.id)}
                      className={cn(
                        'w-full text-right p-6 rounded-3xl border-2 transition-all flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99]',
                        isSelected
                          ? 'border-emerald-400 bg-emerald-50/40 shadow-sm'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/40'
                      )}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
                          isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400'
                        )}>
                          <opt.icon size={22} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-1 text-right flex-1 min-w-0">
                          <p className="font-black text-base text-slate-900">{opt.label}</p>
                          <p className="text-[10px] font-black text-slate-300 italic">{opt.fr}</p>
                          <p className="text-xs font-bold text-slate-400">{opt.desc}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isSelected
                          ? <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={2.5} />
                          : <Circle size={28} className="text-slate-200" />
                        }
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pdfSections.size} قسم محدد</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowPdfPicker(false)}
                    className="px-6 h-12 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-100">
                    إلغاء
                  </button>
                  <button onClick={handleConfirmPdfExport}
                    disabled={pdfSections.size === 0 || isGeneratingPDF}
                    className="px-8 h-12 bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-600 disabled:opacity-40 flex items-center gap-2">
                    <Download size={16} />
                    تصدير PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
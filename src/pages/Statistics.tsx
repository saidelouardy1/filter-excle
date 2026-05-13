import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, PieChart as PieIcon, Download, ArrowLeft, Filter, Hash, Activity,
  ChevronDown, TrendingUp, LayoutDashboard, Calendar, Layers, ArrowUpRight,
  UserCheck, Users, CalendarClock, Calculator, AlertTriangle, Clock,
  CalendarDays, CalendarRange, FileText, Table as TableIcon, X, CheckCircle2,
  Circle, GitCompare, FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import type { SheetData } from '../App';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler, ChartDataLabels
);

interface StatisticsProps {
  data: any[];
  columns: string[];
  allSheets: SheetData[];
}

function parseDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    if (value > 1 && value < 100000) {
      const date = new Date((value - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const native = new Date(trimmed);
    if (!isNaN(native.getTime())) return native;
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      let year = parseInt(ddmmyyyy[3], 10);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
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

function formatDuration(days: number): string {
  if (days < 0) return `${days} يوم`;
  if (days === 0) return 'نفس اليوم';
  const years = Math.floor(days / 365);
  const remainingAfterYears = days - (years * 365);
  const months = Math.floor(remainingAfterYears / 30);
  const remainingDays = remainingAfterYears - (months * 30);
  if (years > 0) {
    if (months > 0) return `${years} سنة و ${months} شهر`;
    return `${years} سنة`;
  }
  if (months > 0) {
    if (remainingDays > 0) return `${months} شهر و ${remainingDays} يوم`;
    return `${months} شهر`;
  }
  return `${days} يوم`;
}

function getUniqueValues(rows: any[], col: string, limit: number = 50): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[col];
    if (v === null || v === undefined || v === '') continue;
    set.add(String(v).trim());
    if (set.size >= limit) break;
  }
  return Array.from(set).sort();
}

type PdfSection = 'statistics' | 'duration_summary' | 'duration_table' | 'cross_sheet';
type ComparisonMode = 'off' | 'same_sheet' | 'cross_sheet';

// ============================================================================
// GLOBAL CHART OPTION FACTORIES — bigger thicker visuals across the app & PDF
// ============================================================================

// Donut option factory: thicker ring, bigger numbers, more legend spacing
function buildDonutOptions(opts: {
  total: number;
  isPdf?: boolean;
  valueSize?: number;
  legendSize?: number;
  cutout?: string;
}) {
  const { total, isPdf = false, valueSize, legendSize, cutout } = opts;
  return {
    maintainAspectRatio: false,
    cutout: cutout ?? (isPdf ? '55%' : '60%'), // thicker ring (was 80%)
    layout: { padding: isPdf ? 16 : 24 },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle' as const,
          padding: isPdf ? 18 : 30, // more spacing between chart & legend
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
          // Hide tiny slice labels to avoid clutter
          if (v < total * 0.04) return '';
          const pct = ((v / total) * 100).toFixed(1);
          return `${v}\n${pct}%`;
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 14, cornerRadius: 12,
        titleFont: { family: 'Tajawal', weight: 'bold' as const, size: 14 },
        bodyFont: { family: 'Tajawal', size: 13 },
      },
    },
  };
}

// Bar option factory
function buildBarOptions(opts: {
  isPdf?: boolean;
  showPercents?: Array<number | string>;
  horizontal?: boolean;
  color?: string;
}) {
  const { isPdf = false, showPercents, horizontal = false, color = '#6366f1' } = opts;
  return {
    maintainAspectRatio: false,
    indexAxis: (horizontal ? 'y' : 'x') as 'x' | 'y',
    layout: { padding: { top: isPdf ? 12 : 24 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end' as const,
        align: horizontal ? ('end' as const) : ('top' as const),
        color,
        font: { weight: 'bold' as const, size: isPdf ? 11 : 13, family: 'Tajawal' },
        textAlign: 'center' as const,
        offset: 6,
        formatter: (v: number, ctx: any) => {
          if (showPercents) return `${v}\n${showPercents[ctx.dataIndex]}%`;
          return v;
        },
      },
      tooltip: {
        backgroundColor: '#0f172a', padding: 14, cornerRadius: 12,
        titleFont: { family: 'Tajawal', weight: 'bold' as const, size: 14 },
        bodyFont: { family: 'Tajawal', size: 13 },
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(241, 245, 249, 0.7)' },
        ticks: {
          font: { weight: 'bold' as const, family: 'Tajawal', size: isPdf ? 11 : 13 },
          color: '#64748b',
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { weight: 'bold' as const, family: 'Tajawal', size: isPdf ? 11 : 13 },
          color: '#475569',
        },
      },
    },
  };
}

export default function Statistics({ data, columns, allSheets }: StatisticsProps) {
  const [selectedCol, setSelectedCol] = useState(columns[0] || '');
  const [compareCol1, setCompareCol1] = useState(columns[0] || '');
  const [compareCol2, setCompareCol2] = useState(columns[1] || columns[0] || '');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('off');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [startDateCol, setStartDateCol] = useState<string>('');
  const [endDateCol, setEndDateCol] = useState<string>('');
  const [durationCalculated, setDurationCalculated] = useState(false);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);
  
  const [showPdfPicker, setShowPdfPicker] = useState(false);
  const [pdfSections, setPdfSections] = useState<Set<PdfSection>>(new Set(['statistics']));
  const [activePdfSections, setActivePdfSections] = useState<Set<PdfSection>>(new Set());
  
  const [csSheetA, setCsSheetA] = useState<string>('');
  const [csColA, setCsColA] = useState<string>('');
  const [csValueA, setCsValueA] = useState<string>('');
  const [csSheetB, setCsSheetB] = useState<string>('');
  const [csColB, setCsColB] = useState<string>('');
  const [csValueB, setCsValueB] = useState<string>('');
  const [csCalculated, setCsCalculated] = useState(false);
  
  const pdfReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (columns.length > 0) {
      if (!selectedCol) setSelectedCol(columns[0]);
      if (!compareCol1) setCompareCol1(columns[0]);
      if (!compareCol2) setCompareCol2(columns[1] || columns[0]);
    }
  }, [columns]);

  useEffect(() => {
    if (allSheets.length >= 2) {
      if (!csSheetA) setCsSheetA(allSheets[0].name);
      if (!csSheetB) setCsSheetB(allSheets[1].name);
    } else if (allSheets.length === 1) {
      if (!csSheetA) setCsSheetA(allSheets[0].name);
      if (!csSheetB) setCsSheetB(allSheets[0].name);
    }
  }, [allSheets]);

  const getSheet = (name: string): SheetData | undefined => 
    allSheets.find(s => s.name === name);

  const csColumnsA = useMemo(() => getSheet(csSheetA)?.columns || [], [csSheetA, allSheets]);
  const csColumnsB = useMemo(() => getSheet(csSheetB)?.columns || [], [csSheetB, allSheets]);

  const csValuesA = useMemo(() => {
    const sheet = getSheet(csSheetA);
    if (!sheet || !csColA) return [];
    return getUniqueValues(sheet.rows, csColA);
  }, [csSheetA, csColA, allSheets]);

  const csValuesB = useMemo(() => {
    const sheet = getSheet(csSheetB);
    if (!sheet || !csColB) return [];
    return getUniqueValues(sheet.rows, csColB);
  }, [csSheetB, csColB, allSheets]);

  const handleChangeSheetA = (value: string) => { setCsSheetA(value); setCsColA(''); setCsValueA(''); setCsCalculated(false); };
  const handleChangeColA = (value: string) => { setCsColA(value); setCsValueA(''); setCsCalculated(false); };
  const handleChangeValueA = (value: string) => { setCsValueA(value); setCsCalculated(false); };
  const handleChangeSheetB = (value: string) => { setCsSheetB(value); setCsColB(''); setCsValueB(''); setCsCalculated(false); };
  const handleChangeColB = (value: string) => { setCsColB(value); setCsValueB(''); setCsCalculated(false); };
  const handleChangeValueB = (value: string) => { setCsValueB(value); setCsCalculated(false); };

  const crossSheetResult = useMemo(() => {
    if (!csCalculated) return null;
    const sheetA = getSheet(csSheetA);
    const sheetB = getSheet(csSheetB);
    if (!sheetA || !sheetB || !csColA || !csColB) return null;

    const distA: Record<string, number> = {};
    let totalA = 0;
    for (const row of sheetA.rows) {
      const v = row[csColA];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      const key = String(v).trim();
      distA[key] = (distA[key] || 0) + 1;
      totalA++;
    }

    const distB: Record<string, number> = {};
    let totalB = 0;
    for (const row of sheetB.rows) {
      const v = row[csColB];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      const key = String(v).trim();
      distB[key] = (distB[key] || 0) + 1;
      totalB++;
    }

    const countA = csValueA ? (distA[csValueA] || 0) : totalA;
    const countB = csValueB ? (distB[csValueB] || 0) : totalB;

    return {
      sheetA: sheetA.name, sheetB: sheetB.name,
      colA: csColA, colB: csColB,
      valueA: csValueA, valueB: csValueB,
      distA, distB,
      totalA, totalB,
      countA, countB,
      grandTotal: countA + countB,
    };
  }, [csCalculated, csSheetA, csSheetB, csColA, csColB, csValueA, csValueB, allSheets]);

  const dateColumns = useMemo(() => columns.filter(col => isDateColumn(data, col)), [data, columns]);

  useEffect(() => {
    if (dateColumns.length >= 1 && !startDateCol) setStartDateCol(dateColumns[0]);
    if (dateColumns.length >= 2 && !endDateCol) setEndDateCol(dateColumns[1]);
  }, [dateColumns]);

  const durationStats = useMemo(() => {
    if (!durationCalculated || !startDateCol || !endDateCol || !data.length) return null;
    const rows: Array<any> = [];
    let negativeCount = 0, invalidCount = 0;
    let validDiffs: number[] = [];
    data.forEach((row, idx) => {
      const start = parseDate(row[startDateCol]);
      const end = parseDate(row[endDateCol]);
      if (!start || !end) {
        rows.push({ index: idx, start, end, diffDays: null, diffMonths: null, diffYears: null, formatted: 'تاريخ غير صالح', invalid: true, negative: false });
        invalidCount++; return;
      }
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const negative = diffDays < 0;
      if (negative) negativeCount++;
      const absDays = Math.abs(diffDays);
      rows.push({
        index: idx, start, end, diffDays,
        diffMonths: Math.round(absDays / 30),
        diffYears: Math.round((absDays / 365) * 10) / 10,
        formatted: negative ? `⚠ ${formatDuration(absDays)} (سالب)` : formatDuration(absDays),
        invalid: false, negative,
      });
      if (!negative) validDiffs.push(diffDays);
    });
    if (validDiffs.length === 0) {
      return { rows, total: data.length, validCount: 0, invalidCount, negativeCount, avgDays: 0, avgMonths: 0, avgYears: 0, minDays: 0, maxDays: 0 };
    }
    const sum = validDiffs.reduce((a, b) => a + b, 0);
    const avgDays = Math.round(sum / validDiffs.length);
    return {
      rows, total: data.length, validCount: validDiffs.length, invalidCount, negativeCount,
      avgDays, avgMonths: Math.round(avgDays / 30), avgYears: Math.round((avgDays / 365) * 10) / 10,
      minDays: Math.min(...validDiffs), maxDays: Math.max(...validDiffs),
    };
  }, [durationCalculated, startDateCol, endDateCol, data]);

  const handleCalculateDuration = () => {
    setDurationWarning(null);
    if (!startDateCol || !endDateCol) { setDurationWarning('المرجو اختيار عمودي التاريخ.'); return; }
    if (startDateCol === endDateCol) { setDurationWarning('المرجو اختيار عمودين مختلفين.'); return; }
    setDurationCalculated(true);
    setTimeout(() => {
      let neg = 0;
      data.forEach(row => {
        const s = parseDate(row[startDateCol]);
        const e = parseDate(row[endDateCol]);
        if (s && e && e.getTime() < s.getTime()) neg++;
      });
      if (neg > 0) setDurationWarning(`تنبيه: ${neg} سجل يحتوي على تاريخ نهاية قبل تاريخ البداية.`);
    }, 0);
  };

  const handleCalculateCrossSheet = () => {
    if (!csSheetA || !csSheetB || !csColA || !csColB) {
      setErrorMsg('المرجو اختيار الورقة والعمود لكلا الطرفين.');
      return;
    }
    setErrorMsg(null);
    setCsCalculated(true);
  };

  const stats = useMemo(() => {
    if (!data.length) return null;
    if (comparisonMode === 'same_sheet') {
      if (!compareCol1 || !compareCol2) return null;
      const count1 = data.filter(row => row[compareCol1] !== null && row[compareCol1] !== undefined && String(row[compareCol1]).trim() !== '').length;
      const count2 = data.filter(row => row[compareCol2] !== null && row[compareCol2] !== undefined && String(row[compareCol2]).trim() !== '').length;
      const total = count1 + count2;
      const labels = [compareCol1, compareCol2];
      const values = [count1, count2];
      const percentages = total > 0 ? [((count1 / total) * 100).toFixed(1), ((count2 / total) * 100).toFixed(1)] : ['0.0', '0.0'];
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
  }, [data, selectedCol, compareCol1, compareCol2, comparisonMode]);

  const softColors = [
    'rgba(16, 185, 129, 0.85)','rgba(139, 92, 246, 0.85)','rgba(59, 130, 246, 0.85)',
    'rgba(236, 72, 153, 0.85)','rgba(245, 158, 11, 0.85)','rgba(20, 184, 166, 0.85)',
    'rgba(99, 102, 241, 0.85)','rgba(100, 116, 139, 0.85)',
  ];

  const doughnutData = {
    labels: stats?.labels || [],
    datasets: [{
      data: stats?.values || [],
      backgroundColor: softColors,
      borderRadius: 8,
      borderWidth: 0,
      spacing: 4,
    }]
  };

  const barData = {
    labels: stats?.labels || [],
    datasets: [{ label: 'العدد', data: stats?.values || [], backgroundColor: softColors, borderRadius: 12 }]
  };

  const crossSheetChartData = useMemo(() => {
    if (!crossSheetResult) return null;
    const labelA = crossSheetResult.valueA 
      ? `${crossSheetResult.valueA} (${crossSheetResult.sheetA})`
      : `${crossSheetResult.colA} (${crossSheetResult.sheetA})`;
    const labelB = crossSheetResult.valueB 
      ? `${crossSheetResult.valueB} (${crossSheetResult.sheetB})`
      : `${crossSheetResult.colB} (${crossSheetResult.sheetB})`;
    return {
      labels: [labelA, labelB],
      datasets: [{
        data: [crossSheetResult.countA, crossSheetResult.countB],
        backgroundColor: ['rgba(16, 185, 129, 0.9)', 'rgba(99, 102, 241, 0.9)'],
        borderRadius: 12, borderWidth: 0, spacing: 6,
      }]
    };
  }, [crossSheetResult]);

  const crossSheetDistChartA = useMemo(() => {
    if (!crossSheetResult) return null;
    const labels = Object.keys(crossSheetResult.distA);
    const values = Object.values(crossSheetResult.distA);
    return { labels, datasets: [{ label: 'العدد', data: values, backgroundColor: softColors, borderRadius: 10 }] };
  }, [crossSheetResult]);

  const crossSheetDistChartB = useMemo(() => {
    if (!crossSheetResult) return null;
    const labels = Object.keys(crossSheetResult.distB);
    const values = Object.values(crossSheetResult.distB);
    return { labels, datasets: [{ label: 'العدد', data: values, backgroundColor: softColors, borderRadius: 10 }] };
  }, [crossSheetResult]);

  const handleOpenPdfPicker = () => {
    if (!data.length) { setErrorMsg("لا توجد بيانات للتقرير"); return; }
    setErrorMsg(null);
    const defaults = new Set<PdfSection>();
    // Smart defaults based on what's actually relevant
    if (comparisonMode === 'cross_sheet' && csCalculated && crossSheetResult) {
      defaults.add('cross_sheet');
    } else {
      defaults.add('statistics');
      if (durationCalculated && durationStats) {
        defaults.add('duration_summary'); defaults.add('duration_table');
      }
    }
    setPdfSections(defaults);
    setShowPdfPicker(true);
  };

  const togglePdfSection = (section: PdfSection) => {
    setPdfSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const handleConfirmPdfExport = async () => {
    if (pdfSections.size === 0) { setErrorMsg("المرجو اختيار قسم واحد على الأقل."); return; }
    setActivePdfSections(new Set(pdfSections));
    setShowPdfPicker(false);
    await new Promise(resolve => setTimeout(resolve, 100));
    await generatePDF();
  };

  const generatePDF = async () => {
    if (isGeneratingPDF) return;
    if (!pdfReportRef.current) { setErrorMsg("لا يمكن إنشاء التقرير حالياً."); return; }
    setIsGeneratingPDF(true);
    setErrorMsg(null);
    try {
      // Wait for fonts to be fully loaded before snapshotting,
      // otherwise html2canvas can capture before Arabic ligatures render.
      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch {}
      }
      await new Promise(resolve => setTimeout(resolve, 1200));
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
      pdf.save(`تقرير-الاحصائيات-${new Date().getTime()}.pdf`);
      setActivePdfSections(new Set());
    } catch (error) {
      console.error("PDF Generation Error:", error);
      setErrorMsg("حدث خطأ أثناء إنشاء ملف PDF.");
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
          <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">قم باستيراد ملف Excel الخاص بك من الصفحة الرئيسية للبدء.</p>
        </div>
        <Link to="/" className="group flex items-center gap-3 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
          <span>اذهب للاستيراد الآن</span>
          <ArrowLeft size={20} />
        </Link>
      </div>
    );
  }

  const pdfOptions: Array<{ id: PdfSection; label: string; fr: string; icon: any; desc: string; disabled?: boolean; }> = [
    { id: 'statistics', label: 'التحليلات والمؤشرات الرقمية', fr: 'Statistiques générales', icon: BarChart3, desc: 'الرسومات البيانية + جدول التوزيع' },
    { id: 'duration_summary', label: 'ملخص تحليل المدة', fr: 'Résumé de durée', icon: CalendarClock, desc: 'البطاقات الإحصائية', disabled: !durationCalculated || !durationStats },
    { id: 'duration_table', label: 'جدول المدد المحسوبة', fr: 'Tableau des durées', icon: TableIcon, desc: 'الجدول الكامل', disabled: !durationCalculated || !durationStats },
    { id: 'cross_sheet', label: 'مقارنة بين الأوراق', fr: 'Comparaison entre feuilles', icon: GitCompare, desc: 'مقارنة عمودين من ورقتين مختلفتين', disabled: !csCalculated || !crossSheetResult },
  ];

  // What the PDF is "about" — drives dynamic content
  const isPdfComparison = activePdfSections.has('cross_sheet') && crossSheetResult;
  const isPdfDistribution = activePdfSections.has('statistics') && stats && !stats.isComparison;
  const isPdfDuration = (activePdfSections.has('duration_summary') || activePdfSections.has('duration_table')) && durationStats;

  return (
    <div className="space-y-12 pb-24 max-w-[1400px] mx-auto pt-8" dir="rtl">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
        <div className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] bg-indigo-50 w-fit px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              <LayoutDashboard size={14} />
              <span>Dashboard Intelligence</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
              <button onClick={() => setComparisonMode('off')}
                className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                  comparisonMode === 'off' ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                عادي
              </button>
              <button onClick={() => setComparisonMode('same_sheet')}
                className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                  comparisonMode === 'same_sheet' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:text-slate-600")}>
                مقارنة بنفس الورقة
              </button>
              {allSheets.length >= 2 && (
                <button onClick={() => setComparisonMode('cross_sheet')}
                  className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                    comparisonMode === 'cross_sheet' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-slate-400 hover:text-slate-600")}>
                  <GitCompare size={11} />
                  مقارنة بين الأوراق
                </button>
              )}
            </div>
          </div>
          <h1 className="text-5xl weapon-text text-slate-900">
            {comparisonMode === 'same_sheet' ? "مقارنة ثنائية ذكية" : 
             comparisonMode === 'cross_sheet' ? "مقارنة بين أوراق العمل" : 
             "التحليلات والمؤشرات الرقمية"}
          </h1>
          <p className="text-slate-400 font-medium text-lg">
            {comparisonMode === 'same_sheet' ? "قارن بين عمودين من نفس الورقة." :
             comparisonMode === 'cross_sheet' ? "قارن بين قيمتين من ورقتين مختلفتين في نفس الملف." :
             "استكشف البيانات الخاصة بك من خلال لوحة تحكم ذكية وعصرية."}
          </p>
          {errorMsg && <p className="text-rose-600 font-black text-sm">{errorMsg}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {comparisonMode === 'off' && (
            <div className="relative group">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Filter size={18} /></div>
              <select className="bg-white/70 backdrop-blur-md border border-slate-200/50 hover:border-indigo-100 rounded-2xl pr-12 pl-12 h-14 min-w-[240px] font-black text-slate-700 outline-none appearance-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-500/5"
                value={selectedCol} onChange={(e) => setSelectedCol(e.target.value)}>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><ChevronDown size={18} /></div>
            </div>
          )}
          {comparisonMode === 'same_sheet' && (
            <div className="flex gap-4">
              <select className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl px-6 h-14 min-w-[200px] font-black text-slate-700 outline-none appearance-none transition-all shadow-sm text-xs"
                value={compareCol1} onChange={(e) => setCompareCol1(e.target.value)}>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl px-6 h-14 min-w-[200px] font-black text-slate-700 outline-none appearance-none transition-all shadow-sm text-xs"
                value={compareCol2} onChange={(e) => setCompareCol2(e.target.value)}>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <button onClick={handleOpenPdfPicker} disabled={isGeneratingPDF}
            className="flex items-center gap-3 bg-emerald-500/90 backdrop-blur-md text-white px-8 h-14 rounded-2xl font-black shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50">
            {isGeneratingPDF ? <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" /> : <Download size={20} />}
            <span>{isGeneratingPDF ? "جاري التحميل..." : "تقرير PDF"}</span>
          </button>
        </div>
      </header>

      {/* CROSS-SHEET SECTION */}
      {comparisonMode === 'cross_sheet' && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[3rem] overflow-hidden border-2 border-emerald-100">
          <div className="p-10 border-b border-slate-50 bg-gradient-to-l from-emerald-50/50 to-transparent">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-3xl bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 shrink-0">
                <GitCompare size={26} strokeWidth={2.5} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900">مقارنة قيم بين أوراق العمل</h2>
                <p className="text-sm font-bold text-slate-400 max-w-2xl">اختر ورقة وعموداً وقيمة لكل طرف.</p>
                <p className="text-xs font-bold text-slate-300 italic">Comparer des valeurs entre deux feuilles du même fichier Excel.</p>
              </div>
            </div>
          </div>

          <div className="p-10 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-emerald-50/40 rounded-3xl p-6 border-2 border-emerald-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black">A</div>
                  <h3 className="font-black text-emerald-700">الطرف الأول / Côté A</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <FileSpreadsheet size={12} /> الورقة / Feuille
                  </label>
                  <select value={csSheetA} onChange={(e) => handleChangeSheetA(e.target.value)}
                    className="relative z-10 w-full h-12 px-4 bg-white border-2 border-emerald-100 hover:border-emerald-300 rounded-2xl font-black text-sm text-slate-700 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none cursor-pointer">
                    {allSheets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} /> العمود / Colonne
                  </label>
                  <select value={csColA} onChange={(e) => handleChangeColA(e.target.value)} disabled={!csSheetA}
                    className="relative z-10 w-full h-12 px-4 bg-white border-2 border-emerald-100 hover:border-emerald-300 rounded-2xl font-black text-sm text-slate-700 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none disabled:opacity-40 cursor-pointer">
                    <option value="">-- اختر عمود --</option>
                    {csColumnsA.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <Filter size={12} /> القيمة / Valeur <span className="text-slate-300 normal-case">(اختياري)</span>
                  </label>
                  <select value={csValueA} onChange={(e) => handleChangeValueA(e.target.value)} disabled={!csColA}
                    className="relative z-10 w-full h-12 px-4 bg-white border-2 border-emerald-100 hover:border-emerald-300 rounded-2xl font-black text-sm text-slate-700 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none disabled:opacity-40 cursor-pointer">
                    <option value="">-- كل القيم (الإجمالي) --</option>
                    {csValuesA.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50/40 rounded-3xl p-6 border-2 border-indigo-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center font-black">B</div>
                  <h3 className="font-black text-indigo-700">الطرف الثاني / Côté B</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <FileSpreadsheet size={12} /> الورقة / Feuille
                  </label>
                  <select value={csSheetB} onChange={(e) => handleChangeSheetB(e.target.value)}
                    className="relative z-10 w-full h-12 px-4 bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-2xl font-black text-sm text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none cursor-pointer">
                    {allSheets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} /> العمود / Colonne
                  </label>
                  <select value={csColB} onChange={(e) => handleChangeColB(e.target.value)} disabled={!csSheetB}
                    className="relative z-10 w-full h-12 px-4 bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-2xl font-black text-sm text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none disabled:opacity-40 cursor-pointer">
                    <option value="">-- اختر عمود --</option>
                    {csColumnsB.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <Filter size={12} /> القيمة / Valeur <span className="text-slate-300 normal-case">(اختياري)</span>
                  </label>
                  <select value={csValueB} onChange={(e) => handleChangeValueB(e.target.value)} disabled={!csColB}
                    className="relative z-10 w-full h-12 px-4 bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-2xl font-black text-sm text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none disabled:opacity-40 cursor-pointer">
                    <option value="">-- كل القيم (الإجمالي) --</option>
                    {csValuesB.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={handleCalculateCrossSheet} disabled={!csSheetA || !csSheetB || !csColA || !csColB}
                className="relative z-10 flex items-center gap-3 bg-emerald-600 text-white px-8 h-14 rounded-2xl font-black shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-40 cursor-pointer">
                <Calculator size={20} />
                <span>إجراء المقارنة / Comparer</span>
              </button>
              {csCalculated && (
                <button type="button" onClick={() => setCsCalculated(false)}
                  className="relative z-10 flex items-center gap-3 bg-slate-100 text-slate-500 px-6 h-14 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95 text-xs cursor-pointer">
                  إعادة تعيين
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {csCalculated && crossSheetResult && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="border-t border-slate-50">
                <div className="p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-emerald-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-xs">A</div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">{crossSheetResult.sheetA}</p>
                      </div>
                      <p className="text-6xl font-black font-mono">{crossSheetResult.countA}</p>
                      <p className="text-xs font-bold text-emerald-100 mt-3">
                        {crossSheetResult.valueA ? `قيمة: ${crossSheetResult.valueA}` : `عمود: ${crossSheetResult.colA}`}
                      </p>
                      <p className="text-[11px] font-black text-emerald-200 mt-1">
                        {((crossSheetResult.countA / (crossSheetResult.grandTotal || 1)) * 100).toFixed(1)}% من المقارنة
                      </p>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">الفارق / Différence</p>
                      <p className="text-6xl font-black font-mono text-slate-900">{Math.abs(crossSheetResult.countA - crossSheetResult.countB)}</p>
                      <p className="text-xs font-bold text-slate-400 mt-3">
                        {crossSheetResult.countA > crossSheetResult.countB ? 'الطرف A أكبر' : crossSheetResult.countA < crossSheetResult.countB ? 'الطرف B أكبر' : 'متساويان'}
                      </p>
                      <p className="text-[11px] font-black text-indigo-400 mt-1 font-mono">إجمالي: {crossSheetResult.grandTotal}</p>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-xs">B</div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">{crossSheetResult.sheetB}</p>
                      </div>
                      <p className="text-6xl font-black font-mono">{crossSheetResult.countB}</p>
                      <p className="text-xs font-bold text-indigo-100 mt-3">
                        {crossSheetResult.valueB ? `قيمة: ${crossSheetResult.valueB}` : `عمود: ${crossSheetResult.colB}`}
                      </p>
                      <p className="text-[11px] font-black text-indigo-200 mt-1">
                        {((crossSheetResult.countB / (crossSheetResult.grandTotal || 1)) * 100).toFixed(1)}% من المقارنة
                      </p>
                    </div>
                  </div>

                  {crossSheetChartData && (
                    <div className="bg-white rounded-3xl p-10 border border-slate-100">
                      <div className="flex items-center gap-3 mb-10">
                        <PieIcon size={22} className="text-emerald-500" />
                        <h3 className="text-lg font-black text-slate-900">المقارنة المباشرة</h3>
                      </div>
                      <div className="h-[420px]">
                        <Doughnut data={crossSheetChartData} options={buildDonutOptions({ total: crossSheetResult.grandTotal, cutout: '55%' })} />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {crossSheetDistChartA && (
                      <div className="bg-emerald-50/30 rounded-3xl p-6 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-6">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs">A</div>
                          <h4 className="font-black text-sm text-emerald-700 truncate">توزيع: {crossSheetResult.colA}</h4>
                        </div>
                        <div className="h-[300px]">
                          <Bar data={crossSheetDistChartA} options={buildBarOptions({ horizontal: true, color: '#059669' })} />
                        </div>
                      </div>
                    )}
                    {crossSheetDistChartB && (
                      <div className="bg-indigo-50/30 rounded-3xl p-6 border border-indigo-100">
                        <div className="flex items-center gap-2 mb-6">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-black text-xs">B</div>
                          <h4 className="font-black text-sm text-indigo-700 truncate">توزيع: {crossSheetResult.colB}</h4>
                        </div>
                        <div className="h-[300px]">
                          <Bar data={crossSheetDistChartB} options={buildBarOptions({ horizontal: true, color: '#4f46e5' })} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}

      {/* Standard stat cards & charts (hidden in cross_sheet mode) */}
      {comparisonMode !== 'cross_sheet' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {comparisonMode === 'off' ? (
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
            {/* THICKER DONUT */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-10 rounded-[3rem]">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500"><PieIcon size={24} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">توزيع النسب المئوية</h2>
                  <p className="text-xs font-bold text-slate-400 italic">نظرة دائرية على حصص البيانات</p>
                </div>
              </div>
              <div className="h-[480px] relative flex items-center justify-center">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: '80px' }}>
                  <span className="text-[11px] font-black text-slate-300 tracking-[0.25em]">TOTAL</span>
                  <span className="text-5xl font-black text-slate-900 mt-1">{stats?.total}</span>
                </div>
                <Doughnut data={doughnutData} options={buildDonutOptions({ total: stats?.total || 0, cutout: '60%', valueSize: 18, legendSize: 14 })} />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card p-10 rounded-[3rem]">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500"><BarChart3 size={24} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">تحليل التكرارات</h2>
                  <p className="text-xs font-bold text-slate-400 italic">مقارنة كمية بين القيم المختلفة</p>
                </div>
              </div>
              <div className="h-[480px]">
                <Bar data={barData} options={buildBarOptions({ showPercents: stats?.percentages || [] })} />
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* DURATION SECTION */}
      {comparisonMode !== 'cross_sheet' && (
      <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-[3rem] overflow-hidden">
        <div className="p-10 border-b border-slate-50 bg-gradient-to-l from-indigo-50/40 to-transparent">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-3xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 shrink-0">
              <CalendarClock size={26} strokeWidth={2.5} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">تحليل المدة بين تاريخين</h2>
              <p className="text-sm font-bold text-slate-400">احسب الفرق الزمني بين عمودين من نوع تاريخ.</p>
            </div>
          </div>
        </div>
        <div className="p-10 space-y-8">
          {dateColumns.length < 2 ? (
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
              <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-1" />
              <div>
                <p className="font-black text-amber-700">لا توجد أعمدة تاريخ كافية</p>
                <p className="text-xs font-bold text-amber-600">تم اكتشاف {dateColumns.length} عمود تاريخ.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CalendarDays size={14} /> اختر تاريخ البداية / Date de début
                  </label>
                  <select value={startDateCol} onChange={(e) => { setStartDateCol(e.target.value); setDurationCalculated(false); }}
                    className="w-full h-14 px-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-sm text-slate-700 outline-none">
                    <option value="">-- اختر عمود --</option>
                    {dateColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CalendarRange size={14} /> اختر تاريخ النهاية / Date de fin
                  </label>
                  <select value={endDateCol} onChange={(e) => { setEndDateCol(e.target.value); setDurationCalculated(false); }}
                    className="w-full h-14 px-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-sm text-slate-700 outline-none">
                    <option value="">-- اختر عمود --</option>
                    {dateColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button onClick={handleCalculateDuration} disabled={!startDateCol || !endDateCol || startDateCol === endDateCol}
                  className="flex items-center gap-3 bg-indigo-600 text-white px-8 h-14 rounded-2xl font-black shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40">
                  <Calculator size={20} />
                  <span>حساب المدة / Calculer</span>
                </button>
                {durationCalculated && (
                  <button onClick={() => { setDurationCalculated(false); setDurationWarning(null); }} className="flex items-center gap-3 bg-slate-100 text-slate-500 px-6 h-14 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95 text-xs">
                    إعادة تعيين
                  </button>
                )}
              </div>
              <AnimatePresence>
                {durationWarning && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex items-center gap-3 text-amber-700 font-black text-sm">
                    <AlertTriangle size={20} className="shrink-0" />{durationWarning}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
        <AnimatePresence>
          {durationCalculated && durationStats && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-slate-50">
              <div className="p-10 space-y-10">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'المتوسط بالأيام', value: durationStats.avgDays, unit: 'يوم', icon: Clock, color: 'indigo' },
                    { label: 'المتوسط بالشهور', value: durationStats.avgMonths, unit: 'شهر', icon: Calendar, color: 'blue' },
                    { label: 'المتوسط بالسنوات', value: durationStats.avgYears, unit: 'سنة', icon: CalendarDays, color: 'purple' },
                    { label: 'أقل مدة', value: durationStats.minDays, unit: 'يوم', icon: TrendingUp, color: 'emerald' },
                    { label: 'أكبر مدة', value: durationStats.maxDays, unit: 'يوم', icon: ArrowUpRight, color: 'amber' },
                    { label: 'سجلات صالحة', value: durationStats.validCount, unit: `/ ${durationStats.total}`, icon: Hash, color: 'pink' },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white p-5 rounded-3xl border border-slate-100">
                      <div className={`w-10 h-10 rounded-2xl bg-${item.color}-50 text-${item.color}-500 flex items-center justify-center mb-3`}>
                        <item.icon size={18} strokeWidth={2.5} />
                      </div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900 font-mono">{item.value}</span>
                        <span className="text-[10px] font-black text-slate-300">{item.unit}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
      )}

      {comparisonMode !== 'cross_sheet' && stats && (
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
              {stats.labels.map((label, i) => (
                <tr key={label} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-10 py-6"><span className="text-sm font-black text-slate-700">{label}</span></td>
                  <td className="px-10 py-6 text-sm font-black text-slate-400 font-mono italic">{stats.values[i]}</td>
                  <td className="px-10 py-6 text-left">
                    <div className="flex items-center gap-6 justify-end">
                      <div className="w-48 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
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
      )}

      {/* PDF picker modal */}
      <AnimatePresence>
        {showPdfPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6"
            onClick={() => setShowPdfPicker(false)} dir="rtl">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] p-12 max-w-2xl w-full shadow-2xl space-y-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
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
              <div className="space-y-3">
                {pdfOptions.map((opt) => {
                  const isSelected = pdfSections.has(opt.id);
                  return (
                    <button key={opt.id} onClick={() => !opt.disabled && togglePdfSection(opt.id)} disabled={opt.disabled}
                      className={cn("w-full text-right p-6 rounded-3xl border-2 transition-all flex items-center justify-between gap-4",
                        opt.disabled ? "border-slate-50 bg-slate-50/30 opacity-50 cursor-not-allowed" :
                        isSelected ? "border-emerald-400 bg-emerald-50/40 shadow-sm cursor-pointer active:scale-[0.99]" :
                        "border-slate-100 hover:border-slate-200 hover:bg-slate-50/40 cursor-pointer active:scale-[0.99]")}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                          opt.disabled ? "bg-slate-100 text-slate-300" : isSelected ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-400")}>
                          <opt.icon size={22} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-1 text-right flex-1 min-w-0">
                          <p className="font-black text-base text-slate-900">{opt.label}</p>
                          <p className="text-[10px] font-black text-slate-300 italic">{opt.fr}</p>
                          <p className="text-xs font-bold text-slate-400">{opt.disabled ? "غير متاح" : opt.desc}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isSelected ? <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={2.5} /> : <Circle size={28} className="text-slate-200" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pdfSections.size} قسم محدد</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowPdfPicker(false)} className="px-6 h-12 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-100">إلغاء</button>
                  <button onClick={handleConfirmPdfExport} disabled={pdfSections.size === 0 || isGeneratingPDF}
                    className="px-8 h-12 bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-600 disabled:opacity-40 flex items-center gap-2">
                    <Download size={16} />تصدير PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================
          HIDDEN PDF REPORT — clean header, dynamic content based on type
          ================================================================ */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '1000px', opacity: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden="true">
        <div id="pdf-report" ref={pdfReportRef} className="p-20 space-y-10" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif', color: '#0f172a', width: '1000px', backgroundColor: '#ffffff' }}>
          
          {/* CLEAN CENTERED HEADER — single title only
              Note: explicit font stack + normal letter/word spacing fixes Arabic
              shaping when html2canvas falls back from custom font weights. */}
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

          {/* ====================================================
              COMPARISON-TYPE REPORT
              ==================================================== */}
          {isPdfComparison && crossSheetResult && (
            <div className="space-y-8">
              {/* Indicators */}
              <div className="grid grid-cols-3 gap-6">
                <div className="p-6 rounded-3xl text-white text-center" style={{ backgroundColor: '#10b981' }}>
                  <p className="text-[10px] font-black uppercase opacity-80">القيمة الأولى / Côté A</p>
                  <p className="text-5xl font-black font-mono mt-3">{crossSheetResult.countA}</p>
                  <p className="text-[11px] font-bold opacity-90 mt-3 truncate">
                    {crossSheetResult.valueA || `كل قيم ${crossSheetResult.colA}`}
                  </p>
                  <p className="text-[10px] font-black opacity-80 mt-1">في ورقة: {crossSheetResult.sheetA}</p>
                  <p className="text-[11px] font-black mt-3 px-3 py-1 rounded-full inline-block" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                    {((crossSheetResult.countA / (crossSheetResult.grandTotal || 1)) * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="p-6 rounded-3xl text-center" style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0' }}>
                  <p className="text-[10px] font-black uppercase" style={{ color: '#94a3b8' }}>الفارق / Écart</p>
                  <p className="text-5xl font-black font-mono mt-3" style={{ color: '#0f172a' }}>
                    {Math.abs(crossSheetResult.countA - crossSheetResult.countB)}
                  </p>
                  <p className="text-[11px] font-bold mt-3" style={{ color: '#64748b' }}>
                    {crossSheetResult.countA > crossSheetResult.countB ? '↑ A أكبر من B' :
                     crossSheetResult.countA < crossSheetResult.countB ? '↑ B أكبر من A' : 'متساويان'}
                  </p>
                  <p className="text-[10px] font-black mt-1" style={{ color: '#94a3b8' }}>الإجمالي: {crossSheetResult.grandTotal}</p>
                </div>

                <div className="p-6 rounded-3xl text-white text-center" style={{ backgroundColor: '#4f46e5' }}>
                  <p className="text-[10px] font-black uppercase opacity-80">القيمة الثانية / Côté B</p>
                  <p className="text-5xl font-black font-mono mt-3">{crossSheetResult.countB}</p>
                  <p className="text-[11px] font-bold opacity-90 mt-3 truncate">
                    {crossSheetResult.valueB || `كل قيم ${crossSheetResult.colB}`}
                  </p>
                  <p className="text-[10px] font-black opacity-80 mt-1">في ورقة: {crossSheetResult.sheetB}</p>
                  <p className="text-[11px] font-black mt-3 px-3 py-1 rounded-full inline-block" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                    {((crossSheetResult.countB / (crossSheetResult.grandTotal || 1)) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Direct comparison donut — thicker */}
              {crossSheetChartData && (
                <div className="p-8 rounded-3xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <h3 className="text-base font-black mb-6 text-center" style={{ color: '#0f172a' }}>المقارنة الدائرية</h3>
                  <div style={{ height: '340px' }}>
                    <Doughnut data={crossSheetChartData} options={buildDonutOptions({ total: crossSheetResult.grandTotal, isPdf: true, cutout: '50%', valueSize: 22, legendSize: 14 })} />
                  </div>
                </div>
              )}

              {/* Difference analysis paragraph */}
              <div className="p-6 rounded-3xl" style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
                <h3 className="text-base font-black mb-3" style={{ color: '#92400e' }}>تحليل الفارق</h3>
                <p className="text-sm font-bold leading-relaxed" style={{ color: '#78350f' }}>
                  {crossSheetResult.countA === crossSheetResult.countB ? (
                    `تظهر النتائج تساوياً تاماً بين الطرفين، حيث بلغ كل منهما ${crossSheetResult.countA}.`
                  ) : (
                    <>
                      الطرف {crossSheetResult.countA > crossSheetResult.countB ? 'A' : 'B'} يتفوق على الطرف الآخر بفارق {Math.abs(crossSheetResult.countA - crossSheetResult.countB)} ({((Math.abs(crossSheetResult.countA - crossSheetResult.countB) / (crossSheetResult.grandTotal || 1)) * 100).toFixed(1)}% من الإجمالي).
                      {' '}من إجمالي {crossSheetResult.grandTotal} سجل تمت مقارنتها.
                    </>
                  )}
                </p>
              </div>

              {/* Per-side distribution tables */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-black mb-3 pr-3" style={{ color: '#0f172a', borderRight: '4px solid #10b981' }}>
                    توزيع الطرف A
                  </h3>
                  <table className="w-full text-right" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#ecfdf5' }}>
                        <th className="px-3 py-2 text-[10px] font-black" style={{ color: '#059669' }}>القيمة</th>
                        <th className="px-3 py-2 text-[10px] font-black" style={{ color: '#059669' }}>العدد</th>
                        <th className="px-3 py-2 text-[10px] font-black" style={{ color: '#059669' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(crossSheetResult.distA).map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td className="px-3 py-2 text-[11px] font-black" style={{ color: '#475569' }}>{k}</td>
                          <td className="px-3 py-2 text-[11px] font-black font-mono" style={{ color: '#0f172a' }}>{v}</td>
                          <td className="px-3 py-2 text-[11px] font-black font-mono" style={{ color: '#10b981' }}>{((v / crossSheetResult.totalA) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="text-sm font-black mb-3 pr-3" style={{ color: '#0f172a', borderRight: '4px solid #4f46e5' }}>
                    توزيع الطرف B
                  </h3>
                  <table className="w-full text-right" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#eef2ff' }}>
                        <th className="px-3 py-2 text-[10px] font-black" style={{ color: '#4f46e5' }}>القيمة</th>
                        <th className="px-3 py-2 text-[10px] font-black" style={{ color: '#4f46e5' }}>العدد</th>
                        <th className="px-3 py-2 text-[10px] font-black" style={{ color: '#4f46e5' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(crossSheetResult.distB).map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td className="px-3 py-2 text-[11px] font-black" style={{ color: '#475569' }}>{k}</td>
                          <td className="px-3 py-2 text-[11px] font-black font-mono" style={{ color: '#0f172a' }}>{v}</td>
                          <td className="px-3 py-2 text-[11px] font-black font-mono" style={{ color: '#4f46e5' }}>{((v / crossSheetResult.totalB) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="p-6 rounded-3xl" style={{ backgroundColor: '#eef2ff', border: '1px solid #e0e7ff' }}>
                <h3 className="text-base font-black mb-3" style={{ color: '#3730a3' }}>الخلاصة / Résumé</h3>
                <ul className="space-y-2 text-sm font-bold" style={{ color: '#1e3a8a' }}>
                  <li>• إجمالي السجلات المشمولة في المقارنة: {crossSheetResult.grandTotal}</li>
                  <li>• الطرف A ({crossSheetResult.sheetA}): {crossSheetResult.countA} سجل ({((crossSheetResult.countA / (crossSheetResult.grandTotal || 1)) * 100).toFixed(1)}%)</li>
                  <li>• الطرف B ({crossSheetResult.sheetB}): {crossSheetResult.countB} سجل ({((crossSheetResult.countB / (crossSheetResult.grandTotal || 1)) * 100).toFixed(1)}%)</li>
                  <li>• الفارق الصافي: {Math.abs(crossSheetResult.countA - crossSheetResult.countB)} سجل</li>
                </ul>
              </div>
            </div>
          )}

          {/* ====================================================
              DISTRIBUTION-TYPE REPORT
              ==================================================== */}
          {isPdfDistribution && stats && (
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
                عمود التحليل: <span style={{ color: '#4f46e5' }}>{selectedCol}</span>
              </p>

              {/* Both charts side-by-side */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl" style={{ backgroundColor: '#f8fafc' }}>
                  <h3 className="text-sm font-black uppercase text-center mb-4" style={{ color: '#94a3b8' }}>التوزيع الدائري</h3>
                  <div style={{ height: '300px' }}>
                    <Doughnut data={doughnutData} options={buildDonutOptions({ total: stats.total, isPdf: true, valueSize: 13, legendSize: 11, cutout: '55%' })} />
                  </div>
                </div>
                <div className="p-6 rounded-3xl" style={{ backgroundColor: '#f8fafc' }}>
                  <h3 className="text-sm font-black uppercase text-center mb-4" style={{ color: '#94a3b8' }}>التمثيل بالأعمدة</h3>
                  <div style={{ height: '300px' }}>
                    <Bar data={barData} options={buildBarOptions({ isPdf: true, showPercents: stats.percentages, color: '#4f46e5' })} />
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
                  بناءً على تحليل {stats.total} سجل موزعين على {stats.labels.length} فئة في عمود "{selectedCol}"، 
                  تتصدر الفئة "<strong>{stats.labels[stats.values.indexOf(Math.max(...stats.values))]}</strong>" بنسبة {stats.percentages[stats.values.indexOf(Math.max(...stats.values))]}% ({Math.max(...stats.values)} سجل)،
                  بينما تأتي الفئة "<strong>{stats.labels[stats.values.indexOf(Math.min(...stats.values))]}</strong>" في المرتبة الأخيرة بنسبة {stats.percentages[stats.values.indexOf(Math.min(...stats.values))]}%.
                  {' '}متوسط السجلات لكل فئة هو {(stats.total / stats.labels.length).toFixed(1)}.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================
              DURATION REPORT
              ==================================================== */}
          {isPdfDuration && durationStats && (
            <div className="space-y-6">
              <h3 className="text-xl font-black pr-4" style={{ color: '#0f172a', borderRight: '4px solid #4f46e5' }}>
                تحليل المدة: {startDateCol} → {endDateCol}
              </h3>
              
              {activePdfSections.has('duration_summary') && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl text-center" style={{ backgroundColor: '#eef2ff' }}>
                    <p className="text-[10px] font-black uppercase" style={{ color: '#6366f1' }}>متوسط الأيام</p>
                    <p className="text-3xl font-black mt-2 font-mono" style={{ color: '#4f46e5' }}>{durationStats.avgDays}</p>
                  </div>
                  <div className="p-5 rounded-2xl text-center" style={{ backgroundColor: '#f0fdf4' }}>
                    <p className="text-[10px] font-black uppercase" style={{ color: '#10b981' }}>أقل مدة</p>
                    <p className="text-3xl font-black mt-2 font-mono" style={{ color: '#059669' }}>{durationStats.minDays}</p>
                    <p className="text-[10px] font-bold mt-1" style={{ color: '#10b981' }}>يوم</p>
                  </div>
                  <div className="p-5 rounded-2xl text-center" style={{ backgroundColor: '#fef3c7' }}>
                    <p className="text-[10px] font-black uppercase" style={{ color: '#f59e0b' }}>أكبر مدة</p>
                    <p className="text-3xl font-black mt-2 font-mono" style={{ color: '#d97706' }}>{durationStats.maxDays}</p>
                    <p className="text-[10px] font-bold mt-1" style={{ color: '#f59e0b' }}>يوم</p>
                  </div>
                </div>
              )}

              {activePdfSections.has('duration_table') && (
                <table className="w-full text-right" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th className="px-3 py-3 text-[10px] font-black" style={{ color: '#94a3b8' }}>#</th>
                      <th className="px-3 py-3 text-[10px] font-black" style={{ color: '#94a3b8' }}>{startDateCol}</th>
                      <th className="px-3 py-3 text-[10px] font-black" style={{ color: '#94a3b8' }}>{endDateCol}</th>
                      <th className="px-3 py-3 text-[10px] font-black" style={{ color: '#4f46e5' }}>المدة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {durationStats.rows.slice(0, 60).map((r: any) => (
                      <tr key={r.index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="px-3 py-2 text-[10px] font-mono" style={{ color: '#cbd5e1' }}>{r.index + 1}</td>
                        <td className="px-3 py-2 text-[10px] font-black" style={{ color: '#475569' }}>{r.start ? r.start.toLocaleDateString('fr-FR') : '-'}</td>
                        <td className="px-3 py-2 text-[10px] font-black" style={{ color: '#475569' }}>{r.end ? r.end.toLocaleDateString('fr-FR') : '-'}</td>
                        <td className="px-3 py-2 text-[10px] font-black" style={{ color: r.invalid ? '#dc2626' : r.negative ? '#d97706' : '#4f46e5' }}>{r.formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
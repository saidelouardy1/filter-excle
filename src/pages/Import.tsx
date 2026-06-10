import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip,
  Legend, PointElement, LineElement, Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Line } from 'react-chartjs-2';
import { CalendarDays, TrendingUp, Award, BarChart3, LineChart as LineChartIcon, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip,
  Legend, PointElement, LineElement, Filler, ChartDataLabels
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PHAnalysisProps {
  data: any[];
}

interface MonthYearEntry {
  month: number;      // 0-based (0 = January)
  year: number;
  label: string;      // "Janvier 2026"
  sortKey: number;    // YYYYMM for sorting
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const COLUMN_NAME = 'DATE DE DELIVRANCE DU PH';

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ─────────────────────────────────────────────────────────────────────────────
// Date parsing — handles JS Date objects, ISO strings, Excel serial numbers,
// and common DD/MM/YYYY or MM/DD/YYYY strings.
// ─────────────────────────────────────────────────────────────────────────────
function parseDate(value: any): Date | null {
  if (!value && value !== 0) return null;

  // Already a JS Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Excel serial number
  if (typeof value === 'number') {
    if (value < 1 || value > 200000) return null;
    const d = new Date((value - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Try native parse first (ISO 8601, RFC 2822, etc.)
  const native = new Date(str);
  if (!isNaN(native.getTime())) return native;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const date = new Date(year, parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function PHAnalysis({ data }: PHAnalysisProps) {
  const [chartMode, setChartMode] = useState<'bar' | 'line'>('bar');

  // ── Compute stats ──────────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!data.length) return null;

    // Find the PH date column (case-insensitive, trimmed)
    const colKey = Object.keys(data[0] || {}).find(
      k => k.trim().toUpperCase() === COLUMN_NAME.toUpperCase()
    );
    if (!colKey) return null;

    const countMap: Record<number, MonthYearEntry> = {}; // keyed by YYYYMM
    let totalValid = 0;

    for (const row of data) {
      const raw = row[colKey];
      const date = parseDate(raw);
      if (!date) continue;

      totalValid++;
      const month = date.getMonth();   // 0-based
      const year = date.getFullYear();
      const sortKey = year * 100 + month;

      if (!countMap[sortKey]) {
        countMap[sortKey] = {
          month, year,
          label: `${MONTH_NAMES_FR[month]} ${year}`,
          sortKey,
          count: 0,
        };
      }
      countMap[sortKey].count++;
    }

    if (totalValid === 0) return { totalValid: 0, entries: [], colKey };

    const entries: MonthYearEntry[] = Object.values(countMap).sort((a, b) => a.sortKey - b.sortKey);

    // Best month (by count)
    const bestEntry = entries.reduce((best, e) => e.count > best.count ? e : best, entries[0]);

    // Best year
    const yearMap: Record<number, number> = {};
    entries.forEach(e => { yearMap[e.year] = (yearMap[e.year] || 0) + e.count; });
    const bestYear = Object.entries(yearMap).reduce(
      (best, [y, c]) => c > best[1] ? [y, c] : best,
      ['', 0]
    );

    return { totalValid, entries, colKey, bestEntry, bestYear, yearMap };
  }, [data]);

  // ── No data / no column state ──────────────────────────────────────────────
  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 text-slate-300" dir="ltr">
        <CalendarDays size={56} strokeWidth={1.5} />
        <p className="font-black text-lg text-slate-400">Importez un fichier Excel pour analyser les PH</p>
      </div>
    );
  }

  if (!analysis || analysis.totalValid === 0) {
    return (
      <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] flex items-center gap-5 text-amber-700 font-bold" dir="ltr">
        <AlertCircle size={28} className="shrink-0 text-amber-400" />
        <div>
          <p className="font-black text-base">Colonne introuvable ou vide</p>
          <p className="text-sm font-medium text-amber-500 mt-1">
            La colonne <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">{COLUMN_NAME}</code> est absente ou ne contient pas de dates valides.
          </p>
        </div>
      </div>
    );
  }

  const { totalValid, entries, bestEntry, bestYear } = analysis;

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartLabels = entries.map(e => e.label);
  const chartValues = entries.map(e => e.count);

  const barChartData = {
    labels: chartLabels,
    datasets: [{
      label: 'PH délivrés',
      data: chartValues,
      backgroundColor: chartLabels.map((_, i) =>
        entries[i].sortKey === bestEntry!.sortKey
          ? 'rgba(99, 102, 241, 0.95)'
          : 'rgba(99, 102, 241, 0.45)'
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
      backgroundColor: 'rgba(99, 102, 241, 0.08)',
      borderWidth: 3,
      pointBackgroundColor: '#6366f1',
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.35,
      fill: true,
    }],
  };

  const sharedOptions = {
    maintainAspectRatio: false,
    layout: { padding: { top: 32 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end' as const,
        align: 'top' as const,
        color: '#4f46e5',
        font: { weight: 'bold' as const, size: 12, family: 'Tajawal' },
        offset: 4,
        formatter: (v: number) => v,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 12,
        cornerRadius: 12,
        titleFont: { family: 'Tajawal', weight: 'bold' as const, size: 13 },
        bodyFont: { family: 'Tajawal', size: 12 },
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.y} PH délivrés`,
        },
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(241,245,249,0.8)' },
        ticks: {
          font: { weight: 'bold' as const, family: 'Tajawal', size: 12 },
          color: '#94a3b8',
          stepSize: 1,
        },
        beginAtZero: true,
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { weight: 'bold' as const, family: 'Tajawal', size: 11 },
          color: '#475569',
          maxRotation: 45,
        },
      },
    },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 pb-16 max-w-[1400px] mx-auto pt-8" dir="ltr">

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Analyse PH</h2>
        <p className="text-slate-400 font-medium text-lg">
          Analyse des permis d'habiter délivrés — colonne&nbsp;
          <code className="text-indigo-500 text-sm bg-indigo-50 px-2 py-0.5 rounded-lg font-mono">{COLUMN_NAME}</code>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total */}
        <div className="glass-card rounded-[2.5rem] p-8 flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
            <CalendarDays size={30} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre total de PH délivrés</p>
            <p className="text-4xl font-black font-mono text-indigo-600">{totalValid}</p>
          </div>
        </div>

        {/* Best year */}
        <div className="glass-card rounded-[2.5rem] p-8 flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
            <Award size={30} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Année la plus active</p>
            <p className="text-4xl font-black font-mono text-emerald-600">{bestYear![0]}</p>
            <p className="text-[11px] font-bold text-slate-400">{bestYear![1]} PH délivrés</p>
          </div>
        </div>

        {/* Best month */}
        <div className="glass-card rounded-[2.5rem] p-8 flex items-center gap-6">
          <div className="w-16 h-16 bg-violet-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30 shrink-0">
            <TrendingUp size={30} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mois avec le plus grand nombre de PH</p>
            <p className="text-2xl font-black text-violet-600 leading-tight">{bestEntry!.label}</p>
            <p className="text-[11px] font-bold text-slate-400">{bestEntry!.count} PH délivrés</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-card rounded-[3rem] p-12 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {chartMode === 'bar' ? 'PH délivrés par mois' : 'Évolution des PH délivrés dans le temps'}
            </h3>
            <p className="text-xs font-bold text-slate-400 italic">{entries.length} période(s) analysée(s)</p>
          </div>
          <div className="flex gap-3">
            {[
              { id: 'bar', icon: BarChart3, label: 'Barres' },
              { id: 'line', icon: LineChartIcon, label: 'Courbe' },
            ].map(t => (
              <button key={t.id} onClick={() => setChartMode(t.id as any)}
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
            ? <Bar data={barChartData} options={sharedOptions} />
            : <Line data={lineChartData} options={{ ...sharedOptions, plugins: { ...sharedOptions.plugins, datalabels: { display: false } } }} />
          }
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[3rem] overflow-hidden">
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
                  <th key={h} className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/40">
              {entries.map((e) => (
                <tr key={e.sortKey}
                  className={cn(
                    'transition-all',
                    e.sortKey === bestEntry!.sortKey
                      ? 'bg-indigo-50/40 hover:bg-indigo-50/60'
                      : 'hover:bg-slate-50/40'
                  )}>
                  <td className="px-10 py-4 text-sm font-bold text-slate-700 whitespace-nowrap">
                    {e.sortKey === bestEntry!.sortKey && (
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-3 mb-0.5" />
                    )}
                    {MONTH_NAMES_FR[e.month]}
                  </td>
                  <td className="px-10 py-4 text-sm font-black font-mono text-slate-500">{e.year}</td>
                  <td className="px-10 py-4">
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        'text-sm font-black font-mono',
                        e.sortKey === bestEntry!.sortKey ? 'text-indigo-600' : 'text-slate-700'
                      )}>
                        {e.count}
                      </span>
                      {/* Mini progress bar */}
                      <div className="flex-1 max-w-[160px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-400 transition-all"
                          style={{ width: `${(e.count / bestEntry!.count) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
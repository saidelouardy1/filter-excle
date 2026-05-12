import React from 'react';
import { motion } from 'motion/react';
import { DEPARTMENTS } from '../constants';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Users, FileCheck, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">نظرة عامة على الجماعة - Municipal Overview</h2>
        <div className="flex gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">حالة النظام: طبيعية - System Status: Normal</span>
        </div>
      </header>

      {/* Department Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEPARTMENTS.map((dept, i) => (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/department/${dept.slug}`}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all cursor-pointer group block"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  "bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white"
                )}>
                  <dept.icon size={24} />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {Math.floor(Math.random() * 2000) + 500}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">
                    +{Math.floor(Math.random() * 15) + 5}% VS LAST MONTH
                  </p>
                </div>
              </div>
              <h3 className="font-bold text-slate-900">{dept.name}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Management of files and documentation related to {dept.name.toLowerCase()} services.
              </p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Middle Section: Stats & Reports */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <section className="md:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-bold text-slate-900 tracking-tight">الأداء التشغيلي - Operational Performance</h1>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                تمت المعالجة - Processed
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                المستهدف - Target
              </span>
            </div>
          </div>
          
          <div className="flex-1 flex items-end justify-between gap-3 px-4 py-8">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((month, i) => {
              const height = [60, 75, 65, 90, 70, 85, 60][i];
              const innerHeight = [80, 75, 83, 66, 80, 60, 66][i];
              return (
                <div key={month} className="w-full h-full flex flex-col items-center justify-end gap-2 group">
                  <div style={{ height: `${height}%` }} className="w-8 md:w-12 bg-blue-100 rounded-t-lg relative overflow-hidden transition-all duration-500 group-hover:bg-blue-200">
                    <div style={{ height: `${innerHeight}%` }} className="absolute bottom-0 left-0 w-full bg-blue-600 rounded-t-lg transition-all duration-700" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{month}</span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="md:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col h-full">
            <h3 className="font-bold text-slate-900 mb-6 uppercase text-xs tracking-widest">System Health</h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest mb-2">
                  <span className="text-slate-500">Storage Used</span>
                  <span className="text-slate-900">42% (210 GB)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '42%' }}
                    className="h-full bg-blue-600 rounded-full" 
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest pt-2">
                <span className="text-slate-500">Last Import</span>
                <span className="text-slate-900">2h 15m ago</span>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mt-4">
                <p className="text-[10px] font-bold text-emerald-700 uppercase leading-none mb-1 tracking-widest">Approval Rate</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-2xl font-black text-emerald-800 tracking-tighter">94.2%</span>
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                    <FileCheck size={18} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

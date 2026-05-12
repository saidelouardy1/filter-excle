import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../constants';
import { LogOut, LayoutGrid } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export const Sidebar = () => {
  return (
    <aside className="fixed right-0 top-0 h-screen w-72 bg-white/50 backdrop-blur-xl border-l border-white/50 flex flex-col shrink-0 z-50">
      <div className="p-8 flex items-center gap-4 border-b border-white/20">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/20">
          <LayoutGrid className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-xl tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">الجماعة</span>
          <span className="text-[10px] font-black text-slate-400 -mt-1 tracking-widest uppercase">Analytics Suite</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <div>
          <p className="px-5 mb-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">القائمة الذكية</p>
          <div className="space-y-3">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-4 px-5 h-14 rounded-2xl transition-all duration-300 group text-[13px] font-black",
                    isActive 
                      ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20" 
                      : "text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={22} className={cn("transition-all duration-300", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-500")} />
                    <span>{item.name}</span>
                    {isActive && <motion.div layoutId="activeInd" className="mr-auto w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <div className="p-6 border-t border-white/20">
        <div className="flex items-center gap-4 p-4 bg-white/50 rounded-[2rem] border border-white shadow-sm ring-1 ring-black/[0.02]">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border-2 border-white shadow-inner flex items-center justify-center text-indigo-600 font-black text-xs">
            Admin
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-black text-slate-900 truncate tracking-tight">المسؤول الرئيسي</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">System Administrator</p>
          </div>
          <button className="text-slate-300 hover:text-rose-500 transition-all p-3 rounded-2xl hover:bg-rose-50">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
};

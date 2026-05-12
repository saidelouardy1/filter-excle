import React, { useState, useEffect } from 'react';
import { DEPARTMENTS, ServiceRecord } from '../constants';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  FileDown, 
  FileText, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Loader2
} from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { motion } from 'motion/react';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [allRecords, setAllRecords] = useState<ServiceRecord[]>([]);

  useEffect(() => {
    const q = query(collection(db, "records"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceRecord[];
      setAllRecords(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "records");
    });
    return () => unsubscribe();
  }, []);

  const generateGlobalReport = () => {
    const doc = new jsPDF() as any;
    doc.setFontSize(22);
    doc.text('Municipal consolidated Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Records: ${allRecords.length}`, 14, 35);

    const deptStats = DEPARTMENTS.map(dept => {
      const records = allRecords.filter(r => r.departmentId === dept.id);
      return [
        dept.name,
        records.length,
        records.filter(r => r.status === "Approved").length,
        records.filter(r => r.status === "Pending").length,
        records.filter(r => r.status === "Rejected").length,
      ];
    });

    doc.autoTable({
      startY: 45,
      head: [['Department', 'Total', 'Approved', 'Pending', 'Rejected']],
      body: deptStats,
      theme: 'grid',
      headStyles: { fillStyle: '#1e293b' }
    });

    doc.save('municipal-global-report.pdf');
  };

  if (loading) {
     return (
       <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
         <Loader2 className="animate-spin text-blue-600" size={40} />
         <p className="text-slate-500 font-medium">Generating Report Cache...</p>
       </div>
     );
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Audit Reports</h1>
          <p className="text-slate-500 font-medium tracking-wide">Generate and download official PDF documentation for your records.</p>
        </div>
        <button 
          onClick={generateGlobalReport}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
        >
          <FileDown size={20} />
          Global Summary PDF
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEPARTMENTS.map((dept, i) => {
          const records = allRecords.filter(r => r.departmentId === dept.id);
          const approved = records.filter(r => r.status === "Approved").length;
          
          return (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden group hover:border-blue-200 transition-all"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-6">
                  <div className={cn("p-3 rounded-2xl", dept.color)}>
                    <dept.icon size={24} className="text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Sync</p>
                    <p className="text-xs font-bold text-green-600 flex items-center gap-1 justify-end">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      LIVE
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">{dept.name}</h3>
                <p className="text-sm text-slate-500 mb-6">Internal audit records and departmental statistics summary.</p>

                <div className="grid grid-cols-3 gap-2 mb-8">
                   <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                      <p className="font-bold text-slate-900">{records.length}</p>
                   </div>
                   <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                      <p className="text-[10px] font-bold text-green-600 uppercase">OK</p>
                      <p className="font-bold text-green-700">{approved}</p>
                   </div>
                   <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                      <p className="text-[10px] font-bold text-orange-600 uppercase">Wait</p>
                      <p className="font-bold text-orange-700">{records.filter(r => r.status === "Pending").length}</p>
                   </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between group-hover:bg-blue-50 transition-colors">
                <span className="text-xs font-bold text-slate-400 group-hover:text-blue-400 transition-colors">OFFICIAL DOCUMENTATION</span>
                <button 
                   onClick={() => {
                     const doc = new jsPDF() as any;
                     doc.text(`${dept.name} Audit`, 10, 10);
                     doc.save(`audit-${dept.slug}.pdf`);
                   }}
                   className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
                >
                  <FileDown size={18} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity Mini Log */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="text-slate-400" size={20} />
            Recent Submission Log
          </h2>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">LATEST 10</span>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <tbody>
                  {allRecords.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10).map((r, i) => (
                    <tr key={r.id} className={cn("border-b border-slate-50 hover:bg-slate-50 transition-colors", i === 0 && "bg-blue-50/20")}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg", DEPARTMENTS.find(d => d.id === r.departmentId)?.color || "bg-slate-400")}>
                            {React.createElement(DEPARTMENTS.find(d => d.id === r.departmentId)?.icon || FileText, { size: 14, className: "text-white" })}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{r.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">#{r.fileNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {r.status === "Approved" ? <CheckCircle2 size={14} className="text-green-500" /> : 
                           r.status === "Pending" ? <Clock size={14} className="text-orange-500" /> : 
                           <XCircle size={14} className="text-red-500" />}
                          <span className="text-xs font-bold text-slate-600">{r.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1.5 text-slate-400">
                           <Calendar size={14} />
                           <span className="text-xs font-medium">{formatDate(r.date)}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <ChevronRight size={16} className="text-slate-300 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      </section>
    </div>
  );
}

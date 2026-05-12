// import React, { useState, useEffect } from 'react';
// import { useParams, Link } from 'react-router-dom';
// import { motion, AnimatePresence } from 'motion/react';
// import { DEPARTMENTS, ServiceRecord, RecordStatus } from '../constants';
// import { 
//   Search, 
//   Filter, 
//   Calendar, 
//   FileText, 
//   SearchX, 
//   ArrowLeft,
//   Loader2,
//   FileDown
// } from 'lucide-react';
// import { query, collection, where, onSnapshot, orderBy } from 'firebase/firestore';
// import { db, handleFirestoreError, OperationType } from '../lib/firebase';
// import { cn, formatDate } from '../lib/utils';
// import { jsPDF } from 'jspdf';
// import 'jspdf-autotable';

// export default function DepartmentPage() {
//   const { slug } = useParams();
//   const dept = DEPARTMENTS.find(d => d.slug === slug);
  
//   const [loading, setLoading] = useState(true);
//   const [records, setRecords] = useState<ServiceRecord[]>([]);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [statusFilter, setStatusFilter] = useState<RecordStatus | "All">("All");
//   const [yearFilter, setYearFilter] = useState<string>("All");

//   useEffect(() => {
//     if (!dept) return;

//     setLoading(true);
//     const q = query(
//       collection(db, "records"),
//       where("departmentId", "==", dept.id),
//       orderBy("date", "desc")
//     );

//     const unsubscribe = onSnapshot(q, (snapshot) => {
//       const data = snapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       })) as ServiceRecord[];
//       setRecords(data);
//       setLoading(false);
//     }, (error) => {
//       handleFirestoreError(error, OperationType.GET, "records");
//     });

//     return () => unsubscribe();
//   }, [dept?.id]);

//   if (!dept) return <div>Department not found</div>;

//   const filteredRecords = records.filter(r => {
//     const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
//                          r.fileNumber.toLowerCase().includes(searchTerm.toLowerCase());
//     const matchesStatus = statusFilter === "All" || r.status === statusFilter;
//     const matchesYear = yearFilter === "All" || new Date(r.date).getFullYear().toString() === yearFilter;
//     return matchesSearch && matchesStatus && matchesYear;
//   });

//   const stats = {
//     total: filteredRecords.length,
//     approved: filteredRecords.filter(r => r.status === "Approved").length,
//     pending: filteredRecords.filter(r => r.status === "Pending").length,
//     rejected: filteredRecords.filter(r => r.status === "Rejected").length,
//   };

//   const years = Array.from(new Set(records.map(r => new Date(r.date).getFullYear()))).sort((a: number, b: number) => b - a);

//   const exportToPDF = () => {
//     const doc = new jsPDF() as any;
//     doc.setFontSize(18);
//     doc.text(`${dept.name} Records Report`, 14, 22);
//     doc.setFontSize(11);
//     doc.setTextColor(100);
//     doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    
//     const tableData = filteredRecords.map(r => [
//       r.fileNumber,
//       r.name,
//       r.status,
//       formatDate(r.date)
//     ]);

//     doc.autoTable({
//       startY: 35,
//       head: [['File #', 'Name', 'Status', 'Date']],
//       body: tableData,
//     });

//     doc.save(`${dept.slug}-records.pdf`);
//   };

//   return (
//     <div className="space-y-6">
//       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
//         <div>
//           <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Department View</h2>
//           <div className="flex items-center gap-3">
//             <div className={cn("p-2 rounded-xl text-white shadow-sm", dept.color)}>
//               <dept.icon size={20} />
//             </div>
//             <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{dept.name}</h1>
//           </div>
//         </div>

//         <div className="flex items-center gap-2">
//            <Link to="/" className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors shadow-sm">
//             <ArrowLeft size={16} />
//             Back
//           </Link>
//           <button 
//             onClick={exportToPDF}
//             className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
//           >
//             <FileDown size={18} />
//             Export Audit
//           </button>
//         </div>
//       </div>

//       {/* Stats Mini Grid */}
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//         {[
//           { label: 'Total Files', value: stats.total, color: 'text-slate-900', bg: 'bg-white' },
//           { label: 'Approved', value: stats.approved, color: 'text-emerald-600', bg: 'bg-white' },
//           { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-white' },
//           { label: 'Rejected', value: stats.rejected, color: 'text-rose-600', bg: 'bg-white' },
//         ].map((s) => (
//           <div key={s.label} className={cn("p-4 rounded-2xl border border-slate-200 shadow-sm", s.bg)}>
//             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
//             <p className={cn("text-xl font-bold mt-1", s.color)}>{s.value}</p>
//           </div>
//         ))}
//       </div>

//       {/* Filters & Table Container */}
//       <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
//         <div className="p-6 border-b border-slate-100 bg-slate-50/50">
//           <div className="flex flex-col md:flex-row gap-4">
//             <div className="flex-1 relative">
//               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
//               <input 
//                 type="text" 
//                 placeholder="Search database..."
//                 className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//               />
//             </div>
            
//             <div className="flex flex-wrap gap-2">
//               <select 
//                 className="bg-white px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none hover:bg-slate-50 transition-colors"
//                 value={statusFilter}
//                 onChange={(e) => setStatusFilter(e.target.value as any)}
//               >
//                 <option value="All">All Statuses</option>
//                 <option value="Approved">Approved</option>
//                 <option value="Pending">Pending</option>
//                 <option value="Rejected">Rejected</option>
//               </select>

//               <select 
//                 className="bg-white px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none hover:bg-slate-50 transition-colors"
//                 value={yearFilter}
//                 onChange={(e) => setYearFilter(e.target.value)}
//               >
//                 <option value="All">All Years</option>
//                 {years.map(y => <option key={y} value={y}>{y}</option>)}
//               </select>
//             </div>
//           </div>
//         </div>

//         <div className="p-0">
//           {loading ? (
//             <div className="p-20 flex flex-col items-center justify-center gap-4">
//               <Loader2 className="animate-spin text-blue-600" size={32} />
//               <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Fetching Data...</p>
//             </div>
//           ) : filteredRecords.length > 0 ? (
//             <div className="overflow-x-auto">
//               <table className="w-full text-left">
//                 <thead>
//                   <tr className="bg-slate-50 border-b border-slate-100">
//                     <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference</th>
//                     <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entity Name</th>
//                     <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
//                     <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
//                     <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {filteredRecords.map((record) => (
//                     <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
//                       <td className="px-8 py-4">
//                         <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
//                           REF-{record.fileNumber}
//                         </span>
//                       </td>
//                       <td className="px-8 py-4 font-bold text-slate-900 text-sm">{record.name}</td>
//                       <td className="px-8 py-4">
//                         <StatusBadge status={record.status} />
//                       </td>
//                       <td className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">{formatDate(record.date)}</td>
//                       <td className="px-8 py-4 text-right">
//                         <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg">
//                           <FileText size={18} />
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : (
//             <div className="p-20 flex flex-col items-center justify-center gap-4 text-center">
//               <SearchX className="text-slate-200" size={48} />
//               <div>
//                 <p className="text-slate-900 font-bold">No results found</p>
//                 <p className="text-slate-400 text-xs mt-1">Try adjusting your filters for this department.</p>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// function StatusBadge({ status }: { status: RecordStatus }) {
//   const styles = {
//     Approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
//     Pending: "bg-amber-50 text-amber-700 border-amber-100",
//     Rejected: "bg-rose-50 text-rose-700 border-rose-100",
//   };

//   return (
//     <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider", styles[status])}>
//       {status}
//     </span>
//   );
// }

// import React, { useState } from 'react';
// import { motion } from 'motion/react';
// import { DEPARTMENTS } from '../constants';
// import { 
//   Settings, 
//   Users as UsersIcon, 
//   Plus, 
//   Trash2, 
//   Edit3, 
//   ShieldCheck, 
//   Database,
//   Search,
//   Bell
// } from 'lucide-react';
// import { cn } from '../lib/utils';

// export default function Admin() {
//   const [activeTab, setActiveTab] = useState<'departments' | 'users' | 'settings'>('departments');

//   return (
//     <div className="space-y-8 pb-20">
//       <header>
//         <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Administration</h1>
//         <p className="text-slate-500 font-medium tracking-wide">Manage departments, system users, and global configuration.</p>
//       </header>

//       {/* Tabs */}
//       <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
//         {[
//           { id: 'departments', label: 'Departments', icon: Database },
//           { id: 'users', label: 'Users', icon: UsersIcon },
//           { id: 'settings', label: 'System Settings', icon: Settings },
//         ].map(tab => (
//           <button
//             key={tab.id}
//             onClick={() => setActiveTab(tab.id as any)}
//             className={cn(
//               "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
//               activeTab === tab.id 
//                 ? "bg-white text-slate-900 shadow-sm" 
//                 : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
//             )}
//           >
//             <tab.icon size={16} />
//             {tab.label}
//           </button>
//         ))}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
//         <div className="lg:col-span-3">
//           {activeTab === 'departments' && (
//             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
//               <div className="flex items-center justify-between">
//                  <h2 className="text-xl font-bold text-slate-900">Manage Departments</h2>
//                  <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
//                    <Plus size={18} />
//                    Add Department
//                  </button>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                  {DEPARTMENTS.map(dept => (
//                    <div key={dept.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-blue-200 transition-all">
//                       <div className="flex items-start justify-between">
//                          <div className={cn("p-3 rounded-2xl", dept.color)}>
//                            <dept.icon className="text-white" size={24} />
//                          </div>
//                          <div className="flex items-center gap-1">
//                             <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
//                               <Edit3 size={18} />
//                             </button>
//                             <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
//                               <Trash2 size={18} />
//                             </button>
//                          </div>
//                       </div>
//                       <div className="mt-4">
//                         <h3 className="font-bold text-lg text-slate-900">{dept.name}</h3>
//                         <p className="text-sm text-slate-500 mt-1">Slug: /department/{dept.slug}</p>
//                       </div>
//                       <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
//                          <div className="flex items-center gap-2">
//                            <ShieldCheck size={14} className="text-green-500" />
//                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Status</span>
//                          </div>
//                          <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">MODERATED</div>
//                       </div>
//                    </div>
//                  ))}
//               </div>
//             </motion.div>
//           )}

//           {activeTab === 'users' && (
//              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
//                 <div className="p-8 border-b border-slate-100 flex items-center justify-between">
//                   <h2 className="text-xl font-bold text-slate-900">User Access Control</h2>
//                   <div className="relative w-64">
//                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
//                     <input type="text" placeholder="Search users..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
//                   </div>
//                 </div>
//                 <div className="p-0">
//                    <table className="w-full text-left">
//                       <thead className="bg-slate-50 border-b border-slate-100">
//                         <tr>
//                           <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase">User</th>
//                           <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase">Role</th>
//                           <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
//                           <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
//                         </tr>
//                       </thead>
//                       <tbody className="divide-y divide-slate-100">
//                         {[
//                           { name: 'John Doe', email: 'john@municipality.gov', role: 'Administrator', status: 'Active' },
//                           { name: 'Sarah Smith', email: 'sarah@municipality.gov', role: 'Planner', status: 'Active' },
//                           { name: 'Mike Johnson', email: 'mike@municipality.gov', role: 'Tax Officer', status: 'Pending' },
//                         ].map(user => (
//                           <tr key={user.email} className="hover:bg-slate-50 transition-colors">
//                             <td className="px-8 py-4">
//                               <div className="flex items-center gap-3">
//                                 <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 uppercase">
//                                   {user.name.charAt(0)}
//                                 </div>
//                                 <div>
//                                   <p className="font-bold text-slate-900 text-sm">{user.name}</p>
//                                   <p className="text-xs text-slate-500">{user.email}</p>
//                                 </div>
//                               </div>
//                             </td>
//                             <td className="px-8 py-4">
//                               <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">{user.role}</span>
//                             </td>
//                             <td className="px-8 py-4">
//                               <div className="flex items-center gap-1.5">
//                                 <div className={cn("w-1.5 h-1.5 rounded-full", user.status === 'Active' ? 'bg-green-500' : 'bg-orange-500')} />
//                                 <span className="text-xs font-bold text-slate-600">{user.status}</span>
//                               </div>
//                             </td>
//                             <td className="px-8 py-4 text-right">
//                               <button className="text-xs font-bold text-blue-600 hover:underline">Edit Permissions</button>
//                             </td>
//                           </tr>
//                         ))}
//                       </tbody>
//                    </table>
//                 </div>
//              </motion.div>
//           )}

//           {activeTab === 'settings' && (
//             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
//                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
//                   <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
//                     <Bell className="text-orange-500" size={20} />
//                     System Notifications
//                   </h2>
//                   <div className="space-y-4">
//                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
//                        <div>
//                          <p className="font-bold text-slate-900">Email Alerts</p>
//                          <p className="text-sm text-slate-500">Enable automated notifications for new file submissions.</p>
//                        </div>
//                        <div className="w-12 h-6 bg-blue-600 rounded-full relative">
//                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
//                        </div>
//                     </div>
//                   </div>
//                </div>
//             </motion.div>
//           )}
//         </div>

//         <aside className="space-y-6">
//            <div className="bg-slate-900 rounded-3xl p-8 text-white">
//               <h3 className="font-bold text-lg mb-4">System Backup</h3>
//               <p className="text-sm text-slate-400 mb-6 leading-relaxed">
//                 Platform performs daily automated snapshots of all departmental records.
//               </p>
//               <button className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all">
//                 Download Latest
//               </button>
//            </div>
//         </aside>
//       </div>
//     </div>
//   );
// }

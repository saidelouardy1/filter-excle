import { 
  Map, 
  TreePine, 
  MessageSquareText, 
  Store, 
  Users, 
  Receipt,
  LayoutDashboard,
  FileUp,
  Settings,
  TrendingUp,
  FileText
} from 'lucide-react';

export const DEPARTMENTS = [
  { id: "urban", name: "التخطيط العمراني", slug: "urban-planning", icon: Map, color: "bg-blue-600" },
  { id: "public", name: "المجال التقني", slug: "public-domain", icon: TreePine, color: "bg-blue-500" },
  { id: "complaints", name: "الشكايات", slug: "complaints", icon: MessageSquareText, color: "bg-blue-400" },
  { id: "commercial", name: "الرخص التجارية", slug: "commercial-licenses", icon: Store, color: "bg-slate-600" },
  { id: "civil", name: "الحالة المدنية", slug: "civil-status", icon: Users, color: "bg-slate-500" },
  { id: "taxes", name: "الجبايات", slug: "taxes-fees", icon: Receipt, color: "bg-slate-400" },
];

export const NAV_ITEMS = [
  { name: "الاستيراد والتحليل", href: "/", icon: FileUp },
  { name: "الإحصائيات", href: "/statistics", icon: TrendingUp },
];

export type RecordStatus = "Pending" | "Approved" | "Rejected";

export interface ServiceRecord {
  id: string;
  departmentId: string;
  name: string;
  fileNumber: string;
  status: RecordStatus;
  date: string;
  amount?: number;
  data?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Users, 
  TrendingUp, 
  Clock,
  ChevronLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import { Document } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data));
  }, []);

  if (!stats) return <div className="p-8">جاري التحميل...</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">مرحباً بك في نظام الأرشفة</h2>
          <p className="text-slate-500 mt-1">إحصائيات وتحليلات النظام اليومية</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 flex items-center gap-2">
          <Clock size={16} />
          {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'إجمالي الوثائق', value: stats.total, icon: FileText, color: 'bg-blue-600', trend: '+12%' },
          { label: 'الوثائق الجديدة', value: stats.recent.length, icon: TrendingUp, color: 'bg-indigo-600', trend: 'اليوم' },
          { label: 'الأقسام النشطة', value: stats.byType.length, icon: Users, color: 'bg-slate-800', trend: 'محلي' },
          { label: 'صحة البيانات', value: '98%', icon: ShieldCheck, color: 'bg-emerald-600', trend: 'آمن' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            <div className="flex justify-between items-center mb-4">
              <div className={`p-2.5 rounded-xl ${stat.color} text-white shadow-lg`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.trend}</span>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-slate-800 text-base">سجل الأرشفة الأخير</h3>
            <button className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
              عرض الأرشيف الكامل <ChevronLeft size={16} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.recent.map((doc: Document) => (
              <div key={doc.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <FileText size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{doc.fileName}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">#{doc.bookNumber || 'بدون رقم'}</span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[10px] font-bold text-blue-600">{doc.issuer || 'جهة غير معرفة'}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black mb-1">
                    {doc.docType}
                  </span>
                  <p className="text-slate-400 text-[10px] font-medium">
                    {new Date(doc.createdAt).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <h3 className="font-black text-slate-800 text-base mb-6">تحليل التصنيفات</h3>
          <div className="space-y-5 flex-1">
            {stats.byType.map((item: any, i: number) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                  <span className="text-slate-700">{item.docType}</span>
                  <span className="text-blue-600">{item.count} مستند</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / stats.total) * 100}%` }}
                    className="h-full bg-blue-600"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 bg-blue-600 rounded-xl text-white">
            <h5 className="text-xs font-black mb-1">نصيحة الأرشفة</h5>
            <p className="text-[10px] leading-relaxed opacity-80 font-medium">نظام الذكاء الاصطناعي يقوم بتحليل المستندات وتصنيفها تلقائياً لضمان سرعة الوصول للمعلومة.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShieldCheck = ({ size, className }: { size?: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default Dashboard;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Files, 
  Search, 
  Settings, 
  ShieldCheck, 
  DatabaseBackup,
  PlusCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
    { id: 'explorer', icon: Files, label: 'المستندات' },
    { id: 'search', icon: Search, label: 'البحث المتقدم' },
    { id: 'permissions', icon: ShieldCheck, label: 'الصلاحيات' },
    { id: 'backup', icon: DatabaseBackup, label: 'النسخ الاحتياطي' },
    { id: 'settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <div className="w-64 h-screen bg-[#0f172a] text-white flex flex-col fixed right-0 top-0 shadow-2xl z-20">
      <div className="p-6 flex items-center gap-3 border-b border-slate-700/50">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-900/20">
          A
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight leading-tight">أرشيف برو</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">المؤسسة الذكية</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400 transition-colors'} />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 mt-auto border-t border-slate-700/50 bg-slate-900/30">
        <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold mb-3 px-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>النظام متصل محلياً (Offline)</span>
        </div>
        
        <div className="px-2 mb-4">
          <div className="flex justify-between text-[9px] text-slate-500 mb-1 font-bold">
            <span>سعة التخزين</span>
            <span>65%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
            <div className="bg-blue-500 h-1 rounded-full w-[65%]"></div>
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('upload')}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-blue-600/10 active:scale-95"
        >
          <PlusCircle size={18} />
          إضافة وثيقة
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

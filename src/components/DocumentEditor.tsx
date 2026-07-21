/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Printer, 
  Share2, 
  Link as LinkIcon,
  Maximize2,
  FileText,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { Document } from '../types';

interface DocumentEditorProps {
  document: Document;
  onClose: () => void;
  onSave: (id: number, data: Partial<Document>) => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ document: initialDoc, onClose, onSave }) => {
  const [doc, setDoc] = useState<Document>(initialDoc);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'text'>('fields');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDoc(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(doc.id, doc);
    setIsSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const docTypes = [
    'عقوبة', 'تقاعد', 'انفكاك', 'نقل', 'الحاق', 'التحاق', 'وفاة', 'اجازة', 'سحب يد', 'ترقية', 'علاوة', 'أخرى'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#f8fafc] w-full max-w-7xl h-[92vh] rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-white/10"
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center shadow-inner border border-slate-200/50">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg tracking-tight">{doc.fileName}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">معرف الوثيقة: ARCH-{doc.id}-PRO</span>
                <span className="text-slate-300">|</span>
                <span className="text-blue-600 text-[10px] font-black uppercase tracking-widest">{doc.docType}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all text-xs font-black flex items-center gap-2"
            >
              <Printer size={16} />
              طباعة سريعة
            </button>
            <div className="w-px h-6 bg-slate-200 mx-2" />
            <button 
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Preview */}
          <div className="flex-1 bg-slate-200 p-8 flex flex-col overflow-hidden">
            <div className="bg-white rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden border border-slate-300">
              <div className="bg-slate-800 text-white px-5 py-2.5 flex justify-between items-center text-[10px] font-bold tracking-widest uppercase">
                <div className="flex gap-4">
                  <span>{doc.fileName}</span>
                  <span className="text-slate-500">|</span>
                  <span>100% عرض</span>
                </div>
                <div className="flex gap-4 opacity-70">
                  <button className="hover:text-blue-400 transition-colors">تظليل</button>
                  <button className="hover:text-blue-400 transition-colors">تكبير</button>
                </div>
              </div>
              <div className="flex-1 bg-slate-400 flex items-center justify-center p-12 overflow-auto custom-scrollbar">
                <div className="bg-white w-full max-w-[500px] aspect-[1/1.41] shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-12 flex flex-col relative">
                  {doc.fileType.startsWith('image/') ? (
                    <img 
                      src={`/${doc.filePath}`} 
                      alt="Preview" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-6 opacity-40">
                      <FileText size={80} />
                      <p className="font-black text-xl text-center">معاينة المستند الرقمي</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-12 bg-slate-50 border-t border-slate-200 px-6 flex items-center gap-4 text-xs">
                <span className="font-black text-blue-600 uppercase tracking-widest">OCR:</span>
                <div className="truncate text-slate-400 italic font-medium">"{doc.extractedText.substring(0, 150)}..."</div>
              </div>
            </div>
          </div>

          {/* Right: Fields */}
          <div id="printable-area" className="w-[450px] border-r border-slate-200 flex flex-col bg-white overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
              <h4 className="font-black text-slate-800 text-base">بيانات المستند الرقمية</h4>
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">تحليل AI مكتمل</span>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
              <div className="flex flex-col items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
                <img src={doc.qrCode} alt="QR Code" className="w-28 h-28 mix-blend-multiply" />
                <p className="text-[10px] font-black text-slate-400 mt-4 tracking-widest">رمز تعريف فريد: QR-{doc.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <Field label="عنوان الموضوع" name="subject" value={doc.subject} onChange={handleChange} />
                </div>
                <div className="col-span-2">
                  <TextAreaField label="مضمون الكتاب" name="docContent" value={doc.docContent} onChange={handleChange} />
                </div>
                <Field label="رقم الكتاب" name="bookNumber" value={doc.bookNumber} onChange={handleChange} />
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">نوع الوثيقة</label>
                  <select 
                    name="docType"
                    value={doc.docType}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                  >
                    {docTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <Field label="تاريخ الكتاب" name="bookDate" value={doc.bookDate} onChange={handleChange} />
                <Field label="تاريخ الإصدار" name="issueDate" value={doc.issueDate} onChange={handleChange} />
                <Field label="الجهة المصدرة" name="issuer" value={doc.issuer} onChange={handleChange} />
                <Field label="الجهة المستلمة" name="recipient" value={doc.recipient} onChange={handleChange} />
                <Field label="اسم الموظف" name="employeeName" value={doc.employeeName} onChange={handleChange} />
                <Field label="الرتبة" name="rank" value={doc.rank} onChange={handleChange} />
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-200 transition-all disabled:opacity-50"
              >
                <Save size={18} />
                {isSaving ? 'جاري الحفظ...' : 'تثبيت البيانات'}
              </button>
              <button 
                onClick={handlePrint}
                className="px-6 py-4 border-2 border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-white hover:border-slate-300 transition-all text-sm"
              >
                طباعة مع الباركود
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Field = ({ label, name, value, onChange }: { label: string, name: string, value: any, onChange: any }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input 
      type="text"
      name={name}
      value={value || ''}
      onChange={onChange}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
    />
  </div>
);

const TextAreaField = ({ label, name, value, onChange }: { label: string, name: string, value: any, onChange: any }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <textarea 
      name={name}
      value={value || ''}
      onChange={onChange}
      rows={4}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm resize-y"
    />
  </div>
);

export default DocumentEditor;

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
  Info,
  Sparkles,
  CheckCheck,
  AlertCircle,
  Check
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
  
  // Spell correction states
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [corrections, setCorrections] = useState<Array<{ original: string; corrected: string; confidence: number; index: number }>>([]);
  const [correctionFeedback, setCorrectionFeedback] = useState('');
  const [correctionError, setCorrectionError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDoc(prev => ({ ...prev, [name]: value }));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    setDoc(prev => ({ ...prev, extractedText: value }));
  };

  const handleSpellCorrection = async () => {
    setIsCorrecting(true);
    setCorrectionError('');
    setCorrectionFeedback('');
    try {
      const res = await fetch('/api/correct-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: doc.extractedText })
      });
      if (!res.ok) {
        throw new Error('فشل تصحيح النص معجمياً من الخادم.');
      }
      const data = await res.json();
      setDoc(prev => ({ ...prev, extractedText: data.correctedText }));
      setCorrections(data.corrections);
      if (data.corrections.length > 0) {
        setCorrectionFeedback(`تم تصحيح ${data.corrections.length} كلمة معجمية شائعة بنجاح!`);
      } else {
        setCorrectionFeedback('تحليل النص معجمياً مكتمل. لم يتم رصد أي أخطاء تتطلب التصحيح حالياً.');
      }
    } catch (err: any) {
      setCorrectionError(err.message || 'تعذر تشغيل محرك التدقيق المعجمي الذكي.');
    } finally {
      setIsCorrecting(false);
    }
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

          {/* Right Panel: Tabbed View */}
          <div id="printable-area" className="w-[480px] border-r border-slate-200 flex flex-col bg-white overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
            {/* Tab Controls */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('fields')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                    activeTab === 'fields' 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  بيانات الأرشفة
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                    activeTab === 'text' 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  النص الكامل والتدقيق
                </button>
              </div>
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">تحليل AI مكتمل</span>
            </div>

            {/* Tab 1: Fields Form */}
            {activeTab === 'fields' && (
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
                <div className="flex flex-col items-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
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
            )}

            {/* Tab 2: OCR Extracted Text & Lexical Correction */}
            {activeTab === 'text' && (
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
                {/* Information Header */}
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex gap-3.5">
                  <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="text-xs font-black text-blue-900 leading-normal mb-1">المصحح المعجمي الذكي (أوفلاين)</h5>
                    <p className="text-[11px] text-blue-700/80 leading-relaxed font-bold">
                      تم دمج محرك مقارنة معجمية يعتمد على خوارزمية مسافة (Levenshtein) لمطابقة الكلمات بقاموس الدوائر والمخاطبات الرسمية وتصحيح الحروف الملتبسة في الـ OCR (مثل: ة/ه، ي/ى، والهمزات).
                    </p>
                  </div>
                </div>

                {/* Main Edit Canvas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">محرر النص المستخرج بالكامل</label>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {(doc.extractedText || '').length} حرفاً
                    </span>
                  </div>
                  <textarea
                    value={doc.extractedText || ''}
                    onChange={handleTextChange}
                    rows={12}
                    placeholder="لا يوجد نص مستخرج حالياً للوثيقة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm resize-none custom-scrollbar"
                  />
                </div>

                {/* Lexical correction triggers */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSpellCorrection}
                    disabled={isCorrecting || !(doc.extractedText || '').trim()}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50 text-xs"
                  >
                    <Sparkles size={16} />
                    {isCorrecting ? 'جاري الفحص والمقارنة...' : 'تشغيل التدقيق اللغوي المعجمي'}
                  </button>
                </div>

                {/* Status Messages */}
                {correctionError && (
                  <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-bold flex gap-2 items-center">
                    <AlertCircle size={16} />
                    {correctionError}
                  </div>
                )}

                {correctionFeedback && (
                  <div className="bg-emerald-50 text-emerald-800 p-3.5 rounded-xl text-xs font-bold flex gap-2 items-center">
                    <CheckCheck className="text-emerald-600 shrink-0" size={16} />
                    {correctionFeedback}
                  </div>
                )}

                {/* Corrections Breakdown */}
                {corrections.length > 0 && (
                  <div className="space-y-3">
                    <h6 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      تفاصيل الكلمات التي تم تعديلها (%{corrections.length})
                    </h6>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                      {corrections.map((corr, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs font-bold bg-white">
                          <div className="flex items-center gap-2">
                            <span className="line-through text-red-400">{corr.original}</span>
                            <span className="text-slate-400">←</span>
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-black">{corr.corrected}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            دقة %{Math.round(corr.confidence * 100)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Common bottom action bar */}
            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-200 transition-all disabled:opacity-50 text-sm"
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

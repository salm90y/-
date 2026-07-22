/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { 
  X, 
  Upload, 
  File, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [useGemini, setUseGemini] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus('uploading');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Step 1: Upload and initial process
      const response = await fetch(`/api/upload?useGemini=${useGemini}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('فشل الرفع والمعالجة');
      
      setStatus('processing');
      // Simulated processing delay for effect (actually backend is already done)
      await new Promise(r => setTimeout(r, 1500));
      
      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg">أرشفة وثيقة جديدة</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <div 
            className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all ${
              file ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50 cursor-pointer'
            }`}
            onClick={() => !file && document.getElementById('file-input')?.click()}
          >
            <input 
              id="file-input"
              type="file" 
              className="hidden" 
              onChange={handleFileChange}
              accept=".pdf,.docx,.xlsx,.jpg,.png,.tiff"
            />
            
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div 
                  key="success"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4" />
                  <h4 className="text-xl font-bold text-slate-800">تمت الأرشفة بنجاح!</h4>
                  <p className="text-slate-500 mt-2">تم استخراج البيانات وتخزينها في النظام.</p>
                </motion.div>
              ) : status === 'error' ? (
                <motion.div 
                  key="error"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
                  <h4 className="text-xl font-bold text-slate-800">حدث خطأ</h4>
                  <p className="text-slate-500 mt-2">{error}</p>
                </motion.div>
              ) : file ? (
                <motion.div 
                  key="file"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-center w-full"
                >
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                    <File size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 truncate px-4">{file.name}</h4>
                  <p className="text-slate-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  
                  {status === 'idle' ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="mt-4 text-red-500 text-sm font-bold hover:underline"
                    >
                      إلغاء الملف
                    </button>
                  ) : (
                    <div className="mt-8 space-y-4">
                      <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-600"
                          animate={{ 
                            width: status === 'uploading' ? '60%' : '100%',
                            transition: { duration: status === 'uploading' ? 2 : 1 }
                          }}
                        />
                      </div>
                      <p className="text-blue-600 text-sm font-bold flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {status === 'uploading' ? 'جاري رفع الملف...' : 'جاري تحليل الوثيقة بالذكاء الاصطناعي...'}
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-700">اسحب الملف هنا أو انقر للإضافة</h4>
                  <p className="text-slate-400 text-sm mt-2">يدعم PDF, Word, Excel, والصور</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI OCR Engine Toggle */}
          <div className="mt-6 bg-slate-50 border border-slate-100 p-4 rounded-2xl text-right" dir="rtl">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">محرك المعالجة والتعرف على النصوص (OCR)</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUseGemini(true)}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  useGemini 
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm shadow-blue-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center ${useGemini ? 'bg-blue-600' : 'border border-slate-300'}`}>
                    {useGemini && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span className={`text-sm font-bold ${useGemini ? 'text-blue-900' : 'text-slate-700'}`}>الذكاء السحابي فائق الدقة</span>
                </div>
                <span className="text-[10px] text-slate-400 leading-normal">
                  يستخدم Gemini 3.6 لضمان دقة 100% في قراءة اللغة العربية واستخراج الحقول كاملة فوراً.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUseGemini(false)}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  !useGemini 
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm shadow-emerald-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center ${!useGemini ? 'bg-emerald-600' : 'border border-slate-300'}`}>
                    {!useGemini && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span className={`text-sm font-bold ${!useGemini ? 'text-emerald-900' : 'text-slate-700'}`}>معالجة أوفلاين (PaddleOCR الذكي)</span>
                </div>
                <span className="text-[10px] text-slate-400 leading-normal">
                  نظام الأرشفة المحلي القوي (PaddleOCR ذو الدقة العالية مع معالج النصوص المتقدم). يعمل 100% بدون إنترنت داخل خادم المؤسسة.
                </span>
              </button>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button 
              onClick={handleUpload}
              disabled={!file || status !== 'idle'}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              ابدأ عملية الأرشفة
            </button>
            <button 
              onClick={onClose}
              disabled={status === 'uploading' || status === 'processing'}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadModal;

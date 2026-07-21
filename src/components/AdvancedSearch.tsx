import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  Eye, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  RefreshCw, 
  Tag, 
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ShieldAlert,
  Sliders,
  Sparkles,
  Layers
} from 'lucide-react';
import { Document, DocumentType } from '../types';

interface AdvancedSearchProps {
  onView: (doc: Document) => void;
}

export default function AdvancedSearch({ onView }: AdvancedSearchProps) {
  // Main form states
  const [query, setQuery] = useState('');
  const [bookNumber, setBookNumber] = useState('');
  const [issuer, setIssuer] = useState('');
  const [docType, setDocType] = useState('الكل');
  const [employeeName, setEmployeeName] = useState('');
  const [subject, setSubject] = useState('');
  const [secretNumber, setSecretNumber] = useState('');
  const [rank, setRank] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Document[]>([]);
  const [searchDuration, setSearchDuration] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedSearches, setSavedSearches] = useState<{ id: number; title: string; filters: any }[]>([]);

  // List of standard document types in Iraq/Arabic administrative settings
  const docTypes: DocumentType[] = [
    'عقوبة', 'تقاعد', 'انفكاك', 'نقل', 'الحاق', 'التحاق', 'وفاة', 'اجازة', 'سحب يد', 'ترقية', 'علاوة', 'أخرى'
  ];

  useEffect(() => {
    // Load local history if any
    const history = localStorage.getItem('search_presets');
    if (history) {
      setSavedSearches(JSON.parse(history));
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setHasSearched(true);
    const startTime = performance.now();

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          bookNumber,
          issuer,
          docType,
          employeeName,
          subject,
          secretNumber,
          rank,
          dateFrom,
          dateTo
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      const endTime = performance.now();
      setSearchDuration(parseFloat(((endTime - startTime) / 1000).toFixed(3)));
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setBookNumber('');
    setIssuer('');
    setDocType('الكل');
    setEmployeeName('');
    setSubject('');
    setSecretNumber('');
    setRank('');
    setDateFrom('');
    setDateTo('');
    setResults([]);
    setHasSearched(false);
    setSearchDuration(null);
  };

  const saveSearchPreset = () => {
    if (!query && !bookNumber && !employeeName && !subject) return;
    
    const title = query 
      ? `بحث عن: ${query}` 
      : bookNumber 
      ? `كتاب رقم: ${bookNumber}` 
      : employeeName 
      ? `الموظف: ${employeeName}`
      : `موضوع: ${subject}`;

    const newPreset = {
      id: Date.now(),
      title,
      filters: {
        query, bookNumber, issuer, docType, employeeName, subject, secretNumber, rank, dateFrom, dateTo
      }
    };

    const updated = [newPreset, ...savedSearches.slice(0, 4)];
    setSavedSearches(updated);
    localStorage.setItem('search_presets', JSON.stringify(updated));
  };

  const applyPreset = (presetFilters: any) => {
    setQuery(presetFilters.query || '');
    setBookNumber(presetFilters.bookNumber || '');
    setIssuer(presetFilters.issuer || '');
    setDocType(presetFilters.docType || 'الكل');
    setEmployeeName(presetFilters.employeeName || '');
    setSubject(presetFilters.subject || '');
    setSecretNumber(presetFilters.secretNumber || '');
    setRank(presetFilters.rank || '');
    setDateFrom(presetFilters.dateFrom || '');
    setDateTo(presetFilters.dateTo || '');
    
    // Trigger search after state updates
    setTimeout(() => {
      handleSearch();
    }, 100);
  };

  const deletePreset = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSearches.filter(p => p.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('search_presets', JSON.stringify(updated));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    
    // Arabic CSV Header
    const headers = ["الرقم المرجعي", "اسم الملف", "رقم الكتاب", "تاريخ الكتاب", "الجهة المصدرة", "اسم الموظف", "الموضوع", "النوع"];
    const rows = results.map(doc => [
      doc.id,
      `"${doc.fileName.replace(/"/g, '""')}"`,
      `"${(doc.bookNumber || '').replace(/"/g, '""')}"`,
      `"${doc.bookDate || ''}"`,
      `"${(doc.issuer || '').replace(/"/g, '""')}"`,
      `"${(doc.employeeName || '').replace(/"/g, '""')}"`,
      `"${(doc.subject || '').replace(/"/g, '""')}"`,
      `"${doc.docType || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_بحث_الأرشيف_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to find and highlight match in extracted OCR text
  const renderTextHighlight = (text: string, searchTerm: string) => {
    if (!text || !searchTerm) return null;
    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (index === -1) return null;

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + searchTerm.length + 80);
    const snippet = text.substring(start, end);

    const parts = snippet.split(new RegExp(`(${searchTerm})`, 'gi'));
    return (
      <p className="text-xs text-slate-500 leading-relaxed font-mono mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
        ...{parts.map((part, i) => 
          part.toLowerCase() === searchTerm.toLowerCase() 
            ? <span key={i} className="bg-amber-100 text-amber-900 font-bold px-1 rounded">{part}</span>
            : part
        )}...
      </p>
    );
  };

  return (
    <div id="advanced-search-page" className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header with Enterprise design */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#0f172a] text-white p-8 rounded-3xl shadow-xl border border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={14} />
            محرك البحث الاستعلامي المتقدم
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Search className="text-blue-500" size={28} />
            البحث المتقدم والأرشفة الرقمية
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            ابحث من خلال مصفوفة الفهرسة، التواريخ، الأسماء الرباعية، أرقام الكتب والمستندات السرية
          </p>
        </div>

        <div className="flex gap-2 self-stretch md:self-auto">
          <button 
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            <Filter size={14} />
            {showAdvanced ? 'إخفاء لوحة الفلاتر' : 'إظهار لوحة الفلاتر'}
          </button>
          
          <button 
            type="button"
            onClick={handleReset}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/60"
          >
            إعادة تعيين الاستعلام
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Right side: Search form (collapsible) */}
        {showAdvanced && (
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-6 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Sliders size={16} className="text-blue-600" />
                معايير التصفية والفهرسة
              </h3>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              
              {/* Query word */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">البحث بالنص أو الكلمات الدالة</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="كلمة أو نص في الوثيقة..."
                    className="w-full text-xs px-3 py-2.5 pr-8 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                </div>
              </div>

              {/* Book number */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">رقم الكتاب الرسمي</label>
                <input 
                  type="text" 
                  value={bookNumber}
                  onChange={(e) => setBookNumber(e.target.value)}
                  placeholder="مثال: د/15/443"
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 font-mono"
                  dir="ltr"
                />
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">تصنيف نوع الكتاب</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 bg-white"
                >
                  <option value="الكل">الكل (كافة التصنيفات)</option>
                  {docTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Employee Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">اسم الموظف المعني</label>
                <input 
                  type="text" 
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="الاسم الثلاثي أو الرباعي..."
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الموضوع الرئيسي للمستند</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثال: ترقية، نقل، عقوبة..."
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              {/* Issuer */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الجهة المصدرة للكتاب</label>
                <input 
                  type="text" 
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="الدائرة أو القسم المصدر..."
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              {/* Rank */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الدرجة الوظيفية / الرتبة</label>
                <input 
                  type="text" 
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  placeholder="مثال: مدير قسم، معاون رئيس مهندسين..."
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              {/* Secret Number */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الرقم السري (إن وجد)</label>
                <input 
                  type="text" 
                  value={secretNumber}
                  onChange={(e) => setSecretNumber(e.target.value)}
                  placeholder="مثال: سري/55"
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 font-mono"
                  dir="ltr"
                />
              </div>

              {/* Dates */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <span className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-600" />
                  النطاق الزمني لتاريخ الكتاب
                </span>
                
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">تاريخ الكتاب من</label>
                  <input 
                    type="date" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200 text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">تاريخ الكتاب إلى</label>
                  <input 
                    type="date" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200 text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 active:scale-95"
                >
                  {loading ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                  {loading ? 'جاري الاستعلام...' : 'تشغيل الاستعلام المتقدم'}
                </button>
              </div>

              <button 
                type="button"
                onClick={saveSearchPreset}
                className="w-full py-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 rounded-xl text-[11px] font-bold transition-all text-center"
              >
                حفظ كاستعلام محفوظ
              </button>
            </form>
          </div>
        )}

        {/* Left side: Results (takes remaining columns) */}
        <div className={`space-y-6 ${showAdvanced ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          
          {/* Saved search shortcuts */}
          {savedSearches.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Tag size={12} className="text-blue-600" />
                الاستعلامات المحفوظة مؤخراً:
              </span>
              
              {savedSearches.map((p) => (
                <div 
                  key={p.id}
                  onClick={() => applyPreset(p.filters)}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/20 px-3 py-1.5 rounded-xl cursor-pointer text-xs font-bold text-slate-700 transition-all select-none group"
                >
                  <span>{p.title}</span>
                  <button 
                    onClick={(e) => deletePreset(p.id, e)}
                    className="text-slate-300 hover:text-rose-500 font-bold transition-colors text-[10px] pr-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Metrics summary */}
          {hasSearched && (
            <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white px-6 py-4 rounded-2xl border border-slate-200/60 gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Layers size={18} />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold">تقرير البحث والمطابقة</span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    عثرنا على <strong className="text-blue-600 text-base">{results.length}</strong> مستند مطابق لمعايير الاستعلام المتقدم.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                {searchDuration !== null && (
                  <span className="text-xs text-slate-400 font-medium font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    استغرق البحث {searchDuration} ثانية
                  </span>
                )}

                {results.length > 0 && (
                  <div className="flex gap-1">
                    <button 
                      onClick={handleExportCSV}
                      className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      title="تصدير كتقرير Excel/CSV"
                    >
                      <FileSpreadsheet size={18} />
                    </button>
                    <button 
                      onClick={handlePrint}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                      title="طباعة التقرير"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Result Cards (Distinct layout) */}
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white p-20 rounded-2xl border border-slate-200/60 text-center shadow-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-slate-500 font-black text-sm">جاري مراجعة وتحليل فهرس الفلاتر والملفات الممسوحة...</span>
                </div>
              </div>
            ) : !hasSearched ? (
              <div className="bg-slate-50/50 p-16 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3">
                <Search className="mx-auto text-slate-300" size={48} />
                <h4 className="font-bold text-slate-800 text-sm">بانتظار بدء الاستعلام المتقدم</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  قم بتعبئة أي من حقول التصفية المتاحة في القائمة اليمنى ثم انقر على "تشغيل الاستعلام" لاستخراج المطابقات فوراً من قاعدة البيانات.
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="bg-white p-16 rounded-2xl border border-slate-200/60 text-center space-y-4 shadow-sm">
                <ShieldAlert className="mx-auto text-amber-500" size={44} />
                <h4 className="font-bold text-slate-800 text-sm">لم يتم العثور على أي نتائج مطابقة</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  يرجى التأكد من صحة أرقام الكتب والتواريخ أو قم بتقليل شروط الفلترة المحددة لتوسيع نطاق استقصاء الأرشيف.
                </p>
                <button 
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  إعادة تعيين وبدء من جديد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {results.map((doc) => (
                  <div 
                    key={doc.id}
                    className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all hover:border-slate-300/80 group space-y-4 relative overflow-hidden"
                  >
                    {/* Ribbon or top line */}
                    <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-blue-600 to-indigo-600"></div>

                    {/* Meta info header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                            {doc.fileName}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            تمت الأرشفة في {new Date(doc.createdAt).toLocaleDateString('ar-EG')} {new Date(doc.createdAt).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          doc.docType === 'سري' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                          {doc.docType || 'أخرى'}
                        </span>
                        {doc.secretNumber && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-50 text-purple-600 border border-purple-100 font-mono">
                            {doc.secretNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Properties grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-xl text-xs border border-slate-100">
                      <div>
                        <span className="block text-slate-400 font-bold mb-1">رقم الكتاب الرسمي</span>
                        <strong className="text-slate-700 font-mono" dir="ltr">{doc.bookNumber || 'غير محدد'}</strong>
                      </div>
                      
                      <div>
                        <span className="block text-slate-400 font-bold mb-1">تاريخ الكتاب</span>
                        <strong className="text-slate-700 font-mono">{doc.bookDate || 'غير محدد'}</strong>
                      </div>

                      <div>
                        <span className="block text-slate-400 font-bold mb-1">الجهة المصدرة</span>
                        <strong className="text-slate-700 font-bold">{doc.issuer || 'غير محدد'}</strong>
                      </div>

                      <div>
                        <span className="block text-slate-400 font-bold mb-1">اسم الموظف المعني</span>
                        <strong className="text-blue-600 font-black">{doc.employeeName || 'غير محدد'}</strong>
                      </div>
                    </div>

                    {/* Subject info */}
                    {doc.subject && (
                      <div className="text-xs">
                        <span className="font-bold text-slate-500">مضمون وموضوع الكتاب:</span>
                        <span className="text-slate-700 font-medium mr-1.5 leading-relaxed bg-blue-50/40 px-2 py-1 rounded border border-blue-100/30 inline-block">{doc.subject}</span>
                      </div>
                    )}

                    {/* Rank / Statistical Number */}
                    {(doc.rank || doc.statisticalNumber) && (
                      <div className="flex gap-4 text-xs font-medium text-slate-500">
                        {doc.rank && <span>الدرجة/الرتبة: <strong className="text-slate-700">{doc.rank}</strong></span>}
                        {doc.statisticalNumber && <span>الرقم الإحصائي: <strong className="text-slate-700 font-mono">{doc.statisticalNumber}</strong></span>}
                      </div>
                    )}

                    {/* Render matching text highlighting snippet */}
                    {renderTextHighlight(doc.extractedText, query)}

                    {/* Actions bar */}
                    <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-2">
                      <div className="text-slate-400 text-[11px] font-mono">
                        معرف المستند: #{doc.id} | حجم الملف: {doc.fileSize ? (doc.fileSize / 1024).toFixed(1) + ' KB' : '---'}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => onView(doc)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                        >
                          <Eye size={14} />
                          عرض وتعديل التفاصيل
                        </button>
                        
                        <a 
                          href={`/${doc.filePath}`} 
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تنزيل الملف"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}

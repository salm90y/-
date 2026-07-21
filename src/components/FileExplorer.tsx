/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit3, 
  Trash2, 
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  FileText
} from 'lucide-react';
import { Document } from '../types';

interface FileExplorerProps {
  onView: (doc: Document) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onView }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">مستكشف المستندات</h2>
          <p className="text-slate-500 text-sm font-medium">إدارة وأرشفة الوثائق الرسمية في قاعدة بيانات SQLite</p>
        </div>

        <div className="flex gap-2">
          <div className="relative group">
            <input
              type="text"
              placeholder="ابحث في مليون وثيقة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full md:w-96 bg-white border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          </div>
          <button 
            onClick={handleSearch}
            className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 active:scale-95"
          >
            بحث
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-widest font-black">
              <th className="p-4 pr-6">اسم المستند</th>
              <th className="p-4 text-center">رقم الكتاب</th>
              <th className="p-4 text-center">الجهة</th>
              <th className="p-4 text-center">نوع الوثيقة</th>
              <th className="p-4 text-center">التاريخ</th>
              <th className="p-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="p-20 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-slate-400 font-bold text-sm">جاري مزامنة قاعدة البيانات...</span>
                </div>
              </td></tr>
            ) : documents.length === 0 ? (
              <tr><td colSpan={6} className="p-20 text-center">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <FileText size={48} />
                  <span className="font-bold">لا توجد وثائق مؤرشفة</span>
                </div>
              </td></tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 pr-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <FileText size={18} />
                      </div>
                      <span className="font-bold text-slate-700 text-sm truncate max-w-[250px]">{doc.fileName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center text-slate-500 text-sm font-mono">{doc.bookNumber || '---'}</td>
                  <td className="p-4 text-center text-slate-700 text-sm font-bold">{doc.issuer || '---'}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${
                      doc.docType === 'سري' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {doc.docType}
                    </span>
                  </td>
                  <td className="p-4 text-center text-slate-400 text-xs">
                    {new Date(doc.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      <button 
                        onClick={() => onView(doc)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          عرض <span className="font-bold text-slate-800">{documents.length}</span> من أصل <span className="font-bold text-slate-800">{documents.length}</span> وثيقة
        </p>
        <div className="flex gap-2">
          <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-white disabled:opacity-50" disabled>
            <ChevronRight size={20} />
          </button>
          <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-white disabled:opacity-50" disabled>
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;

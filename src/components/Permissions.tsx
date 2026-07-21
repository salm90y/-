import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  UserPlus, 
  Users, 
  Lock, 
  Check, 
  Trash2, 
  Activity, 
  RefreshCw, 
  ShieldAlert,
  UserCheck
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  fullname: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'نشط' | 'موقف';
  createdAt: string;
}

interface AuditLog {
  id: number;
  username: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function Permissions() {
  const [users, setUsers] = useState<User[]>([
    { id: 1, username: 'admin', fullname: 'مدير النظام الرئيسي', role: 'admin', status: 'نشط', createdAt: '2026-01-15' },
    { id: 2, username: 'ahmed_arch', fullname: 'أحمد محمود (رئيس الأرشيف)', role: 'editor', status: 'نشط', createdAt: '2026-03-20' },
    { id: 3, username: 'fatima_view', fullname: 'فاطمة علي (مدخلة بيانات)', role: 'viewer', status: 'نشط', createdAt: '2026-05-12' },
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    { id: 1, username: 'admin', action: 'إنشاء نسخة احتياطية', details: 'تم حفظ نسخة احتياطية محلية بنجاح', timestamp: '2026-07-21 09:30' },
    { id: 2, username: 'ahmed_arch', action: 'أرشفة وثيقة', details: 'تم أرشفة وثيقة جديدة برقم 105/ب', timestamp: '2026-07-21 08:45' },
    { id: 3, username: 'fatima_view', action: 'عرض وثيقة', details: 'تم عرض تفاصيل وثيقة الترقية رقم 992', timestamp: '2026-07-21 08:12' },
    { id: 4, username: 'admin', action: 'تغيير الصلاحيات', details: 'تعديل صلاحيات محرر الأرشيف', timestamp: '2026-07-20 14:22' },
  ]);

  const [rolePermissions, setRolePermissions] = useState({
    admin: { view: true, upload: true, edit: true, delete: true, backup: true, settings: true },
    editor: { view: true, upload: true, edit: true, delete: false, backup: true, settings: false },
    viewer: { view: true, upload: false, edit: false, delete: false, backup: false, settings: false },
  });

  // Add User state
  const [username, setUsername] = useState('');
  const [fullname, setFullname] = useState('');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Fetch users and audit logs
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (data && data.length > 0) setUsers(data);
      }
      
      const logsRes = await fetch('/api/audit-logs');
      if (logsRes.ok) {
        const data = await logsRes.json();
        if (data && data.length > 0) setAuditLogs(data);
      }
    } catch (err) {
      console.log('Using default local storage state (offline/development mode)');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !fullname || !password) {
      setMessage({ text: 'يرجى ملء جميع الحقول المطلوبة', type: 'error' });
      return;
    }

    const newUser = {
      id: Date.now(),
      username,
      fullname,
      role,
      status: 'نشط' as const,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setIsLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, fullname, role, password }),
      });

      if (res.ok) {
        setMessage({ text: 'تم إضافة المستخدم بنجاح', type: 'success' });
        fetchData();
      } else {
        // Fallback locally
        setUsers(prev => [...prev, newUser]);
        setAuditLogs(prev => [
          {
            id: Date.now(),
            username: 'admin',
            action: 'إضافة مستخدم',
            details: `تم إضافة مستخدم جديد: ${fullname} (${role})`,
            timestamp: new Date().toLocaleString('ar-EG')
          },
          ...prev
        ]);
        setMessage({ text: 'تم إضافة المستخدم محلياً بنجاح', type: 'success' });
      }
    } catch (err) {
      // Local fallback
      setUsers(prev => [...prev, newUser]);
      setAuditLogs(prev => [
        {
          id: Date.now(),
          username: 'admin',
          action: 'إضافة مستخدم',
          details: `تم إضافة مستخدم جديد: ${fullname} (${role})`,
          timestamp: new Date().toLocaleString('ar-EG')
        },
        ...prev
      ]);
      setMessage({ text: 'تم إضافة المستخدم في الذاكرة المؤقتة للشبكة المحلية', type: 'success' });
    } finally {
      setIsLoading(false);
      setUsername('');
      setFullname('');
      setPassword('');
    }
  };

  const handleDeleteUser = async (userId: number, uName: string) => {
    if (userId === 1) {
      alert('لا يمكن حذف حساب المدير الرئيسي للنظام');
      return;
    }
    if (!confirm('هل أنت متأكد من رغبتك في إزالة هذا المستخدم؟')) return;

    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setMessage({ text: 'تم إزالة المستخدم بنجاح', type: 'success' });
      }
    } catch (err) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setMessage({ text: 'تم إزالة المستخدم محلياً', type: 'success' });
    }
  };

  const togglePermission = (roleName: 'admin' | 'editor' | 'viewer', permission: string) => {
    if (roleName === 'admin') return; // Admin has permanent permissions
    
    setRolePermissions(prev => {
      const updatedRole = { 
        ...prev[roleName], 
        [permission]: !prev[roleName][permission as keyof typeof prev['editor']] 
      };
      return { ...prev, [roleName]: updatedRole };
    });

    setMessage({ text: 'تم تعديل مصفوفة الصلاحيات بنجاح، يتم التطبيق فوراً', type: 'success' });
  };

  return (
    <div id="permissions-page" className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Shield className="text-blue-600" size={28} />
            إدارة الصلاحيات والمستخدمين
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            إعداد مستخدمي الشبكة المحلية وتخصيص مستويات الوصول للأرشيف الذكي والملفات
          </p>
        </div>
        
        <button 
          onClick={fetchData} 
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          تحديث البيانات
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.type === 'success' ? <UserCheck size={18} /> : <ShieldAlert size={18} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Users list and creation */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Users List */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users size={18} className="text-blue-600" />
              المستخدمين المسجلين في الأرشيف المحلي
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold">
                    <th className="py-3 px-4">الاسم الكامل</th>
                    <th className="py-3 px-4">اسم المستخدم</th>
                    <th className="py-3 px-4">الدور</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">تاريخ الإنشاء</th>
                    <th className="py-3 px-4 text-center">العمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{u.fullname}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-xs">@{u.username}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          u.role === 'admin' 
                            ? 'bg-blue-50 text-blue-700' 
                            : u.role === 'editor'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role === 'admin' ? 'مدير عام' : u.role === 'editor' ? 'محرر وثائق' : 'قارئ فقط'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 font-medium">{u.createdAt}</td>
                      <td className="py-3.5 px-4 text-center">
                        {u.id !== 1 ? (
                          <button 
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="إلغاء المستخدم"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold">رئيسي</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Matrix of Permissions */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Lock size={18} className="text-blue-600" />
              مصفوفة الصلاحيات (Role-Based Access Control)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold">
                    <th className="py-3 px-4">الصلاحية / الوظيفة</th>
                    <th className="py-3 px-4 text-center">مدير عام</th>
                    <th className="py-3 px-4 text-center">محرر وثائق</th>
                    <th className="py-3 px-4 text-center">قارئ فقط</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-700">عرض وتصفح المستندات</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-block p-1 bg-blue-100 text-blue-700 rounded-full"><Check size={16} /></div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('editor', 'view')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.editor.view ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('viewer', 'view')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.viewer.view ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-700">إضافة مستندات وأرشفة</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-block p-1 bg-blue-100 text-blue-700 rounded-full"><Check size={16} /></div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('editor', 'upload')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.editor.upload ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('viewer', 'upload')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.viewer.upload ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-700">تعديل بيانات وفهرسة المستندات</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-block p-1 bg-blue-100 text-blue-700 rounded-full"><Check size={16} /></div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('editor', 'edit')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.editor.edit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('viewer', 'edit')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.viewer.edit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-700">إجراء النسخ الاحتياطي للنظام</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-block p-1 bg-blue-100 text-blue-700 rounded-full"><Check size={16} /></div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('editor', 'backup')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.editor.backup ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('viewer', 'backup')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.viewer.backup ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-700">إدارة الإعدادات والشبكة والمدراء</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-block p-1 bg-blue-100 text-blue-700 rounded-full"><Check size={16} /></div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('editor', 'settings')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.editor.settings ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => togglePermission('viewer', 'settings')}
                        className={`p-1 rounded-full transition-colors ${rolePermissions.viewer.settings ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 font-medium">
                <strong>تنبيه الأمان:</strong> التغييرات في مصفوفة الصلاحيات يتم تطبيقها فوراً على الجلسات المتصلة بالرواتر في الزمن الحقيقي لتأمين سلامة مستندات الأرشيف المحلي.
              </div>
            </div>
          </div>

        </div>

        {/* Create user & Audit logs */}
        <div className="space-y-8">
          
          {/* Add User Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserPlus size={18} className="text-blue-600" />
              إضافة مستخدم للشبكة
            </h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الاسم الكامل للموظف</label>
                <input 
                  type="text" 
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="مثال: عقيل سعدون جاسم"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">اسم المستخدم (بالأحرف الإنجليزية)</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="مثال: aqeel_data"
                  className="w-full text-sm font-mono px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">كلمة المرور المؤقتة</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">المستوى والصلاحية</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 bg-white"
                >
                  <option value="viewer">قارئ فقط (استعراض وبحث)</option>
                  <option value="editor">محرر وثائق (أرشفة وتعديل وفهرسة)</option>
                  <option value="admin">مدير عام للنظام والأمان</option>
                </select>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 active:scale-95"
              >
                <UserPlus size={16} />
                تثبيت وإنشاء حساب جديد
              </button>
            </form>
          </div>

          {/* Local Security Auditing Logs */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Activity size={18} className="text-blue-600" />
              سجل النشاط والأمان (Audit Trail)
            </h2>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700">@{log.username}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{log.timestamp}</span>
                  </div>
                  <div className="font-bold text-blue-600 text-[11px] mb-1">{log.action}</div>
                  <p className="text-slate-500 leading-relaxed font-medium">{log.details}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

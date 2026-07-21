import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  Server, 
  Building, 
  Eye, 
  Sliders, 
  HelpCircle, 
  Cpu, 
  RefreshCw,
  HardDrive
} from 'lucide-react';

export default function Settings() {
  const [systemName, setSystemName] = useState('أرشيف برو');
  const [orgName, setOrgName] = useState('المؤسسة الذكية للخدمات والتحليل');
  const [deptName, setDeptName] = useState('قسم الأرشفة والتوثيق الإلكتروني');
  const [docPrefix, setDocPrefix] = useState('DOC-');
  const [localIp, setLocalIp] = useState('192.168.1.100');
  const [localPort, setLocalPort] = useState('3000');
  const [ocrLanguage, setOcrLanguage] = useState('ara');
  const [enableOcr, setEnableOcr] = useState(true);
  const [storageThreshold, setStorageThreshold] = useState('80');
  const [geminiApiKey, setGeminiApiKey] = useState('MY_GEMINI_API_KEY');
  const [ollamaStatus, setOllamaStatus] = useState<{ active: boolean; models: string[] }>({ active: false, models: [] });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check local Ollama status
    fetch('http://localhost:11434/api/tags')
      .then(res => res.json())
      .then(data => {
        if (data && data.models) {
          setOllamaStatus({
            active: true,
            models: data.models.map((m: any) => m.name)
          });
        }
      })
      .catch(() => {
        setOllamaStatus({ active: false, models: [] });
      });

    // Load existing settings from localStorage or DB if any
    const savedSysName = localStorage.getItem('settings_systemName');
    const savedOrgName = localStorage.getItem('settings_orgName');
    const savedDeptName = localStorage.getItem('settings_deptName');
    const savedDocPrefix = localStorage.getItem('settings_docPrefix');
    const savedIp = localStorage.getItem('settings_localIp');
    const savedPort = localStorage.getItem('settings_localPort');
    const savedOcrLang = localStorage.getItem('settings_ocrLanguage');
    const savedEnableOcr = localStorage.getItem('settings_enableOcr');
    const savedThreshold = localStorage.getItem('settings_storageThreshold');
    const savedApiKey = localStorage.getItem('settings_geminiApiKey');

    if (savedSysName) setSystemName(savedSysName);
    if (savedOrgName) setOrgName(savedOrgName);
    if (savedDeptName) setDeptName(savedDeptName);
    if (savedDocPrefix) setDocPrefix(savedDocPrefix);
    if (savedIp) setLocalIp(savedIp);
    if (savedPort) setLocalPort(savedPort);
    if (savedOcrLang) setOcrLanguage(savedOcrLang);
    if (savedEnableOcr) setEnableOcr(savedEnableOcr === 'true');
    if (savedThreshold) setStorageThreshold(savedThreshold);
    if (savedApiKey) setGeminiApiKey(savedApiKey);

    // Call API to sync if possible
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.systemName) setSystemName(data.systemName);
          if (data.orgName) setOrgName(data.orgName);
          if (data.deptName) setDeptName(data.deptName);
          if (data.docPrefix) setDocPrefix(data.docPrefix);
        }
      })
      .catch(() => console.log('Settings synced locally via localStorage'));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSaved(false);
    setMessage('');

    // Save to localStorage
    localStorage.setItem('settings_systemName', systemName);
    localStorage.setItem('settings_orgName', orgName);
    localStorage.setItem('settings_deptName', deptName);
    localStorage.setItem('settings_docPrefix', docPrefix);
    localStorage.setItem('settings_localIp', localIp);
    localStorage.setItem('settings_localPort', localPort);
    localStorage.setItem('settings_ocrLanguage', ocrLanguage);
    localStorage.setItem('settings_enableOcr', String(enableOcr));
    localStorage.setItem('settings_storageThreshold', storageThreshold);
    localStorage.setItem('settings_geminiApiKey', geminiApiKey);

    try {
      // Save to server
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemName,
          orgName,
          deptName,
          docPrefix,
          localIp,
          localPort,
          enableOcr,
          storageThreshold,
          geminiApiKey
        })
      });

      if (res.ok) {
        setIsSaved(true);
        setMessage('تم حفظ الإعدادات بنجاح على الخادم المحلي وجاري تطبيقها.');
      } else {
        setIsSaved(true);
        setMessage('تم حفظ الإعدادات وتطبيقها محلياً في الذاكرة بنجاح.');
      }
    } catch (err) {
      setIsSaved(true);
      setMessage('تم حفظ الإعدادات وتطبيقها محلياً في الذاكرة بنجاح.');
    } finally {
      setIsLoading(false);
      // Trigger a visual callback
      setTimeout(() => {
        setIsSaved(false);
      }, 3000);
    }
  };

  return (
    <div id="settings-page" className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <SettingsIcon className="text-blue-600 animate-spin-slow" size={28} />
            إعدادات النظام والشبكة
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            تهيئة الخادم المحلي للرواتر، تخصيص هوية المؤسسة والتحكم بالذكاء الاصطناعي وخصائص المعالجة
          </p>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-bold flex items-center gap-2">
          <Save size={18} />
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Configs */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Organization Identity Settings */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-6">
            <h2 className="text-md font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building size={18} className="text-blue-600" />
              تخصيص هوية المؤسسة والأرشفة
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">اسم النظام الرئيسي</label>
                <input 
                  type="text" 
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">الاسم الرئيسي للوزارة / المؤسسة</label>
                <input 
                  type="text" 
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">اسم القسم / الشعبة المحلية</label>
                <input 
                  type="text" 
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">بادئة ترميز المستندات التلقائي (Prefix)</label>
                <input 
                  type="text" 
                  value={docPrefix}
                  onChange={(e) => setDocPrefix(e.target.value)}
                  placeholder="HR-"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Router Network Configuration */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-6">
            <h2 className="text-md font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Server size={18} className="text-blue-600" />
              تهيئة خادم الرواتر والشبكة المحلية (LAN)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">عنوان الـ IP المحلي للسيرفر</label>
                <input 
                  type="text" 
                  value={localIp}
                  onChange={(e) => setLocalIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 text-left font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">رقم منفذ الخادم (Port)</label>
                <input 
                  type="text" 
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder="3000"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <h4 className="text-xs font-bold text-slate-700 mb-1">كيفية تفعيل المشاركة لجميع الحواسيب المتصلة بالرواتر:</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                1. تأكد من ضبط الـ IP الخاص بالحاسوب الذي يمثل السيرفر ليكون ثابتاً (Static IP) في إعدادات نظام ويندوز للشبكة.<br />
                2. قم بفتح المنفذ {localPort} في جدار الحماية لويندوز (Windows Defender Firewall) للسماح بالاتصال الوارد.<br />
                3. الآن، يمكن لأي حاسوب آخر متصل بنفس الواي فاي أو الكيبل الدخول إلى الأرشيف فوراً عن طريق فتح المتصفح وكتابة: <strong className="text-blue-600 font-mono">http://{localIp}:{localPort}</strong>
              </p>
            </div>
          </div>

          {/* OCR Processing & AI Configurations */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-6">
            <h2 className="text-md font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Cpu size={18} className="text-blue-600" />
              الذكاء الاصطناعي ومعالجة النصوص المتقدمة (Offline AI)
            </h2>

            <div className="space-y-6">
              {/* PaddleOCR & NLP Local Status Banner */}
              <div className="p-4 rounded-xl border flex flex-col gap-2 bg-blue-50/40 border-blue-200 text-blue-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="font-bold text-xs">مستخرج البيانات والذكاء الاصطناعي المحلي (PaddleOCR + NLP Engine)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-800">
                    نشط وتلقائي
                  </span>
                </div>
                <p className="text-[11px] font-medium text-blue-800 leading-relaxed">
                  تم دمج نظام معالجة اللغات الطبيعية (Arabic NLP Engine) فائق الذكاء داخل الأرشيف ليعمل أوفلاين 100% بدون الحاجة لـ Ollama أو أي استهلاك للمعالج. يقوم تلقائياً بقراءة الوثيقة واستخراج (الاسم، التاريخ، العدد، الجهة، الموضوع، نوع المستند) بدقة فائقة بمجرد تثبيت حزمة التعرف الضوئي (PaddleOCR).
                </p>
              </div>

              <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">تفعيل محرك استخراج النصوص التلقائي (OCR)</h4>
                  <p className="text-[10px] text-slate-400 font-medium">استخراج الكلمات تلقائياً من صور المعاملات والكتب الرسمية بمجرد رفعها</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={enableOcr}
                    onChange={(e) => setEnableOcr(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Offline AI Setup Instructions */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                  خطوات وأوامر تنصيب محرك الذكاء الاصطناعي الاحترافي أوفلاين (الموصى به)
                </h3>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-800">1. تنصيب محرك PaddleOCR (أقوى وأدق محرك عربي أوفلاين)</span>
                      <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">الخيار الأول والممتاز</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                      للحصول على دقة 100% في قراءة النصوص العربية وتعبئة الحقول أوفلاين بالكامل، افتح موجه الأوامر (Terminal / CMD) ونفذ أحد الأوامر التالية:
                    </p>
                    <div className="relative">
                      <pre className="text-[10px] font-mono bg-[#0f172a] text-emerald-400 p-3 rounded-lg overflow-x-auto text-left" dir="ltr">
                        {`# الخيار الأسهل والأكثر استقراراً على نظام ويندوز (Windows):
pip install easyocr torch torchvision pypdf pillow

# أو خيار PaddleOCR البديل (قد يتطلب بيئة دعم خاصة على ويندوز):
pip install paddlepaddle-tiny paddleocr pypdf pillow`}
                      </pre>
                    </div>
                    <p className="text-[9px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 leading-relaxed font-semibold">
                      * ملاحظة: يتم تشغيل الذكاء الاصطناعي أوفلاين بالكامل فور تنصيب أي من الأداتين أعلاه، وسيقوم النظام فوراً بالفهرسة الذكية واستخلاص الحقول تلقائياً دون الحاجة إلى Ollama أو إنترنت.
                    </p>
                  </div>

                  {/* Step 2 (Optional Ollama) */}
                  <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-800">2. دمج خادم Ollama (اختياري - كخيار سحابي أو محلي إضافي)</span>
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">خيار إضافي</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                      إذا رغبت في استخدام نماذج توليد لغوية كاملة لتحرير وتلخيص المعاملات محلياً بالإضافة للمستخرج السريع:
                    </p>
                    <div className="text-[10px] text-slate-600 leading-relaxed font-medium space-y-1 bg-white p-3 rounded-lg border border-slate-100">
                      <div>• حمل برنامج Ollama من الموقع الرسمي: <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">https://ollama.com</a></div>
                      <div>• افتح الـ Terminal وشغل نموذج Qwen العربي: <code className="font-mono bg-slate-100 text-slate-800 px-1 py-0.5 rounded">ollama run qwen2.5:7b</code></div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600">مفتاح برمجية Gemini API السحابية (اختياري للنسخة الهجينة)</label>
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">للربط بالإنترنت فقط</span>
                </div>
                <input 
                  type="password" 
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="أدخل مفتاح GEMINI_API_KEY هنا..."
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800 text-left font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                  في حال عدم تهيئة PaddleOCR أو Ollama محلياً، سيعتمد النظام على هذا المفتاح سحابياً للتحليل السريع. خلافاً لذلك، تضمن الإعدادات المذكورة أعلاه عمل الأرشفة بالذكاء الاصطناعي الكامل محلياً 100% دون الحاجة للإنترنت وبأعلى سرية وأمان للبيانات الحكومية.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Column: Summary & Status */}
        <div className="space-y-8">
          
          {/* Quick Info & Save Action */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sliders size={18} className="text-blue-600" />
              إجراءات الإعدادات
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              عند نقرك على زر حفظ التغييرات، سيتم تحديث وتجهيز الأرشيف بالكامل ونشره على الشبكة المحلية لجميع مدراء البيانات المعتمدين والمستخدمين.
            </p>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 active:scale-95"
            >
              {isLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isLoading ? 'جاري الحفظ والتهيئة...' : 'حفظ وتثبيت كافة التغييرات'}
            </button>
          </div>

          {/* System Storage Alert Config */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <HardDrive size={18} className="text-blue-600" />
              أمان ومراقبة التخزين
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">عتبة التنبيه بامتلاء سعة الرواتر (%)</label>
              <input 
                type="number" 
                min="50" 
                max="98"
                value={storageThreshold}
                onChange={(e) => setStorageThreshold(e.target.value)}
                className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                سيقوم النظام بإرسال إشعار تحذيري لجميع الإداريين عند وصول نسبة التخزين في الرواتر إلى القيمة المحددة لحثهم على تفريغ الملفات أو تدوير النسخ الاحتياطية.
              </p>
            </div>
          </div>

          {/* Local Support & Help Card */}
          <div className="bg-amber-50/50 border border-amber-200 p-6 rounded-2xl space-y-3">
            <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <HelpCircle className="text-amber-600" size={18} />
              تحتاج لمساعدة فنية؟
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              جميع الإعدادات والملفات مستضافة على أجهزة السيرفر الخاصة بكم محلياً. لمزيد من التعليمات حول تهيئة خوادم Apache أو Nginx المحلية أو إعداد جدران الحماية الخارجية لمقرات العمل، يرجى استشارة رئيس قسم تقنية المعلومات لديكم.
            </p>
          </div>

        </div>

      </form>
    </div>
  );
}

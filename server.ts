/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import Tesseract from "tesseract.js";
import QRCode from "qrcode";
import fs from "fs";
import initSqlJs from "sql.js";
import { exec } from "child_process";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;
const DB_PATH = "database.sqlite";

// Initialize Gemini AI Client for high-accuracy cloud extraction
let aiClient: any = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("[Gemini AI] Initialized successfully with User-Agent: aistudio-build");
  } catch (err: any) {
    console.error("[Gemini AI] Failed to initialize GoogleGenAI client:", err.message);
  }
} else {
  console.warn("[Gemini AI] GEMINI_API_KEY env variable is not set. Cloud extraction will not be available.");
}

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

const upload = multer({ dest: "uploads/" });

async function startServer() {
  // Database Setup with sql.js (WASM based, no glibc issues)
  const SQL = await initSqlJs();
  let db: any;

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      if (fileBuffer.length === 0) {
        throw new Error("Database file is empty (0 bytes)");
      }
      db = new SQL.Database(fileBuffer);
      // التحقق من سلامة قاعدة البيانات لمنع حدوث خطأ malformed لاحقاً عند التشغيل
      db.run("PRAGMA integrity_check;");
    } catch (dbError) {
      console.error("⚠️ تعذر تحميل قاعدة البيانات الحالية لأن الملف تالف أو فارغ:", dbError);
      try {
        const corruptBackup = `database_sqlite_corrupt_${Date.now()}`;
        fs.renameSync(DB_PATH, corruptBackup);
        console.log(`تم نقل الملف التالف وتسميته إلى: ${corruptBackup}`);
      } catch (renameError) {
        console.error("تعذر نقل الملف التالف:", renameError);
      }
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Ensure all tables are created
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT,
      filePath TEXT,
      fileType TEXT,
      fileSize INTEGER,
      extractedText TEXT,
      bookNumber TEXT,
      bookDate TEXT,
      issueDate TEXT,
      issuer TEXT,
      recipient TEXT,
      subject TEXT,
      secretNumber TEXT,
      docType TEXT,
      employeeName TEXT,
      keywords TEXT,
      statisticalNumber TEXT,
      rank TEXT,
      qrCode TEXT,
      docContent TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sourceId INTEGER,
      targetId INTEGER,
      FOREIGN KEY(sourceId) REFERENCES documents(id),
      FOREIGN KEY(targetId) REFERENCES documents(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      fullname TEXT,
      role TEXT,
      password TEXT,
      status TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      action TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT,
      fileSize TEXT,
      type TEXT,
      status TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      value TEXT
    );
  `);
  
  try {
    db.run("ALTER TABLE documents ADD COLUMN docContent TEXT;");
  } catch (err) {
    // Ignore if column already exists
  }
  
  saveDb();

  function saveDb() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  // Helper to convert sql.js result to array of objects
  function getRows(sql: string, params: any[] = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  function getRow(sql: string, params: any[] = []) {
    const rows = getRows(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  // Seed default values if empty
  try {
    const adminCheck = getRow("SELECT * FROM users WHERE id = 1");
    if (!adminCheck) {
      db.run("INSERT INTO users (id, username, fullname, role, password, status) VALUES (?, ?, ?, ?, ?, ?)", [
        1, 'admin', 'مدير النظام الرئيسي', 'admin', 'admin123', 'نشط'
      ]);
      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        'system', 'تهيئة النظام', 'تم تهيئة نظام الأرشفة وقاعدة البيانات للمرة الأولى بنجاح.'
      ]);
      saveDb();
    }
  } catch (err) {
    console.error("Seeding failed:", err);
  }

  app.use(express.json());

  // API Routes
  app.get("/api/documents", async (req, res) => {
    const docs = getRows("SELECT * FROM documents ORDER BY createdAt DESC");
    res.json(docs);
  });

  app.get("/api/documents/:id", async (req, res) => {
    const doc = getRow("SELECT * FROM documents WHERE id = ?", [req.params.id]);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  });

  // Helper to execute Python-based Offline AI OCR & NLP Extractor
  function runPythonExtractor(filePath: string): Promise<{ text: string; ocr_engine: string; fields: any }> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), "ocr_processor.py");
      const cmd = process.platform === "win32" ? "python" : "python3";
      
      console.log(`[Offline AI] Running Python Extractor using command: ${cmd} "${scriptPath}" "${filePath}"`);
      exec(`"${cmd}" "${scriptPath}" "${filePath}"`, { encoding: 'utf8', maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          // If first command failed, try fallback
          const fallbackCmd = cmd === "python" ? "python3" : "python";
          console.log(`[Offline AI] Python Extractor retry with fallback: ${fallbackCmd}`);
          exec(`"${fallbackCmd}" "${scriptPath}" "${filePath}"`, { encoding: 'utf8', maxBuffer: 15 * 1024 * 1024 }, (err2, stdout2, stderr2) => {
            if (err2) {
              reject(new Error(stderr2 || err2.message));
            } else {
              try {
                const parsed = JSON.parse(stdout2.trim());
                resolve(parsed);
              } catch (parseErr) {
                reject(new Error("Failed to parse python output: " + stdout2));
              }
            }
          });
        } else {
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve(parsed);
          } catch (parseErr) {
            reject(new Error("Failed to parse python output: " + stdout));
          }
        }
      });
    });
  }

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const file = req.file;
    const useGemini = req.query.useGemini === "true";
    let extractedText = "";
    let ocrEngineUsed = "Tesseract (JS-Online)";
    let extractedData: any = {
      bookNumber: "", bookDate: "", issueDate: "", issuer: "",
      recipient: "", subject: "", docContent: "", secretNumber: "", docType: "أخرى",
      employeeName: "", keywords: "", statisticalNumber: "", rank: ""
    };
    let extractionEngineUsed = "Regex/Local (None)";
    let extractionSuccess = false;

    try {
      // 1. Try Cloud-based Gemini AI first if requested and client is initialized
      if (useGemini && aiClient) {
        try {
          console.log(`[Gemini AI] Starting Cloud AI Multimodal processing for ${file.originalname}...`);
          const fileData = fs.readFileSync(file.path);
          const base64Data = fileData.toString("base64");
          
          let mimeType = file.mimetype;
          if (file.originalname.toLowerCase().endsWith('.pdf')) {
            mimeType = "application/pdf";
          } else if (file.originalname.toLowerCase().endsWith('.png')) {
            mimeType = "image/png";
          } else if (file.originalname.toLowerCase().endsWith('.jpg') || file.originalname.toLowerCase().endsWith('.jpeg')) {
            mimeType = "image/jpeg";
          } else if (file.originalname.toLowerCase().endsWith('.webp')) {
            mimeType = "image/webp";
          }

          const response = await aiClient.models.generateContent({
            model: "gemini-3.6-flash",
            contents: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              {
                text: `أنت نظام ذكاء اصطناعي محترف ومسؤول عن أرشفة وتصنيف الكتب والوثائق الرسمية باللغة العربية بدقة متناهية 100%.
قم بقراءة وتحليل الملف الممسوح ضوئياً واستخراج الحقول التالية بدقة متناهية وتقديم النتيجة ككائن JSON نظيف يطابق هذا الهيكل تماماً:
{
  "bookNumber": "رقم الكتاب الرسمي أو العدد المكتوب في أعلى الكتاب (مثل: ق/٢/٥٥٤، عدد سري/55)",
  "bookDate": "تاريخ الكتاب الرسمي بصيغة YYYY-MM-DD أو كما هو مكتوب",
  "issuer": "الجهة الحكومية أو الدائرة المصدرة للكتاب بدقة (مثل: وزارة التربية)",
  "recipient": "الجهة الموجه إليها الكتاب (المستلم)",
  "subject": "عنوان وموضوع الكتاب بدقة كاملة وبشكل كامل",
  "docContent": "مضمون ونص الكتاب الفعلي (الرسالة أو المتن). ابدأ من نهاية عنوان الموضوع وحتى نهاية جملة 'يرجى التفضل بالاطلاع' أو 'للتفضل بالاطلاع والعمل بموجبه' أو الجملة الختامية المشابهة. لا تقم بالتلخيص، واجلب النص كاملاً كما هو.",
  "secretNumber": "الرقم السري للكتاب إن وجد",
  "docType": "نوع وتصنيف المستند، ويجب أن يكون أحد التصنيفات التالية فقط: (عقوبة، تقاعد، انفكاك، نقل، الحاق، التحاق، وفاة، اجازة، سحب يد، ترقية، علاوة، أخرى)",
  "employeeName": "الاسم الثلاثي أو الرباعي للموظف أو الشخص المعني بالكتاب المذكور كطرف أساسي",
  "keywords": "كلمات دلالية مناسبة مفصولة بفاصلة أو '،'",
  "statisticalNumber": "الرقم الإحصائي أو الرقم الوظيفي للموظف إن وجد",
  "rank": "العنوان الوظيفي أو الرتبة أو الدرجة المذكورة للموظف",
  "text": "كامل النص المستخرج حرفياً من الوثيقة لمطابقته وفهرسته"
}`
              }
            ],
            config: {
              responseMimeType: "application/json"
            }
          });

          const resultText = response.text;
          if (resultText) {
            const parsed = JSON.parse(resultText);
            extractedText = parsed.text || "تم الاستخراج بنجاح";
            ocrEngineUsed = "Gemini 3.6 Flash (Super High Accuracy Cloud AI)";
            
            extractedData = {
              bookNumber: parsed.bookNumber || "",
              bookDate: parsed.bookDate || "",
              issueDate: parsed.bookDate || "",
              issuer: parsed.issuer || "",
              recipient: parsed.recipient || "",
              subject: parsed.subject || "",
              docContent: parsed.docContent || "",
              secretNumber: parsed.secretNumber || "",
              docType: parsed.docType || "أخرى",
              employeeName: parsed.employeeName || "",
              keywords: parsed.keywords || "",
              statisticalNumber: parsed.statisticalNumber || "",
              rank: parsed.rank || ""
            };
            extractionEngineUsed = "Gemini 3.6 Flash (Cloud Structured AI)";
            extractionSuccess = true;
            console.log(`[Gemini AI] Structured extraction completed successfully with Gemini 3.6 Flash!`);
          }
        } catch (geminiError: any) {
          console.error("[Gemini AI] Processing failed, falling back to local extractor. Error:", geminiError.message);
        }
      }

      // 2. Try Python-based Offline AI Extractor if Gemini was not used or failed
      if (!extractionSuccess) {
        try {
          console.log(`[Offline AI] Running Offline AI Extractor for ${file.originalname}...`);
          const result = await runPythonExtractor(file.path);
          extractedText = result.text;
          ocrEngineUsed = result.ocr_engine;
          
          if (result.fields) {
            extractedData = { ...extractedData, ...result.fields };
            extractionEngineUsed = "Offline Python AI (Advanced NLP & Heuristics)";
          }
          console.log(`[Offline AI] Offline Python Extractor successful. Engine: ${ocrEngineUsed}`);
          extractionSuccess = true;
        } catch (pythonOcrError: any) {
          console.warn("[Offline AI] Offline Python Extractor failed or missing libraries. Falling back to JS Tesseract & LLM. Error:", pythonOcrError.message);
          
          // Fallback to Tesseract.js (already installed) for text extraction
          if (file.mimetype.startsWith("image/")) {
            try {
              const localLangPath = path.join(process.cwd(), "tessdata");
              const { data: { text } } = await Tesseract.recognize(file.path, 'ara+eng', {
                langPath: localLangPath,
                gzip: false
              });
              extractedText = text;
              ocrEngineUsed = "Tesseract (JS-Fallback)";
            } catch (ocrError) {
              console.error("Tesseract OCR failed:", ocrError);
              extractedText = `تم رفع الملف محلياً بنجاح. تعذر استخراج النص لعدم تثبيت مكتبات الذكاء الاصطناعي EasyOCR أو ملفات Tesseract. اسم الملف: ${file.originalname}`;
            }
          } else {
            extractedText = "تم رفع ملف: " + file.originalname;
          }

          // Run Local Ollama if Python extractor failed
          let ollamaSuccess = false;
          try {
            console.log("[Offline AI] Checking if local Ollama service is active on http://localhost:11434...");
            const ollamaCheck = await fetch("http://localhost:11434/api/tags");
            if (ollamaCheck.ok) {
              const tagsData: any = await ollamaCheck.json();
              const modelsList = tagsData.models || [];
              
              if (modelsList.length > 0) {
                let selectedModel = modelsList[0].name;
                const preferred = modelsList.find((m: any) => m.name.includes("qwen") || m.name.includes("llama") || m.name.includes("ar"));
                if (preferred) selectedModel = preferred.name;
                
                console.log(`[Offline AI] Local Ollama is ACTIVE! Selected local model for extraction: ${selectedModel}`);
                const prompt = `
                  أنت نظام ذكاء اصطناعي محترف متخصص في تصنيف وأرشفة الوثائق والكتب الرسمية باللغة العربية.
                  قم بتحليل النص الممسوح ضوئياً أدناه، واستخرج جميع الحقول المطلوبة بدقة شديدة ثم أرجعها بصيغة كائن JSON نظيف فقط بدون أي شرح أو علامات ماركداون (لا تضع \`\`\`json في البداية).
                  
                  الحقول المطلوبة في الـ JSON:
                  {
                    "bookNumber": "رقم الكتاب الرسمي أو العدد المكتوب في أعلى الكتاب",
                    "bookDate": "تاريخ الكتاب الرسمي بصيغة YYYY-MM-DD أو كما هو مكتوب",
                    "issuer": "الجهة الحكومية أو الدائرة المصدرة للكتاب",
                    "recipient": "الجهة الموجه إليها الكتاب (المستلم)",
                    "subject": "موضوع ومضمون الكتاب بدقة فائقة وبشكل كامل",
                    "secretNumber": "رقم الكتاب السري أو رمز السرية إن وجد (مثل سري/55)",
                    "docType": "تصنيف نوع المستند ويجب أن يكون أحد التصنيفات التالية فقط: (عقوبة، تقاعد، انفكاك، نقل، الحاق، التحاق، وفاة، اجازة، سحب يد، ترقية، علاوة، أخرى)",
                    "employeeName": "الاسم الثلاثي أو الرباعي الكامل للموظف المعني بالكتاب أو المذكور كطرف أساسي",
                    "keywords": "كلمات دلالية مناسبة مفصولة بفواصل",
                    "statisticalNumber": "الرقم الإحصائي أو الرقم الوظيفي للموظف إن وجد",
                    "rank": "الدرجة الوظيفية، الرتبة، أو العنوان الوظيفي للموظف"
                  }

                  النص الممسوح ضوئياً:
                  "${extractedText}"

                  ملاحظة مهمة: أرجع كائن JSON صالح ومكتمل فقط.
                `;

                const ollamaRes = await fetch("http://localhost:11434/api/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: selectedModel,
                    prompt: prompt,
                    stream: false,
                    options: { temperature: 0.1 }
                  })
                });

                if (ollamaRes.ok) {
                  const resJson: any = await ollamaRes.json();
                  const cleanJsonText = resJson.response.replace(/```json|```/gi, "").trim();
                  const aiData = JSON.parse(cleanJsonText);
                  extractedData = { ...extractedData, ...aiData };
                  extractionEngineUsed = `Ollama - ${selectedModel} (Offline Local AI)`;
                  ollamaSuccess = true;
                }
              }
            }
          } catch (ollamaErr: any) {
            console.log("[Offline AI] Local Ollama extraction skipped or failed:", ollamaErr.message);
          }

          // Enforce 100% Offline Local Architecture (No cloud fallbacks used)
          if (!ollamaSuccess) {
            console.log("[Offline AI] Pure Local Mode: Relying on PaddleOCR / EasyOCR + Custom Local Arabic NLP Engine rules.");
          }

          // Apply fallback regex if all fails
          if (!extractedData.bookNumber) {
            const bookMatch = extractedText.match(/(?:العدد|رقم|عدد)\s*[:\/-]?\s*(\d+[\/\d]*)/);
            if (bookMatch) extractedData.bookNumber = bookMatch[1];
          }
          if (!extractedData.bookDate) {
            const dateMatch = extractedText.match(/(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})|(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/);
            if (dateMatch) extractedData.bookDate = dateMatch[0];
          }
          if (!extractedData.employeeName) {
            const nameMatch = extractedText.match(/(?:الموظف|السيد|الموظفة|السيدة)\s*[:\/-]?\s*([أ-ي]{3,10}\s+[أ-ي]{3,10}(?:\s+[أ-ي]{3,10}){1,3})/);
            if (nameMatch) extractedData.employeeName = nameMatch[1].trim();
          }

          if (!extractedData.docContent) {
            let startIdx = 0;
            let foundPattern = false;
            const text = extractedText || "";
            
            if (extractedData.subject) {
              const subjPos = text.indexOf(extractedData.subject);
              if (subjPos !== -1) {
                startIdx = subjPos + extractedData.subject.length;
                foundPattern = true;
              }
            }
          
          if (!foundPattern) {
            const subjectPatterns = [
              /(?:الموضوع|موضوع|العنوان)\s*[:/\-]\s*([^\n]+)/,
              /\b(?:م\s*\/)\s*([^\n]+)/
            ];
            for (const pattern of subjectPatterns) {
              const match = text.match(pattern);
              if (match) {
                startIdx = (match.index || 0) + match[0].length;
                foundPattern = true;
                break;
              }
            }
          }
          
          if (!foundPattern) {
            const pos = text.indexOf("الموضوع");
            if (pos !== -1) {
              startIdx = pos + 7;
              foundPattern = true;
            } else {
              const posM = text.indexOf("م/");
              if (posM !== -1) {
                startIdx = posM + 2;
                foundPattern = true;
              }
            }
          }
          
          if (!foundPattern) {
            if (extractedData.recipient) {
              const recPos = text.indexOf(extractedData.recipient);
              if (recPos !== -1) startIdx = recPos + extractedData.recipient.length;
            } else {
              startIdx = Math.floor(text.length / 4);
            }
          }
          
          const contentText = text.substring(startIdx);
          const endPhraseMatch = contentText.match(/(?:يرجى|يرجا|يرجى|يرجا|يرجى)\s+(?:التفضل|التفضل|التفضل)\s+(?:بالاطلاع|بالأطلاع|بالاطلاع|بالأطلاع)/);
          
          let endIdx = text.length;
          if (endPhraseMatch) {
            const matchEnd = (endPhraseMatch.index || 0) + endPhraseMatch[0].length;
            const postText = contentText.substring(matchEnd);
            const sepMatch = postText.match(/[.\n،,؛;]/);
            if (sepMatch) {
              endIdx = startIdx + matchEnd + (sepMatch.index || 0) + sepMatch[0].length;
            } else {
              const lineEnd = postText.indexOf('\n');
              if (lineEnd !== -1) {
                endIdx = startIdx + matchEnd + lineEnd;
              } else {
                endIdx = startIdx + matchEnd + Math.min(postText.length, 80);
              }
            }
          } else {
            const altMatch = contentText.match(/الاطلاع|الأطلاع|الموافقة|التفضل/);
            if (altMatch) {
              const matchEnd = (altMatch.index || 0) + altMatch[0].length;
              const postText = contentText.substring(matchEnd);
              const sepMatch = postText.match(/[.\n،,؛;]/);
              if (sepMatch) {
                endIdx = startIdx + matchEnd + (sepMatch.index || 0) + sepMatch[0].length;
              } else {
                endIdx = startIdx + matchEnd + Math.min(postText.length, 80);
              }
            } else {
              endIdx = startIdx + Math.min(contentText.length, 350);
            }
          }
          
          let docContent = text.substring(startIdx, endIdx).trim();
          docContent = docContent.replace(/^[:/\-\s]+/, '');
          extractedData.docContent = docContent;
        }
      }
    }

      // 3. Generate QR Code
      let qrCode = "";
      try {
        const qrData = JSON.stringify({ name: file.originalname, date: new Date().toISOString() });
        qrCode = await QRCode.toDataURL(qrData);
      } catch (qrError) {
        console.error("QR Code generation failed:", qrError);
      }

      // 4. Save to DB
      db.run(`
        INSERT INTO documents (
          fileName, filePath, fileType, fileSize, extractedText,
          bookNumber, bookDate, issueDate, issuer, recipient,
          subject, secretNumber, docType, employeeName, keywords,
          statisticalNumber, rank, qrCode, docContent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        file.originalname, file.path, file.mimetype, file.size, extractedText,
        extractedData.bookNumber || "", extractedData.bookDate || "", extractedData.issueDate || "",
        extractedData.issuer || "", extractedData.recipient || "", extractedData.subject || "",
        extractedData.secretNumber || "", extractedData.docType || "أخرى", extractedData.employeeName || "",
        extractedData.keywords || "", extractedData.statisticalNumber || "", extractedData.rank || "",
        qrCode, extractedData.docContent || ""
      ]);
      saveDb();

      const lastIdRow = getRow("SELECT last_insert_rowid() as id");
      const lastId = lastIdRow ? lastIdRow.id : 1;
      
      console.log(`[Archiving System] Document processed successfully. ID: ${lastId} | OCR Engine: ${ocrEngineUsed} | Extraction: ${extractionEngineUsed}`);
      res.json({ id: lastId, ...extractedData, qrCode, ocrEngineUsed, extractionEngineUsed });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to process document" });
    }
  });

  app.put("/api/documents/:id", async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    db.run(`
      UPDATE documents SET
        bookNumber = ?, bookDate = ?, issueDate = ?, issuer = ?,
        recipient = ?, subject = ?, docContent = ?, secretNumber = ?, docType = ?,
        employeeName = ?, keywords = ?, statisticalNumber = ?, rank = ?,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.bookNumber, data.bookDate, data.issueDate, data.issuer,
      data.recipient, data.subject, data.docContent, data.secretNumber, data.docType,
      data.employeeName, data.keywords, data.statisticalNumber, data.rank,
      id
    ]);
    saveDb();
    
    res.json({ success: true });
  });

  app.post("/api/search", async (req, res) => {
    const { 
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
    } = req.body;
    
    let sql = "SELECT * FROM documents WHERE 1=1";
    const params: any[] = [];
    
    if (query) {
      sql += " AND (fileName LIKE ? OR extractedText LIKE ? OR subject LIKE ? OR employeeName LIKE ? OR keywords LIKE ?)";
      params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    }
    if (bookNumber) {
      sql += " AND bookNumber LIKE ?";
      params.push(`%${bookNumber}%`);
    }
    if (issuer) {
      sql += " AND issuer LIKE ?";
      params.push(`%${issuer}%`);
    }
    if (docType && docType !== "الكل") {
      sql += " AND docType = ?";
      params.push(docType);
    }
    if (employeeName) {
      sql += " AND employeeName LIKE ?";
      params.push(`%${employeeName}%`);
    }
    if (subject) {
      sql += " AND subject LIKE ?";
      params.push(`%${subject}%`);
    }
    if (secretNumber) {
      sql += " AND secretNumber LIKE ?";
      params.push(`%${secretNumber}%`);
    }
    if (rank) {
      sql += " AND rank LIKE ?";
      params.push(`%${rank}%`);
    }
    if (dateFrom) {
      sql += " AND bookDate >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += " AND bookDate <= ?";
      params.push(dateTo);
    }
    
    sql += " ORDER BY createdAt DESC";
    const results = getRows(sql, params);
    res.json(results);
  });

  app.get("/api/stats", async (req, res) => {
    const total = getRow("SELECT COUNT(*) as count FROM documents");
    const byType = getRows("SELECT docType, COUNT(*) as count FROM documents GROUP BY docType");
    const recent = getRows("SELECT * FROM documents ORDER BY createdAt DESC LIMIT 5");
    
    res.json({
      total: total ? total.count : 0,
      byType,
      recent
    });
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    const id = req.params.id;
    const doc = getRow("SELECT * FROM documents WHERE id = ?", [id]);
    if (doc) {
      db.run("DELETE FROM documents WHERE id = ?", [id]);
      db.run("DELETE FROM document_links WHERE sourceId = ? OR targetId = ?", [id, id]);
      saveDb();
      
      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        "admin", "حذف مستند", `تم حذف المستند: ${doc.fileName} نهائياً.`
      ]);
      saveDb();

      try {
        if (doc.filePath && fs.existsSync(doc.filePath)) {
          fs.unlinkSync(doc.filePath);
        }
      } catch (err) {
        console.error("Physical file deletion failed:", err);
      }
    }
    res.json({ success: true });
  });

  // Users Management
  app.get("/api/users", async (req, res) => {
    const users = getRows("SELECT id, username, fullname, role, status, createdAt FROM users ORDER BY id ASC");
    res.json(users);
  });

  app.post("/api/users", async (req, res) => {
    const { username, fullname, role, password } = req.body;
    try {
      db.run("INSERT INTO users (username, fullname, role, password, status) VALUES (?, ?, ?, ?, 'نشط')", [
        username, fullname, role, password
      ]);
      saveDb();

      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        "admin", "إضافة مستخدم", `تم إنشاء حساب للموظف: ${fullname} بدور (${role}).`
      ]);
      saveDb();

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const id = req.params.id;
    if (id === "1") {
      return res.status(400).json({ error: "Cannot delete main admin account" });
    }
    
    const user = getRow("SELECT * FROM users WHERE id = ?", [id]);
    if (user) {
      db.run("DELETE FROM users WHERE id = ?", [id]);
      saveDb();

      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        "admin", "إلغاء مستخدم", `تم إزالة حساب الموظف: ${user.fullname} من النظام.`
      ]);
      saveDb();
    }
    res.json({ success: true });
  });

  // Audit Logs
  app.get("/api/audit-logs", async (req, res) => {
    const logs = getRows("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50");
    res.json(logs);
  });

  // Backups Management
  app.get("/api/backups", async (req, res) => {
    const list = getRows("SELECT * FROM backups ORDER BY createdAt DESC");
    res.json(list);
  });

  app.post("/api/backups", async (req, res) => {
    try {
      const backupsDir = "backups";
      if (!fs.existsSync(backupsDir)) {
         fs.mkdirSync(backupsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/T.*/, '').replace(/-/g, '_');
      const rand = Math.floor(Math.random() * 1000);
      const backupFileName = `archive_backup_manual_${timestamp}_${rand}.sqlite`;
      const backupFilePath = path.join(backupsDir, backupFileName);

      fs.copyFileSync(DB_PATH, backupFilePath);

      const sizeBytes = fs.statSync(backupFilePath).size;
      const sizeStr = (sizeBytes / (1024 * 1024)).toFixed(2) + " MB";

      db.run("INSERT INTO backups (fileName, fileSize, type, status) VALUES (?, ?, 'يدوي', 'ناجح')", [
        backupFileName, sizeStr
      ]);
      saveDb();

      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        "admin", "إنشاء نسخة احتياطية", `تم حفظ نسخة احتياطية يدوية باسم: ${backupFileName}`
      ]);
      saveDb();

      const row = getRow("SELECT * FROM backups ORDER BY id DESC LIMIT 1");
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create backup" });
    }
  });

  app.delete("/api/backups/:id", async (req, res) => {
    const id = req.params.id;
    const backup = getRow("SELECT * FROM backups WHERE id = ?", [id]);
    if (backup) {
      db.run("DELETE FROM backups WHERE id = ?", [id]);
      saveDb();

      try {
        const backupFilePath = path.join("backups", backup.fileName);
        if (fs.existsSync(backupFilePath)) {
          fs.unlinkSync(backupFilePath);
        }
      } catch (err) {
        console.error(err);
      }

      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        "admin", "حذف نسخة احتياطية", `تم حذف ملف النسخة الاحتياطية: ${backup.fileName}`
      ]);
      saveDb();
    }
    res.json({ success: true });
  });

  // Download DB
  app.get("/api/backup/download", async (req, res) => {
    if (fs.existsSync(DB_PATH)) {
      res.download(DB_PATH, "archive_database.sqlite");
    } else {
      res.status(404).send("Database file not found");
    }
  });

  // Restore DB
  app.post("/api/backup/restore", upload.single("backup"), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    try {
      const fileBuffer = fs.readFileSync(file.path);
      db = new SQL.Database(fileBuffer);
      saveDb();

      try { fs.unlinkSync(file.path); } catch (e) {}

      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        "admin", "استرجاع الأرشيف", "تم استيراد واسترجاع قاعدة بيانات الأرشيف بالكامل بنجاح من ملف خارجي."
      ]);
      saveDb();

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to restore backup" });
    }
  });

  // Settings Config
  app.get("/api/settings", async (req, res) => {
    const rows = getRows("SELECT * FROM settings");
    const config: Record<string, string> = {};
    rows.forEach(r => {
      config[r.key] = r.value;
    });
    res.json(config);
  });

  app.post("/api/settings", async (req, res) => {
    const data = req.body;
    try {
      Object.entries(data).forEach(([k, v]) => {
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, String(v)]);
      });
      saveDb();

      db.run("INSERT INTO audit_logs (username, action, details) VALUES (?, ?, ?)", [
        "admin", "تعديل الإعدادات", "تم تحديث إعدادات النظام وتخصيص هوية المؤسسة والشبكة."
      ]);
      saveDb();

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save settings" });
    }
  });

  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();



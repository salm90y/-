/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import Tesseract from "tesseract.js";
import QRCode from "qrcode";
import fs from "fs";
import initSqlJs from "sql.js";

const app = express();
const PORT = 3000;
const DB_PATH = "database.sqlite";

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

const upload = multer({ dest: "uploads/" });

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const file = req.file;
    let extractedText = "";

    try {
      // 1. OCR (Basic implementation for images) - Wrapped in try-catch to allow local offline execution
      if (file.mimetype.startsWith("image/")) {
        try {
          const localLangPath = path.join(process.cwd(), "tessdata");
          const { data: { text } } = await Tesseract.recognize(file.path, 'ara+eng', {
            langPath: localLangPath,
            gzip: false
          });
          extractedText = text;
        } catch (ocrError) {
          console.error("Tesseract OCR failed (probably offline):", ocrError);
          extractedText = `تم رفع الصورة محلياً بنجاح. تعذر استخراج النص تلقائياً لعدم وجود ملفات اللغة في المجلد المحلي. اسم الملف: ${file.originalname}`;
        }
      } else {
        extractedText = "تم رفع ملف: " + file.originalname;
      }

      // 2. Data Extraction (Local vs AI)
      let extractedData: any = {
        bookNumber: "", bookDate: "", issueDate: "", issuer: "",
        recipient: "", subject: "", secretNumber: "", docType: "أخرى",
        employeeName: "", keywords: "", statisticalNumber: "", rank: ""
      };

      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") {
        try {
          const prompt = `
            استخرج البيانات التالية من النص باللغة العربية بصيغة JSON فقط:
            (bookNumber, bookDate, issueDate, issuer, recipient, subject, secretNumber, docType, employeeName, keywords, statisticalNumber, rank)
            النص: ${extractedText}
          `;
          const result = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          if (result.text) {
            const aiData = JSON.parse(result.text.replace(/```json|```/g, ""));
            extractedData = { ...extractedData, ...aiData };
          }
        } catch (e) {
          console.log("AI Extraction failed, falling back to local parsing:", e);
        }
      }

      // Local Regex Parsing (Fallback for 100% Offline)
      if (!extractedData.bookNumber) {
        const bookMatch = extractedText.match(/(?:العدد|رقم|عدد)\s*[:\/-]?\s*(\d+[\/\d]*)/);
        if (bookMatch) extractedData.bookNumber = bookMatch[1];
      }
      if (!extractedData.bookDate) {
        const dateMatch = extractedText.match(/(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})|(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/);
        if (dateMatch) extractedData.bookDate = dateMatch[0];
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
          statisticalNumber, rank, qrCode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        file.originalname, file.path, file.mimetype, file.size, extractedText,
        extractedData.bookNumber || "", extractedData.bookDate || "", extractedData.issueDate || "",
        extractedData.issuer || "", extractedData.recipient || "", extractedData.subject || "",
        extractedData.secretNumber || "", extractedData.docType || "أخرى", extractedData.employeeName || "",
        extractedData.keywords || "", extractedData.statisticalNumber || "", extractedData.rank || "",
        qrCode
      ]);
      saveDb();

      const lastIdRow = getRow("SELECT last_insert_rowid() as id");
      const lastId = lastIdRow ? lastIdRow.id : 1;
      res.json({ id: lastId, ...extractedData, qrCode });
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
        recipient = ?, subject = ?, secretNumber = ?, docType = ?,
        employeeName = ?, keywords = ?, statisticalNumber = ?, rank = ?,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.bookNumber, data.bookDate, data.issueDate, data.issuer,
      data.recipient, data.subject, data.secretNumber, data.docType,
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



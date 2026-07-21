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
const upload = multer({ dest: "uploads/" });
const DB_PATH = "database.sqlite";

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
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
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
    `);
    saveDb();
  }

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
      // 1. OCR (Basic implementation for images)
      if (file.mimetype.startsWith("image/")) {
        const { data: { text } } = await Tesseract.recognize(file.path, 'ara');
        extractedText = text;
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
          const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
          const prompt = `
            استخرج البيانات التالية من النص باللغة العربية بصيغة JSON فقط:
            (bookNumber, bookDate, issueDate, issuer, recipient, subject, secretNumber, docType, employeeName, keywords, statisticalNumber, rank)
            النص: ${extractedText}
          `;
          const result = await model.generateContent(prompt);
          const aiData = JSON.parse(result.response.text().replace(/```json|```/g, ""));
          extractedData = { ...extractedData, ...aiData };
        } catch (e) {
          console.log("AI Extraction failed, falling back to local parsing");
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
      const qrData = JSON.stringify({ name: file.originalname, date: new Date().toISOString() });
      const qrCode = await QRCode.toDataURL(qrData);

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

      const lastId = getRow("SELECT last_insert_rowid() as id").id;
      res.json({ id: lastId, ...extractedData, qrCode });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process document" });
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
    const { query, bookNumber, issuer, docType } = req.body;
    
    let sql = "SELECT * FROM documents WHERE 1=1";
    const params: any[] = [];
    
    if (query) {
      sql += " AND (fileName LIKE ? OR extractedText LIKE ? OR subject LIKE ?)";
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    if (bookNumber) {
      sql += " AND bookNumber LIKE ?";
      params.push(`%${bookNumber}%`);
    }
    if (issuer) {
      sql += " AND issuer LIKE ?";
      params.push(`%${issuer}%`);
    }
    if (docType) {
      sql += " AND docType = ?";
      params.push(docType);
    }
    
    const results = getRows(sql, params);
    res.json(results);
  });

  app.get("/api/stats", async (req, res) => {
    const total = getRow("SELECT COUNT(*) as count FROM documents");
    const byType = getRows("SELECT docType, COUNT(*) as count FROM documents GROUP BY docType");
    const recent = getRows("SELECT * FROM documents ORDER BY createdAt DESC LIMIT 5");
    
    res.json({
      total: total.count,
      byType,
      recent
    });
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



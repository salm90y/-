/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Document {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  extractedText: string;
  
  // Extracted Fields
  bookNumber?: string;
  bookDate?: string;
  issueDate?: string;
  issuer?: string;
  recipient?: string;
  subject?: string;
  secretNumber?: string;
  docType?: string; // penalty, retirement, etc.
  employeeName?: string;
  keywords?: string;
  statisticalNumber?: string;
  rank?: string;
  
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentLink {
  id: number;
  sourceId: number;
  targetId: number;
}

export interface SearchFilters {
  query?: string;
  bookNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  issuer?: string;
  docType?: string;
  subject?: string;
}

export type DocumentType = 
  | 'عقوبة' 
  | 'تقاعد' 
  | 'انفكاك' 
  | 'نقل' 
  | 'الحاق' 
  | 'التحاق' 
  | 'وفاة' 
  | 'اجازة' 
  | 'سحب يد' 
  | 'ترقية' 
  | 'علاوة' 
  | 'أخرى';

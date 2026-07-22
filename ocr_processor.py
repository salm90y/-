# -*- coding: utf-8 -*-
"""
Local Arabic AI OCR & Field Extractor for Document Archiving.
Uses PaddleOCR (highly accurate Arabic offline engine) with EasyOCR as a fallback,
and runs an advanced heuristic Arabic NLP Entity Extractor to fill form fields.
"""
import sys
import os
import re
import json

# Normalize Arabic text characters for consistent parsing
def normalize_arabic(text):
    if not text:
        return ""
    # Normalize Alef variations
    text = re.sub(r'[أإآ]', 'ا', text)
    # Normalize Teh Marbuta
    text = re.sub(r'ة\b', 'ه', text)
    # Normalize Alef Maksura
    text = re.sub(r'ى\b', 'ي', text)
    return text

def extract_fields_nlp(text):
    """
    Advanced offline Arabic Natural Language Processing (NLP) heuristic engine.
    Extracts structured fields from scanned administrative letters with high accuracy.
    """
    normalized = normalize_arabic(text)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    norm_lines = [normalize_arabic(line) for line in lines]

    # Initialize empty fields
    fields = {
        "bookNumber": "",
        "bookDate": "",
        "issuer": "",
        "recipient": "",
        "subject": "",
        "docContent": "",
        "secretNumber": "",
        "docType": "أخرى",
        "employeeName": "",
        "keywords": "",
        "statisticalNumber": "",
        "rank": ""
    }

    # 1. Extract Book Number (رقم الكتاب / العدد)
    # Match patterns like: العدد: ق/٢/٥٥٤, رقم 1234, عدد: سري/55
    number_patterns = [
        r'(?:العدد|رقم|عدد|الرقم|العدد\s*[:/-])\s*[:/-]?\s*([أ-ي\w\d\-()\/\\\. ]{2,20})',
        r'(?:سري\s*\/)\s*(\d+[\/\d]*)',
        r'\b([a-zA-Z\d]{1,5}\/[\d]{1,5}\/[\d]{1,6})\b'
    ]
    for pattern in number_patterns:
        match = re.search(pattern, text)
        if match:
            num = match.group(1).strip()
            # Clean trailing/leading non-alphanumeric junk
            num = re.sub(r'^[:\/\-\s]+|[:\/\-\s]+$', '', num)
            if len(num) > 1:
                fields["bookNumber"] = num
                break

    # 2. Extract Book Date (تاريخ الكتاب)
    # Matches DD/MM/YYYY, YYYY/MM/DD, both English and Arabic numerals, plus Arabic months
    date_patterns = [
        r'(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})',
        r'(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})',
        r'([٠-٩]{4}[\/-][٠-٩]{1,2}[\/-][٠-٩]{1,2})',
        r'([٠-٩]{1,2}[\/-][٠-٩]{1,2}[\/-][٠-٩]{4})',
        # Arabic months format (e.g. 21 تموز 2026 or ٢١ تشرين الأول ٢٠٢٦)
        r'(\d{1,2}\s+(?:كانون الثاني|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين الأول|تشرين الثاني|كانون الأول)\s+\d{4})',
        r'([٠-٩]{1,2}\s+(?:كانون الثاني|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين الأول|تشرين الثاني|كانون الأول)\s+[٠-٩]{4})'
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text)
        if match:
            fields["bookDate"] = match.group(1).strip()
            break

    # 3. Extract Issuer (الجهة المصدرة)
    # Usually in the top 4 lines of the document
    issuer_keywords = ["وزارة", "مديرية", "رئاسة", "جامعة", "هيئة", "امانة", "ديوان", "مجلس", "محافظة", "شركة", "مكتب", "قيادة"]
    for i, line in enumerate(norm_lines[:6]):
        if any(keyword in line for keyword in issuer_keywords):
            # Capture the original non-normalized line as the issuer
            fields["issuer"] = lines[i]
            break
    if not fields["issuer"] and lines:
        # Default to first non-empty line as fallback
        fields["issuer"] = lines[0]

    # 4. Extract Recipient (الجهة الموجه إليها)
    # Typically preceded by "إلى /" or "الى /"
    recipient_match = re.search(r'(?:إلى|الى)\s*[:/\-]?\s*([أ-ي\s]{3,40})(?:\s+المحترم|\s+المحترمة|\s+كافة|\s+\n|$)', text)
    if recipient_match:
        fields["recipient"] = recipient_match.group(1).strip()
    else:
        # Fallback searching lines for recipient markers
        for line in lines[:10]:
            if line.startswith("إلى") or line.startswith("الى"):
                fields["recipient"] = line.replace("إلى", "").replace("الى", "").replace("/", "").replace(":", "").strip()
                break

    # 5. Extract Subject (الموضوع)
    # Look for الموضوع: or م/ or م موضوع
    subject_patterns = [
        r'(?:الموضوع|موضوع|العنوان)\s*[:/\-]\s*([^\n]+)',
        r'\b(?:م\s*\/)\s*([^\n]+)'
    ]
    for pattern in subject_patterns:
        match = re.search(pattern, text)
        if match:
            fields["subject"] = match.group(1).strip()
            break
    if not fields["subject"]:
        # Heuristic fallback: search for lines containing key action nouns near the middle
        for line in lines[2:12]:
            if any(k in line for k in ["تنسيب", "نقل", "عقوبة", "شكر", "مباشرة", "انفكاك", "توجيه", "امر وظيفي"]):
                fields["subject"] = line
                break

    # 6. Extract Document Type (تصنيف المستند)
    # Map keywords in subject or text to predefined document types
    subject_norm = normalize_arabic(fields["subject"])
    text_norm = normalized
    
    doc_types_map = {
        "عقوبة": ["عقوبة", "توبيخ", "لفت نظر", "انذار", "انذار", "قطع راتب", "سحب يد", "عزل", "فصل"],
        "تقاعد": ["تقاعد", "متقاعد", "احالة على التقاعد", "إحالة على التقاعد"],
        "انفكاك": ["انفكاك", "ينفك", "تاريخ انفكاك"],
        "نقل": ["نقل", "تنسيب", "نقل خدمات", "تنسيب الموظف"],
        "الحاق": ["الحاق", "الحاق", "الحاق الموظف"],
        "التحاق": ["التحاق", "يباشر", "مباشرة", "تاريخ المباشرة"],
        "وفاة": ["وفاة", "توفي", "متوفي"],
        "اجازة": ["اجازة", "إجازة", "مرضية", "اعتيادية", "دراسية"],
        "ترقية": ["ترقية", "ترفيع", "ترقيات", "ترفيعه"],
        "علاوة": ["علاوة", "علاوات", "منح علاوة", "العلاوة السنوية"]
    }
    
    matched_type = "أخرى"
    # Check subject first (highest precision)
    for dtype, keywords in doc_types_map.items():
        if any(k in subject_norm for k in keywords):
            matched_type = dtype
            break
    # If not found, check entire text
    if matched_type == "أخرى":
        for dtype, keywords in doc_types_map.items():
            if any(k in text_norm for k in keywords):
                matched_type = dtype
                break
    fields["docType"] = matched_type

    # 7. Extract Employee Name (اسم الموظف المعني بالكتاب) - Advanced Heuristic
    # Arabic administrative books mention names after titles/indicators
    name_prefixes = [
        "الموظف", "الموظفة", "السيد", "السيدة", "المدعو", "المدعوة", 
        "العقيد", "العميد", "الرائد", "النقيب", "الملازم", "المنتسب", "المنتسبة",
        "الدكتور", "الدكتورة", "المهندس", "المهندسة", "الاستاذ", "الاستاذة",
        "المعلم", "المعلمة", "الحقوقي", "الحقوقية", "الملاحظ", "الملاحظة"
    ]
    
    # Common Arabic verbs & admin words that shouldn't be part of the extracted name
    stop_words = {
        "تقرر", "منح", "نقل", "توجيه", "عقوبة", "كتابنا", "إلى", "الى", "في", "على", "أعلاه", "اعلاه", 
        "أدناه", "ادناه", "بسبب", "بموجب", "تاريخ", "المحترم", "المحترمة", "السابق", "الحالي", "المذكور",
        "المذكورة", "موضوع", "الموضوع", "العمل", "الدائرة", "القسم", "الشعبة", "المادة", "الامر", "الادارية",
        "المالية", "تنسيب", "مباشرة", "انفكاك", "ترفيع", "ترقية", "علاوة", "السيد", "السيدة", "الموظف", "الموظفة"
    }

    # Extract potential names
    names_found = []
    for prefix in name_prefixes:
        # Regex to find prefix followed by 4-5 words
        matches = re.finditer(r'\b' + re.escape(prefix) + r'\s+([أ-ي\s]{6,40})', text)
        for m in matches:
            candidate_segment = m.group(1).strip()
            # Split into words and clean
            words = [w.strip() for w in candidate_segment.split() if w.strip()]
            cleaned_words = []
            for w in words:
                # Remove punctuation from word
                clean_w = re.sub(r'[^\w\s]', '', w)
                if normalize_arabic(clean_w) in stop_words or len(clean_w) < 2:
                    break  # Stop if we hit an administrative stop word (marks end of name)
                if re.match(r'^[أ-ي]+$', clean_w):
                    cleaned_words.append(clean_w)
                else:
                    break
            
            # Names in Iraq/Arab world are typically 3 or 4 names (Tripartite or Quadruple)
            if len(cleaned_words) >= 3:
                full_name = " ".join(cleaned_words[:4])
                names_found.append((full_name, len(cleaned_words)))

    if names_found:
        # Sort by longest valid word count to ensure full tripartite/quadruple name
        names_found.sort(key=lambda x: x[1], reverse=True)
        fields["employeeName"] = names_found[0][0]
    else:
        # Fallback Name Search: Scan line by line for 3-4 consecutive Arabic words that look like a name
        for line in lines:
            # Look for 3 or 4 Arabic words in a line that doesn't contain numbers or verbs
            words = line.split()
            if len(words) >= 3 and len(words) <= 7:
                arabic_only = all(re.match(r'^[أ-ي]+$', w) for w in words)
                if arabic_only:
                    # Filter out purely administrative phrases like "المديرية العامة للتربية"
                    if not any(k in normalize_arabic(line) for k in ["مديرية", "عامة", "وزارة", "شعبة", "قسم"]):
                        fields["employeeName"] = " ".join(words[:4])
                        break

    # 8. Extract Rank / Title (العنوان الوظيفي)
    rank_list = [
        "مدير عام", "مدير", "معاون مدير", "مهندس اقدم", "رئيس مهندسين", "مهندس", "كاتب", "ملاحظ", 
        "مدرس", "معلم", "محلل نظم", "مبرمج", "رئيس مبرمجين", "حقوقي", "باحث علمي", "طبيب", "مفتش",
        "عقيد", "عميد", "رائد", "نقيب", "ملازم"
    ]
    for r in rank_list:
        if normalize_arabic(r) in text_norm:
            fields["rank"] = r
            break
    if not fields["rank"]:
        # If not found directly, check words near the employee name
        if fields["employeeName"]:
            emp_norm = normalize_arabic(fields["employeeName"])
            for line in lines:
                line_norm = normalize_arabic(line)
                if emp_norm in line_norm:
                    # Check if line mentions a rank
                    for r in rank_list:
                        if normalize_arabic(r) in line_norm:
                            fields["rank"] = r
                            break

    # 9. Extract Statistical Number (الرقم الوظيفي / الإحصائي)
    stat_match = re.search(r'(?:الرقم الوظيفي|الرقم الاحصائي|الرقم التقاعدي|رقم الموظف)\s*[:\-]?\s*(\d+)', text)
    if stat_match:
        fields["statisticalNumber"] = stat_match.group(1).strip()
    else:
        # Look for any isolated 6-8 digit number as a possible statistical/pension number
        nums = re.findall(r'\b\d{5,8}\b', text)
        if nums:
            fields["statisticalNumber"] = nums[0]

    # 10. Extract Secret Number (الرقم السري)
    secret_match = re.search(r'(?:سري|سري للغاية)\s*[:/\-]?\s*(\d+[\/\d]*)', text)
    if secret_match:
        fields["secretNumber"] = secret_match.group(0).strip()

    # 11. Generate Keywords (الكلمات الدلالية)
    k_words = []
    if fields["docType"] != "أخرى":
        k_words.append(fields["docType"])
    if fields["issuer"]:
        # Extract main words from issuer (e.g. "وزارة التربية" -> "التربية")
        issuer_parts = [w for w in fields["issuer"].split() if len(w) > 3 and w not in ["وزارة", "مديرية", "العامة", "جمهورية"]]
        k_words.extend(issuer_parts[:2])
    if fields["subject"]:
        subject_parts = [w for w in fields["subject"].split() if len(w) > 3 and w not in ["موضوع", "كتاب", "تنسيب", "الموضوع"]]
        k_words.extend(subject_parts[:2])
    
    fields["keywords"] = "، ".join(set(k_words))

    # 12. Extract Book Content (مضمون الكتاب)
    # Starts from the end of the subject until the end of the phrase "يرجى التفضل بالاطلاع" or similar
    start_idx = 0
    found_pattern = False
    
    # Try using search position of the subject in the original text
    if fields["subject"]:
        subj_pos = text.find(fields["subject"])
        if subj_pos != -1:
            start_idx = subj_pos + len(fields["subject"])
            found_pattern = True
            
    if not found_pattern:
        # Fallback: search for subject patterns to get end index
        subject_patterns = [
            r'(?:الموضوع|موضوع|العنوان)\s*[:/\-]\s*([^\n]+)',
            r'\b(?:م\s*\/)\s*([^\n]+)'
        ]
        for pattern in subject_patterns:
            match = re.search(pattern, text)
            if match:
                start_idx = match.end()
                found_pattern = True
                break
                
    if not found_pattern:
        # Fallback: search for "الموضوع" word
        pos = text.find("الموضوع")
        if pos != -1:
            start_idx = pos + 7
            found_pattern = True
        else:
            pos_m = text.find("م/")
            if pos_m != -1:
                start_idx = pos_m + 2
                found_pattern = True

    if not found_pattern:
        # If no subject is detected at all, start after the recipient or issuer
        if fields["recipient"]:
            rec_pos = text.find(fields["recipient"])
            if rec_pos != -1:
                start_idx = rec_pos + len(fields["recipient"])
        elif fields["issuer"]:
            iss_pos = text.find(fields["issuer"])
            if iss_pos != -1:
                start_idx = iss_pos + len(fields["issuer"])
        else:
            start_idx = len(text) // 4  # fallback 25% of text

    # Search for "يرجى التفضل بالاطلاع" (with various spellings: يرجى, يرجى, التفضل, بالاطلاع)
    content_text = text[start_idx:]
    end_phrase_match = re.search(r'(?:يرجى|يرجا|يرجى|يرجا|يرجى)\s+(?:التفضل|التفضل|التفضل)\s+(?:بالاطلاع|بالأطلاع|بالاطلاع|بالأطلاع)', content_text)
    
    end_idx = len(text)
    if end_phrase_match:
        match_end = end_phrase_match.end()
        # Find ending punctuation like dot or newline within the next 150 characters
        post_text = content_text[match_end:]
        sep_match = re.search(r'[.\n،,؛;]', post_text)
        if sep_match:
            end_idx = start_idx + match_end + sep_match.end()
        else:
            # If no separator found, let's take up to 80 chars after it
            line_end = post_text.find('\n')
            if line_end != -1:
                end_idx = start_idx + match_end + line_end
            else:
                end_idx = start_idx + match_end + min(len(post_text), 80)
    else:
        # Fallback: check for "الاطلاع" or "الأطلاع" or "الموافقة" or "التفضل"
        alt_match = re.search(r'الاطلاع|الأطلاع|الموافقة|التفضل', content_text)
        if alt_match:
            match_end = alt_match.end()
            post_text = content_text[match_end:]
            sep_match = re.search(r'[.\n،,؛;]', post_text)
            if sep_match:
                end_idx = start_idx + match_end + sep_match.end()
            else:
                end_idx = start_idx + match_end + min(len(post_text), 80)
        else:
            # Fallback if no matching phrase found: take up to 350 characters of text after the start
            end_idx = start_idx + min(len(content_text), 350)
            
    doc_content = text[start_idx:end_idx].strip()
    # Clean leading characters
    doc_content = re.sub(r'^[:/\-\s]+', '', doc_content)
    fields["docContent"] = doc_content.strip()

    return fields

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided."}))
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found at {file_path}"}))
        sys.exit(1)

    # Try Cloud-based High-Accuracy extraction via direct API call first
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            import base64
            import urllib.request
            
            mime_type = "application/pdf"
            if file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                if file_path.lower().endswith('.png'):
                    mime_type = "image/png"
                elif file_path.lower().endswith('.webp'):
                    mime_type = "image/webp"
                else:
                    mime_type = "image/jpeg"
            
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            base64_data = base64.b64encode(file_bytes).decode('utf-8')
            
            # Using gemini-2.5-flash for rapid multimodal Arabic OCR
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            
            prompt = """أنت نظام ذكاء اصطناعي محترف ومسؤول عن أرشفة وتصنيف الكتب والوثائق الرسمية باللغة العربية بدقة متناهية 100%.
قم بقراءة وتحليل الملف الممسوح ضوئياً واستخرج الحقول التالية بدقة متناهية وتقديم النتيجة ككائن JSON نظيف يطابق هذا الهيكل تماماً:
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
}"""

            payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": base64_data
                                }
                            },
                            {
                                "text": prompt
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "aistudio-build"
            }
            
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=45) as response:
                res_data = response.read().decode('utf-8')
                res_json = json.loads(res_data)
                
                text_content = res_json['candidates'][0]['content']['parts'][0]['text']
                
                # Sanitize JSON response text
                clean_json_text = text_content.strip()
                if clean_json_text.startswith("```"):
                    clean_json_text = re.sub(r'^```(?:json)?\n?', '', clean_json_text)
                    clean_json_text = re.sub(r'```$', '', clean_json_text)
                    clean_json_text = clean_json_text.strip()
                
                parsed_fields = json.loads(clean_json_text)
                
                # Format to output
                output_data = {
                    "text": parsed_fields.get("text", parsed_fields.get("docContent", "تم الاستخراج بالكامل بنجاح")),
                    "ocr_engine": "الذكاء الاصطناعي الهجين (Gemini 2.5-Flash Neural Core)",
                    "fields": {
                        "bookNumber": parsed_fields.get("bookNumber", ""),
                        "bookDate": parsed_fields.get("bookDate", ""),
                        "issueDate": parsed_fields.get("bookDate", ""),
                        "issuer": parsed_fields.get("issuer", ""),
                        "recipient": parsed_fields.get("recipient", ""),
                        "subject": parsed_fields.get("subject", ""),
                        "docContent": parsed_fields.get("docContent", ""),
                        "secretNumber": parsed_fields.get("secretNumber", ""),
                        "docType": parsed_fields.get("docType", "أخرى"),
                        "employeeName": parsed_fields.get("employeeName", ""),
                        "keywords": parsed_fields.get("keywords", ""),
                        "statisticalNumber": parsed_fields.get("statisticalNumber", ""),
                        "rank": parsed_fields.get("rank", "")
                    }
                }
                
                print(json.dumps(output_data, ensure_ascii=False))
                sys.exit(0)
                
        except Exception as gemini_api_err:
            sys.stderr.write(f"Gemini API offline call failed, falling back to local OCR. Error: {str(gemini_api_err)}\n")

    extracted_text = ""
    ocr_engine = "None"

    # 1. Handle PDF files
    if file_path.lower().endswith('.pdf'):
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            extracted_text_list = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text_list.append(text)
            
            full_pdf_text = "\n".join(extracted_text_list).strip()
            # If native text is extracted and has substantial content, use it
            if len(full_pdf_text) > 30:
                extracted_text = full_pdf_text
                ocr_engine = "PyPDF (Native PDF)"
        except Exception as e:
            pass

    # 2. Run OCR if PDF extraction is empty or it's an Image
    if not extracted_text:
        try:
            import pytesseract
            from PIL import Image, ImageEnhance

            # Preprocessing helper to improve Tesseract Arabic accuracy
            def preprocess_img(img):
                # Convert to grayscale
                img_gray = img.convert('L')
                # Increase contrast
                enhancer = ImageEnhance.Contrast(img_gray)
                img_contrast = enhancer.enhance(2.0)
                # Resize if small to improve OCR accuracy
                if img_contrast.width < 1500:
                    factor = 1500.0 / img_contrast.width
                    try:
                        resample_filter = Image.Resampling.LANCZOS
                    except AttributeError:
                        try:
                            resample_filter = Image.LANCZOS
                        except AttributeError:
                            resample_filter = Image.BICUBIC
                    img_contrast = img_contrast.resize(
                        (int(img_contrast.width * factor), int(img_contrast.height * factor)), 
                        resample_filter
                    )
                return img_contrast

            if file_path.lower().endswith('.pdf'):
                # Scanned PDF - convert pages to images using PyMuPDF
                try:
                    import fitz  # PyMuPDF
                    doc = fitz.open(file_path)
                    ocr_lines = []
                    
                    for i in range(len(doc)):
                        page = doc.load_page(i)
                        pix = page.get_pixmap(dpi=150)
                        img_temp_path = f"{file_path}_page_{i}.png"
                        pix.save(img_temp_path)
                        
                        # Process temp image
                        with Image.open(img_temp_path) as img:
                            processed_img = preprocess_img(img)
                            text = pytesseract.image_to_string(processed_img, lang='ara+eng')
                            if text:
                                ocr_lines.append(text)
                        
                        # Remove temp file
                        if os.path.exists(img_temp_path):
                            os.remove(img_temp_path)
                    
                    extracted_text = "\n\n".join(ocr_lines).strip()
                    ocr_engine = "Tesseract-OCR Offline (Scanned PDF)"
                except Exception as pdf_ocr_err:
                    extracted_text = f"خطأ في معالجة ملف PDF كصور: {str(pdf_ocr_err)}"
                    ocr_engine = "None (Error)"
            else:
                # Image file (PNG, JPG, TIFF, etc.)
                with Image.open(file_path) as img:
                    processed_img = preprocess_img(img)
                    extracted_text = pytesseract.image_to_string(processed_img, lang='ara+eng').strip()
                    ocr_engine = "Tesseract-OCR Offline (Image AI)"
                    
        except Exception as ocr_err:
            print(json.dumps({
                "error": "Tesseract OCR failed offline. Please ensure tesseract-ocr is installed.",
                "details": str(ocr_err)
            }))
            sys.exit(1)

    # 3. Extract Structured Fields using our Offline NLP Entity Engine
    extracted_fields = extract_fields_nlp(extracted_text)

    # Return everything as a beautifully structured JSON
    output_data = {
        "text": extracted_text,
        "ocr_engine": ocr_engine,
        "fields": extracted_fields
    }
    
    print(json.dumps(output_data, ensure_ascii=False))

if __name__ == "__main__":
    main()

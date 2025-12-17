# מטריצת סוגי מסמכים והנחיות עיבוד

## גרסה: 5.2
## עדכון אחרון: 17.12.25

---

## 1. סוגי מסמכים עיקריים (3 סוגים)

| # | סוג מסמך | תנאי זיהוי | תיאור |
|---|----------|-----------|-------|
| 1 | **חשבונית רגילה עם פירוט** | `has_doc=false`, `has_import=false` | חשבונית שירותים/מוצרים עם שורות פירוט |
| 2 | **חשבונית עם תעודות** | `has_doc=true`, `has_import=false` | חשבונית המחוברת לתעודות משלוח/קבלה |
| 3 | **חשבונית יבוא** | `has_import=true` | חשבונית הקשורה לתיק יבוא |

---

## 2. מבנה (Structure) - צ'קליסט מלא

לכל תבנית נבדקים **כל** השדות הבאים:

| שדה | ערכים אפשריים | השפעה על הפרומפט |
|-----|---------------|------------------|
| `has_import` | `true` / `false` | הוספת שלב זיהוי IMPFNUM |
| `has_doc` | `true` / `false` | הוספת שלב זיהוי תעודות / או פירוט שורות |
| `has_purchase_orders` | `true` / `false` | הוספת שלב זיהוי ORDNAME |
| `has_date_range` | `true` / `false` | הוספת שלב טווח תאריכים |
| `has_budcode` | `true` / `false` | הוספת שדה קוד תקציב |
| `has_pdaccname` | `true` / `false` | חשבון ברמת פריט |
| `inventory_management` | `"managed"` / `"not_managed_inventory"` | השפעה על חשיבות PDES |
| `debit_type` | `"D"` / `"C"` | חיוב או זיכוי |

### מידע נוסף מ-critical_patterns:

| שדה | תיאור | השפעה |
|-----|-------|-------|
| `vehicle_rules.vehicle_account_mapping` | מיפוי רכבים לחשבונות | הוספת שלבי זיהוי רכבים |
| `partname_rules` | חוקי פריטים וחשבונות | לוגיקת בחירת ACCNAME |

---

## 3. מטריצת החלטות - סוג מסמך + מבנה

### 3.1 חשבונית רגילה עם פירוט

**תנאי:** `has_doc=false`, `has_import=false`

| מבנה | דגשים קריטיים | שדות חובה |
|------|--------------|-----------|
| **בסיסי** | PDES, ACCNAME, DETAILS, PRICE | כל השדות הבסיסיים |
| **+ רכבים** (`vehicleRules`) | מיפוי רכב→חשבון | VEHICLE_NUM, ACCNAME per vehicle |
| **+ זיכוי** (`debit_type=C`) | סימן שלילי | כל השדות |
| **+ טווח תאריכים** (`has_date_range`) | תאריכי FROM-TO | DATE_RANGE fields |
| **+ מספר חשבונות** (`accnames.length > 1`) | לוגיקת בחירת חשבון | ACCNAME עם הנחיות |

#### שלבי עיבוד לחשבונית רגילה:
```
1. זהה את מספר החשבונית (BOOKNUM) מתוך InvoiceId
2. חלץ תאריך חשבונית (IVDATE) - המר לפורמט DD/MM/YY
3. חלץ תיאור כללי (DETAILS) - לא טלפון/כתובת!
4. לכל פריט: חלץ PDES (תיאור), TQUANT (כמות), PRICE (מחיר לפני מע"מ)
5. לכל פריט: בחר ACCNAME מתוך החשבונות הזמינים
6. בדוק מספר הקצאה (רק אם יש 'הקצאה') → SDINUMIT
7. חשב מחיר: SubTotal או (InvoiceTotal - TotalTax)
```

---

### 3.2 חשבונית עם תעודות

**תנאי:** `has_doc=true`, `has_import=false`

| מבנה | דגשים קריטיים | שדות חובה |
|------|--------------|-----------|
| **מנוהל מלאי** (`inventory_management=managed`) | התאמת כמויות | DOCNO, BOOKNUM תעודה |
| **לא מנוהל מלאי** (`inventory_management=not_managed`) | זיהוי תעודות בלבד | DOCNO, BOOKNUM תעודה |
| **+ זיכוי** (`debit_type=C`) | זיכוי על תעודות | DOCNO + סימן שלילי |

#### שלבי עיבוד לחשבונית עם תעודות:
```
1. זהה את מספר החשבונית (BOOKNUM) מתוך InvoiceId
2. חלץ תאריך חשבונית (IVDATE) - המר לפורמט DD/MM/YY
3. חלץ תיאור כללי (DETAILS)
4. זהה תעודות (DOCNO/BOOKNUM) - לפי פורמט הספק
5. בדוק מספר הקצאה → SDINUMIT
6. חשב מחיר
```

---

### 3.3 חשבונית יבוא

**תנאי:** `has_import=true`

| מבנה | דגשים קריטיים | שדות חובה |
|------|--------------|-----------|
| **בלי תעודות** (`has_doc=false`) | זיהוי IMPFNUM | IMPFNUM, ORDNAME |
| **עם תעודות** (`has_doc=true`) | IMPFNUM + תעודות | IMPFNUM, DOCNO, BOOKNUM |
| **+ זיכוי** (`debit_type=C`) | זיכוי יבוא | כל השדות + סימן שלילי |

#### שלבי עיבוד לחשבונית יבוא:
```
1. זהה את מספר החשבונית (BOOKNUM) מתוך InvoiceId
2. חלץ תאריך חשבונית (IVDATE)
3. חלץ תיאור כללי (DETAILS)
4. זהה מספר יבוא (IMPFNUM)
5. [אם has_doc] זהה תעודות (DOCNO/BOOKNUM)
6. בדוק מספר הקצאה → SDINUMIT
7. חשב מחיר
```

---

## 4. שדות קבועים לכל סוג מסמך

| שדה | מיקום | חובה | מקור |
|-----|-------|------|------|
| `SUPNAME` | header | כן | קוד ספק מהקונפיג |
| `CODE` | header | כן | מטבע - בד"כ "ש"ח" |
| `DEBIT` | header | כן | D=חיוב, C=זיכוי |
| `BOOKNUM` | header | כן | מספר חשבונית מ-OCR |
| `IVDATE` | header | כן | תאריך מ-OCR, פורמט DD/MM/YY |
| `FNCPATNAME` | PINVOICESCONT_SUBFORM | כן | סוג תנועה מהתבנית |
| `SDINUMIT` | PINVOICESCONT_SUBFORM | אם קיים | מספר הקצאה (רק אם יש "הקצאה") |

---

## 5. לוגיקת בחירת ACCNAME

### כשיש חשבון אחד:
```json
"accnames": ["49998"]
→ השתמש ב-49998
```

### כשיש מספר חשבונות:
```json
"accnames": ["49998", "49902"]
"partname_rules": {
    "zzz02": {
        "accnames": ["49998", "49902"],
        "sample_description": "דוח לשנת 2024"
    }
}
```
→ בחר לפי סוג ההוצאה/שירות בהתאם לדוגמאות ההיסטוריות

---

## 6. מספר הקצאה (SDINUMIT) - כללים

| כלל | הסבר |
|-----|------|
| **מתי לחפש** | תמיד - בכל סוג מסמך |
| **איפה לחפש** | בטקסט הגולמי (azureText) |
| **מילת מפתח** | רק "הקצאה" במפורש! |
| **מה לא תקף** | "תעודת רישום", "מספר אסמכתא", "מספר אישור" |
| **פורמט** | 9 ספרות |
| **אם לא נמצא** | תקין - ייתכן מתחת לסף או מסמך ישן |

---

## 7. קוד - מיקום הלוגיקה

| פונקציה | קובץ | שורות | תפקיד |
|---------|------|-------|-------|
| `determineDocumentType()` | v5.0-unified-input.js | 1195-1210 | זיהוי סוג מסמך (עברית) |
| `determineDocumentTypeKey()` | v5.0-unified-input.js | 1212-1223 | זיהוי סוג מסמך (key) |
| `buildProcessingSteps()` | v5.0-unified-input.js | 1225-1261 | בניית שלבי עיבוד |
| `generateLLMPrompt()` | v5.0-unified-input.js | 949-1127 | יצירת הפרומפט המלא |
| `searchSdinumit()` | v5.0-unified-input.js | 650-670 | חיפוש מספר הקצאה |

---

## 8. דוגמאות

### דוגמה 1: חשבונית רגילה עם פירוט

**מבנה:**
```json
{
    "has_import": false,
    "has_doc": false,
    "debit_type": "D",
    "inventory_management": "not_managed_inventory"
}
```

**פרומפט שנוצר:**
- document_type: "חשבונית רגילה עם פירוט"
- fields: booknum, ivdate, details, pdes, price, accname, sdinumit, fncpatname
- processing_steps: 8 שלבים כולל פריטים

### דוגמה 2: חשבונית עם תעודות

**מבנה:**
```json
{
    "has_import": false,
    "has_doc": true,
    "debit_type": "D",
    "inventory_management": "managed"
}
```

**פרומפט שנוצר:**
- document_type: "חשבונית עם תעודות"
- fields: booknum, ivdate, details, documents, sdinumit, fncpatname
- processing_steps: 6 שלבים כולל תעודות

### דוגמה 3: חשבונית יבוא עם תעודות

**מבנה:**
```json
{
    "has_import": true,
    "has_doc": true,
    "debit_type": "D"
}
```

**פרומפט שנוצר:**
- document_type: "חשבונית עם תיק יבוא עם תעודות"
- fields: booknum, ivdate, details, impfnum, documents, sdinumit, fncpatname
- processing_steps: 7 שלבים כולל יבוא ותעודות

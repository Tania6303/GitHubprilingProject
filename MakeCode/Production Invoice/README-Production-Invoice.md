# Production Invoice - הוראות הפעלה

**גרסה:** 1.8.1
**עדכון אחרון:** 13.12.25

---

## תיאור

קוד 3 - ייצור חשבוניות לפריוריטי.
מקבל מסמך סרוק מ-Azure OCR + תבנית ספק, ומייצר JSON מוכן להעלאה לפריוריטי.

---

## קלטים נדרשים ב-Make

| שם הקלט | סוג | חובה | תיאור |
|---------|-----|------|-------|
| `learned_config` | Object/String | כן | תבנית הספק מ-SupplierDataLearning (v1.7) |
| `AZURE_RESULT` | Object/String | כן | תוצאת OCR מ-Azure Document Intelligence |
| `AZURE_TEXT_CLEAN` | String | לא | טקסט נקי מה-OCR (לחיפוש מספרים) |
| `docs_list` | Object/String | לא | רשימת תעודות משלוח מפריוריטי |
| `import_files` | Object/String | לא | רשימת תיקי יבוא מפריוריטי |
| `vehicles` | Array/String | לא | רשימת רכבים ומיפוי חשבונות |
| `template_index` | Number/String | לא | אינדקס תבנית ספציפי (אופציונלי) |

---

## מבנה הקלטים

### learned_config (תבנית ספק v1.7)
```json
{
    "status": "success",
    "supplier_id": "3701",
    "supplier_name": "מחשבת חומרה בע\"מ",
    "templates": [
        {
            "template_index": 0,
            "document_type": {
                "type": "חשבונית עם תעודות",
                "accnames": ["60001"]
            },
            "structure": {
                "has_import": false,
                "has_doc": true,
                "debit_type": "D"
            },
            "template": { /* PINVOICES format */ },
            "sample": { /* חשבונית מלאה לדוגמה */ }
        }
    ]
}
```

### docs_list (תעודות משלוח)
```json
{
    "DOC_YES_NO": "Y",
    "list_of_docs": [
        "{\"DOCNO\":\"25012345\",\"BOOKNUM\":\"107234567\",\"TOTQUANT\":100}"
    ]
}
```

### import_files (תיקי יבוא)
```json
{
    "IMPFILES": ["25c12345"]
}
```

### vehicles (רכבים)
```json
[
    {
        "CAR_NUMBER": "419-29-702",
        "ACCNAME": "60500",
        "ASSDES": "רכב שירות",
        "BUDCODE": "100"
    }
]
```

---

## לוגיקת זיהוי תבנית

המערכת מזהה את התבנית המתאימה לפי **3 קריטריונים**:

### 1. hasImport - האם יש תיק יבוא?
```
בודק: import_files.IMPFILES.length > 0
תוצאה: true / false
```

### 2. hasDocs - האם יש תעודות משלוח?
```
סורק את Azure OCR:
- מחפש מספרים בפורמט 25XXXXXX (מספר תעודה)
- או בפורמט 10XXXXXXX (מספר אסמכתא)
תוצאה: true / false
```

### 3. debitType - חיוב או זיכוי?
```
בודק: InvoiceTotal מ-Azure OCR
סכום חיובי → "D" (חיוב)
סכום שלילי → "C" (זיכוי)
```

### התאמה לתבנית
```javascript
findMatchingTemplate(structures, hasImport, hasDocs, debitType)
// מחפש תבנית שמתאימה לכל 3 הקריטריונים
```

---

## סטטוסים אפשריים

| status | משמעות | הסבר |
|--------|--------|------|
| `matched` | נמצאה התאמה | נמצאה תבנית שמתאימה בדיוק למאפייני המסמך |
| `fallback` | ברירת מחדל | לא נמצאה התאמה, נלקחה תבנית 0 |
| `forced` | נכפה | template_index סופק ישירות בקלט |

---

## מבנה הפלט

### הצלחה (status: "success")
```json
{
    "status": "success",
    "supplier_identification": {
        "supplier_code": "3701",
        "supplier_name": "מחשבת חומרה בע\"מ",
        "identification_method": "vendor_tax_id",
        "confidence": "high"
    },
    "invoice_data": {
        "PINVOICES": [{
            "SUPNAME": "3701",
            "CODE": "ש\"ח",
            "DEBIT": "D",
            "IVDATE": "13/12/25",
            "BOOKNUM": "6096205",
            "DETAILS": "שירות גיבוי שנתי",
            "PINVOICEITEMS_SUBFORM": [...]
        }]
    },
    "validation": {
        "all_valid": true,
        "checks": {...},
        "warnings": []
    },
    "execution_report": {
        "stage": "שלב 7: ניקוי והכנה לפריוריטי",
        "found": [...],
        "warnings": [...],
        "errors": [],
        "template_match": {
            "status": "matched",
            "template_index": 0,
            "reason": "זיהוי אוטומטי לפי מאפייני המסמך",
            "document_characteristics": {
                "has_import": false,
                "has_doc": true,
                "debit_type": "D"
            },
            "available_templates": 4
        }
    },
    "metadata": {
        "template_index": 0,
        "template_type": "docs_only",
        "processing_timestamp": "2025-12-13T19:30:00.000Z"
    }
}
```

### כשלא נמצאה התאמה (fallback)
```json
{
    "status": "success",
    "execution_report": {
        "template_match": {
            "status": "fallback",
            "template_index": 0,
            "reason": "לא נמצאה התאמה (חיפשנו: has_import=true, has_doc=false, debit_type=D). נלקחה תבנית 0 כברירת מחדל",
            "document_characteristics": {
                "has_import": true,
                "has_doc": false,
                "debit_type": "D"
            },
            "available_templates": 4
        },
        "warnings": [
            "⚠️ לא נמצאה תבנית מתאימה! משתמשים בתבנית 0",
            "   חיפשנו: יבוא=true, תעודות=false, סוג=D",
            "   תבניות זמינות: 0: יבוא=false, תעודות=true, סוג=D | 1: יבוא=false, תעודות=true, סוג=C..."
        ]
    }
}
```

---

## דוגמה לזרימה ב-Make

```
1. Azure Document Intelligence
   ↓ AZURE_RESULT

2. Priority API - קבל תעודות
   ↓ docs_list

3. Priority API - קבל תיקי יבוא (אם רלוונטי)
   ↓ import_files

4. Priority API - קבל רכבים (אם רלוונטי)
   ↓ vehicles

5. Data Store - קבל תבנית ספק
   ↓ learned_config

6. Production Invoice (קוד זה)
   ↓

7. Priority API - צור חשבונית
   ← invoice_data.PINVOICES
```

---

## טיפים

### בדיקת התאמת תבנית
אם מקבלים הרבה `fallback`, כדאי לבדוק:
1. האם התבניות ב-learned_config מכסות את כל הסוגים?
2. האם הזיהוי של תעודות (hasDocs) עובד נכון?
3. האם יש תבנית לזיכויים (debit_type=C)?

### שימוש ב-template_index
אם רוצים לכפות תבנית ספציפית:
```json
{
    "template_index": 2
}
```
זה ידלג על הזיהוי האוטומטי וישתמש ישירות בתבנית 2.

---

## קבצים קשורים

- `MakeCode/SupplierDataLearning/v1.4-new-structure.js` - קוד 1 (יצירת תבנית ספק)
- `MakeCode/Processing Invoice/v5.0-unified-input.js` - קוד 2 (עיבוד מאוחד)
- `MakeCode/Production Invoice/EXEMPTS/` - קבצי בדיקה

---

## היסטוריית גרסאות

| גרסה | תאריך | שינויים |
|------|-------|---------|
| 1.8.1 | 13.12.25 | לעולם לא מחזיר שגיאה - fallback לתבנית 0 + דיווח מפורט |
| 1.8.0 | 13.12.25 | תאימות ל-SupplierDataLearning v1.7 |
| 1.7.9 | 12.12.25 | תמיכה ב-template_index כמחרוזת |
| 1.7.8 | 12.12.25 | תמיכה ב-template_index מהקלט |

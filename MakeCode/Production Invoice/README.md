# Production Invoice Generator v1.0

## 📋 תפקיד

מודול ייצור JSON סופי לחשבוניות חדשות (**Production Mode**).

מודול זה **לא לומד** - הוא רק מפעיל לפי הנחיות קיימות ממודול Processing Invoice.

---

## 🔄 המערכת השלמה

```
┌─────────────────────────────┐
│ 1. SupplierDataLearning     │ ← למידה ראשונית מדוגמאות
│    Learning Mode            │
└──────────┬──────────────────┘
           │ learned_config
           ▼
┌─────────────────────────────┐
│ 2. Processing Invoice       │ ← למידה מחשבונית דוגמה
│    (v4.2-COMPLETE.js)       │   + יצירת הנחיות
│    Learning + Guide Mode    │
└──────────┬──────────────────┘
           │ template, structure, rules
           ▼
┌─────────────────────────────┐
│ 3. Production Invoice       │ ← ייצור JSON לחשבונית חדשה
│    (execute-invoice.js)     │   לפי הנחיות
│    ⭐ Production Mode        │
└─────────────────────────────┘
```

---

## 📥 קלט (Input)

```javascript
{
  // 1. הנחיות ממודול 2
  learned_config: {
    config: {
      supplier_config: {...},
      structure: [...],
      rules: {...}
    },
    template: {...}
  },

  // 2. נתונים חיים מהמערכת
  docs_list: {
    DOC_YES_NO: "Y/N",
    list_of_docs: [...]
  },

  import_files: {
    IMPFILES: [...]
  },

  vehicles: {
    list_of_vehicles: [...]
  },

  // 3. ניתוח OCR של החשבונית החדשה
  AZURE_RESULT: {...},
  AZURE_TEXT: "..."
}
```

---

## 📤 פלט (Output)

```javascript
{
  status: "success" / "error",

  invoice: {
    PINVOICES: [{
      SUPNAME: "...",
      CODE: "...",
      BOOKNUM: "...",
      IVDATE: "...",
      PIVDOC_SUBFORM: [...],      // אם יש תעודות
      PINVOICEITEMS_SUBFORM: [...] // אם צריך פירוט
    }]
  },

  execution_report: {
    stage: "...",
    found: [...],
    not_found: [...],
    warnings: [...],
    errors: [...]
  }
}
```

---

## 🔧 איך זה עובד?

### שלב 1: זיהוי מצב
- בודק: האם יש תעודות/יבוא/רכבים ב-OCR
- מוצא תבנית מתאימה ב-structure
- קובע: חיוב/זיכוי

### שלב 2: חיפוש נתונים
- **BOOKNUM** - מחפש ב-UnidentifiedNumbers
- **תעודות** - מתאים BOOKNUM מ-OCR עם docs_list
- **יבוא** - מחפש IMPFNUM
- **רכבים** - מחפש מספרי רכב ומתאים עם vehicles

### שלב 3: בניית JSON
- יוצר PINVOICES לפי template
- מוסיף PIVDOC_SUBFORM אם יש תעודות
- מוסיף PINVOICEITEMS_SUBFORM אם נדרש פירוט

### שלב 4: ולידציה
- בודק שכל השדות החובה קיימים
- מדווח warnings אם חסר משהו
- מדווח errors אם יש בעיה קריטית

---

## 🆚 ההבדל ממודול Processing Invoice (v4.2)

| | Processing Invoice | Production Invoice |
|---|---|---|
| **מצב** | Learning Mode | Production Mode |
| **מטרה** | ללמוד מדוגמה | להריץ חשבונית חדשה |
| **קלט** | דוגמה + OCR | OCR חדש + הנחיות |
| **פלט** | הנחיות + קונפיג | JSON סופי |
| **שימוש** | פעם אחת לספק | כל חשבונית חדשה |

---

## 🔗 קשרים לפונקציות ב-v4.2-COMPLETE.js

הפונקציות במודול זה **עצמאיות** אבל מבוססות על לוגיקה דומה:

| פונקציה במודול 3 | פונקציה מקבילה ב-v4.2 | שורות ב-v4.2 |
|---|---|---|
| `searchDocuments()` | `searchDocuments()` | 505-567 |
| `searchImport()` | `searchImpfnum()` | 481-503 |
| `searchVehicles()` | `extractVehiclesAdvanced()` | 569-656 |
| `buildInvoice()` | `buildInvoiceFromTemplate()` | 766-895 |
| `shouldAddItems()` | `shouldAddItems()` | 897-901 |
| `createVehicleItems()` | `createVehicleItems()` | 658-733 |

**⚠️ חשוב:** הקוד **לא תלוי** ב-v4.2! זה רק תיעוד של קשרים לוגיים.

---

## 📂 מבנה הספרייה

```
Production Invoice/
├── execute-invoice.js          ← הקוד הראשי
├── README.md                    ← המדריך הזה
└── QA/
    ├── input_example.json       ← דוגמת קלט (ספק 2511)
    └── output_example.json      ← דוגמת פלט צפוי
```

---

## ✅ דוגמת שימוש ב-MAKE

### 1. טען את הקוד
```javascript
// ב-MAKE Code Module
const productionInvoice = require('./execute-invoice.js');
```

### 2. הכן input
```javascript
const input = {
  learned_config: {...},  // ממודול 2
  docs_list: {...},       // מ-Priority
  import_files: {...},    // מ-Priority
  vehicles: {...},        // מ-Priority
  AZURE_RESULT: {...},    // מ-AzureInvoiceProcessor
  AZURE_TEXT: "..."       // מ-OCR
};
```

### 3. הרץ
```javascript
const result = productionInvoice.executeInvoice(input);
```

### 4. קבל תוצאה
```javascript
if (result.status === "success") {
  // שלח ל-Priority
  sendToPriority(result.invoice);
} else {
  // טפל בשגיאה
  logError(result.execution_report.errors);
}
```

---

## 🧪 בדיקה

### הרצה מקומית (Node.js):
```bash
cd "MakeCode/Production Invoice"
node execute-invoice.js
```

### בדיקה עם דוגמה:
```bash
node -e "
const fs = require('fs');
const { executeInvoice } = require('./execute-invoice.js');
const input = JSON.parse(fs.readFileSync('./QA/input_example.json', 'utf8'));
const result = executeInvoice(input);
console.log(JSON.stringify(result, null, 2));
"
```

---

## 📝 הערות חשובות

1. **עצמאי לחלוטין** - לא תלוי בקבצים אחרים
2. **לא לומד** - רק מפעיל לפי הנחיות
3. **Production ready** - מיועד לריצה על כל חשבונית חדשה
4. **טיפול בשגיאות** - מדווח על כל בעיה
5. **מתועד היטב** - כל פונקציה מוסברת

---

## 🐛 Troubleshooting

### בעיה: "לא נמצאה תבנית מתאימה"
**פתרון:** בדוק ש-structure ב-learned_config תואם למצב החשבונית (has_doc, has_import, debit_type)

### בעיה: "תבנית דורשת תעודות אך לא נמצאו"
**פתרון:** בדוק:
1. BOOKNUM קיימים ב-UnidentifiedNumbers?
2. docs_list מכיל את התעודות?
3. ההתאמה בין BOOKNUM ל-docs_list עובדת?

### בעיה: "חסר מספר יבוא"
**פתרון:** בדוק אם import_files מכיל IMPFNUM או אם צריך לחפש ב-OCR

---

## 📞 תמיכה

לשאלות ובעיות: פנה למפתח המערכת

---

## 📜 היסטוריית גרסאות

### v1.7.5 (06.11.2025) ⚠️ CRITICAL
**תיקון:** BOOKNUM validation - מניעת תעודות עם BOOKNUM לא תקין
- הוספת validation בשורות 929-934 ב-`searchDocuments()`
- דילוג על תעודות עם BOOKNUM קצר מ-7 תווים
- מונע regex התאמה לא רצויה (כמו `/\b1\b/` שמתאים לכל "1" בטקסט)
- **בעיה שתוקנה:** docs_list הכיל תעודות עם BOOKNUM="1" שנוספו בטעות לחשבוניות
- **תוצאה:** רק תעודות עם BOOKNUM תקין (≥7 תווים) מתווספות ל-PIVDOC_SUBFORM

### v1.7.4 (06.11.2025) ⚠️ CRITICAL
**תיקון:** מניעת כפילויות תעודות
- הוספת unique check: `foundDocs.some(d => d.BOOKNUM === match.BOOKNUM)`
- כל BOOKNUM מופיע פעם אחת בלבד ב-PIVDOC_SUBFORM
- תיקון בשני מקומות: UnidentifiedNumbers loop + AZURE_TEXT fallback

### v1.7.3 (06.11.2025) ⚠️ CRITICAL
**תיקון:** needItems logic
- אם `has_doc=true` לעולם לא ליצור PINVOICEITEMS_SUBFORM
- קודם: `needItems = !has_doc || documents.length === 0` (לא נכון)
- עכשיו: `needItems = !has_doc` (נכון)

### v1.0 (31.10.2025)
**גרסה ראשונית** - Production Mode מלא

---

**גרסה נוכחית:** v1.7.5
**תאריך עדכון אחרון:** 06 נובמבר 2025
**מחבר:** Claude Code (Anthropic)

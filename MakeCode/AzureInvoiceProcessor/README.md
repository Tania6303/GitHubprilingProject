# @tania6303/azure-invoice-processor v2.23

מעבד OCR מתקדם שמנתח חשבוניות באמצעות Azure Document Intelligence API עם מיפוי מורחב לזיהוי ספקים.

---

## 📦 התקנה

```bash
npm install @tania6303/azure-invoice-processor
```

---

## 🎯 מה החבילה עושה?

**קלט:** תוצאות Azure OCR גולמיות
**פלט:** JSON מובנה עם שדות מזוהים + מבנה מורחב עם originalHeader

### תהליך:
1. **קבלת OCR** - מקבל analyzeResult מ-Azure
2. **חילוץ שדות** - מזהה שדות ידועים (InvoiceId, InvoiceDate, וכו')
3. **זיהוי פריטים** - מחלץ פריטים מטבלאות
4. **מיפוי כותרות** - שומר כותרות מקוריות (עברית/אנגלית) לכל שדה
5. **זיהוי ייחודי** - מזהה מספרים ייחודיים (תעודות, רכבים, קודי חלקים)
6. **החזרת תוצאה** - JSON מובנה לשימוש במודולים הבאים

---

## ✨ תכונות מיוחדות

### **🆕 חדש ב-v2.23 (12.11.25):**

#### 1. **מבנה מורחב עם originalHeader**
```javascript
structure: {
  Items: [{
    ProductCode: {
      type: "string",
      originalHeader: "מק\"ט"  // ← הכותרת המקורית!
    }
  }]
}
```
- שמירת כותרת מקורית מהמסמך
- תמיכה בזיהוי ספק עתידי
- מיפוי אוטומטי עברית ↔ אנגלית

#### 2. **מילון תרגום דו-לשוני**
```javascript
getHeaderTranslationMap()
```
- 10 שדות סטנדרטיים
- תמיכה מלאה בעברית ואנגלית
- מיפוי חכם: "סה\"כ מחיר" → TotalPrice

#### 3. **שמירת כל העמודות**
- עמודות לא מזוהות ← `UnknownColumn_N`
- שומר originalHeader גם לעמודות לא ידועות
- **אף מידע לא נזרק!**

---

## 💻 שימוש

```javascript
// Option 1: Require (CommonJS)
const processor = require('@tania6303/azure-invoice-processor');

// Option 2: Import (ES6)
import processor from '@tania6303/azure-invoice-processor';

// הכנת קלט מ-Azure
const azureResult = {
  contentLong: rawContent,
  pages: azurePages,
  tables: azureTables,
  documents: azureDocuments,
  modelId: 'prebuilt-invoice'
};

// עיבוד
const result = processor(azureResult);

console.log(result.structure);  // מבנה עם originalHeader
console.log(result.data);       // נתונים
```

---

## 📥 קלט (Input)

```javascript
{
  contentLong: "...",      // טקסט גולמי מ-Azure
  pages: [...],            // עמודים
  tables: [...],           // טבלאות
  documents: [...],        // מסמכים מזוהים
  modelId: "prebuilt-invoice"
}
```

---

## 📤 פלט (Output)

```javascript
{
  status: "success",

  structure: {
    docType: "string",
    fields: {...},
    Items: [{
      LineNumber: {
        type: "string",
        originalHeader: "שורה"  // ← כותרת מקורית!
      },
      ProductCode: {
        type: "string",
        originalHeader: "מק\"ט"
      },
      TotalPrice: {
        type: "number",
        originalHeader: "סה\"כ מחיר"
      }
    }]
  },

  data: {
    docType: "invoice",
    fields: {
      InvoiceId: "SI256008511",
      InvoiceDate: "2025-09-30",
      Items: [{
        LineNumber: "1",
        ProductCode: "C61050-50",
        Description: "צינור קוברה 50 גמיש",
        Quantity: 600,
        TotalPrice: 1380.00
      }],
      UnidentifiedNumbers: [...]
    }
  },

  metadata: {
    modelId: "prebuilt-invoice",
    totalFields: 36,
    uniqueDataFound: 8,
    pageCount: 1
  }
}
```

---

## 🔧 פונקציות עיקריות

### **extractUniqueData()**
זיהוי דינמי של מידע ייחודי:
1. `extractLabelValuePairs()` - זוגות "כותרת: ערך"
2. `extractPartCodes()` - קודי חלקים (ABC-12345)
3. `extractVehicleNumbers()` - מספרי רכב (123-45-678)
4. `extractDocumentNumbers()` - מספרי תעודות (DOCNO, BOOKNUM) ⭐ חדש!
5. `extractSpecialLengthNumbers()` - מספרים באורכים מיוחדים (13, 17 ספרות)

### **extractRealItemsFromTable()**
חילוץ פריטים מטבלאות:
- מזהה טבלה ראשית
- מזהה כותרות עמודות
- מנקה פריטים לא רלוונטיים

### **detectNumbersByContext()**
זיהוי מספרים לפי הקשר:
- מספרי טלפון
- תאריכים
- פרטי בנק (IBAN, SWIFT)
- כתובות אימייל

---

## 📂 קבצים

```
AzureInvoiceProcessor/
├── v2.0(30.10.25)                  ← הקוד הראשי (27KB)
├── test-document-detection.js      ← בדיקת זיהוי תעודות
├── test-extract-documents.js       ← בדיקת extractDocumentNumbers()
└── test-vin-filter.js              ← בדיקת סינון VIN מזויף
```

---

## 🧪 בדיקות

### הרצת בדיקות:
```bash
# בדיקת זיהוי תעודות
node test-document-detection.js

# בדיקת פונקציית extractDocumentNumbers
node test-extract-documents.js

# בדיקת סינון VIN
node test-vin-filter.js
```

### תוצאות מוצלחות:
✅ זיהוי 4 DOCNO + 4 BOOKNUM
✅ סינון תאריכים (202X) מרשימת VIN
✅ כל המספרים מסומנים עם context ו-label

---

## 🔄 שימוש במערכת

```
Azure OCR
    ↓
┌────────────────────────┐
│ AzureInvoiceProcessor  │ ← אתה כאן
│       v2.0             │
└───────────┬────────────┘
            ↓
    AZURE_RESULT + AZURE_TEXT
            ↓
┌────────────────────────┐
│ Processing Invoice     │ ← מודול 2
│      (Learning)        │
└───────────┬────────────┘
            ↓
┌────────────────────────┐
│ Production Invoice     │ ← מודול 3
│    (Execution)         │
└────────────────────────┘
```

---

## 🗺️ שדות נתמכים

| עברית | אנגלית | סוג |
|-------|---------|-----|
| שורה | LineNumber | string |
| הזמנתכם | CustomerOrder | string |
| מק"ט | ProductCode | string |
| תאור מוצר | Description | string |
| כמות | Quantity | number |
| יחידה | Unit | string |
| מחיר ליחידה | UnitPrice | number |
| סה"כ מחיר | TotalPrice | number |
| הנחה | Discount | number |
| מע"מ | Tax | number |

---

## 📝 היסטוריית גרסאות

### **v2.23 - 12 נובמבר 2025** 🎯
- ✨ **מבנה מורחב:** כל שדה עם `type` + `originalHeader`
- 🌍 **מילון תרגום:** 10 שדות עם תמיכה דו-לשונית
- 🔧 **buildAzureFieldToHeaderMap():** מיפוי שדות Azure לכותרות מקוריות
- 🔄 **extractRealItemsFromTable():** תמיד מנתח טבלה תחילה
- 💾 **שמירה מלאה:** עמודות לא מזוהות נשמרות כ-UnknownColumn_N

### **v2.22 - 10 נובמבר 2025**
- 🧹 ריפקטור וייעול קוד
- 📦 מיזוג פונקציות כפולות

### **v2.21 - 9 נובמבר 2025**
- 🔴 תיקון: רשימות עם URLs

### **v2.20 - 9 נובמבר 2025**
- 🔴 תיקון: טלפונים ניידים, OCR artifacts

---

## 📦 פרסום ב-npm

```bash
# התחברות (פעם אחת)
npm login

# פרסום החבילה
npm publish --access public

# עדכון גרסה
npm version patch  # 2.23.0 → 2.23.1
npm version minor  # 2.23.0 → 2.24.0
npm version major  # 2.23.0 → 3.0.0
```

---

## 📄 רישיון

MIT

---

**גרסה:** 2.23.0
**תאריך עדכון אחרון:** 12 נובמבר 2025
**מחבר:** Tania

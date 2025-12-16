# תוכנית עבודה: תמיכה במספר תבניות לספק

**תאריך:** 12.12.2025
**גרסה:** 1.0
**סטטוס:** בעבודה

---

## 1. סקירת הבעיה

### הבעיה המרכזית
כאשר ספק אחד יש לו מספר תבניות חשבונית שונות (לדוגמה: יבוא, תעודות, זיכוי, רגילה), המערכת לא יכולה לקשר בין:
- התבנית שזוהתה בקוד 1
- המסמך שנסרק ב-Azure
- התוצאה שחוזרת לקוד 2/3

### שורש הבעיה
1. **באג בקוד 1**: בחירת דוגמאות מכל 20 החשבוניות במקום מהתבנית הספציפית
2. **חוסר קישור**: אין `template_index` ב-`recommended_samples` שיקשר כל דוגמה לתבנית שלה

---

## 2. קודים מושפעים

| קוד | קובץ | גרסה | השפעה |
|-----|------|------|-------|
| **קוד 1** | `SupplierDataLearning/v1.2(28.10.25)` | 1.2 | מקור הבעיה - צריך תיקון |
| **קוד 2** | `Processing Invoice/v4.2-COMPLETE.js` | 4.11 | צריך תמיכה ב-template_index |
| **קוד 3** | `Production Invoice/v1.0-production.js` | 1.7.7 | צריך תמיכה ב-template_index |

### סצנריו Make מושפע
- `S1-PriLernSup.blueprint.json` - מעביר את `recommended_samples.samples` ל-Iterator

---

## 3. זרימת העבודה הנוכחית

```
┌─────────────────────────────────────────────────────────────────┐
│  קוד 1 (SupplierDataLearning)                                   │
│  מנתח 20 חשבוניות → מזהה 4 תבניות                               │
│                                                                 │
│  recommended_samples.samples:                                   │
│    [0] { sample_ivnum, sample_booknum }  ← לאיזו תבנית? ❓      │
│    [1] { sample_ivnum, sample_booknum }  ← לאיזו תבנית? ❓      │
│    [2] { sample_ivnum, sample_booknum }  ← לאיזו תבנית? ❓      │
│    [3] { sample_ivnum, sample_booknum }  ← לאיזו תבנית? ❓      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Make - BasicFeeder (Iterator)                                  │
│  id: 74 - "מפצל לקבצים"                                         │
│  array: {{79.result.recommended_samples.samples}}               │
│                                                                 │
│  לכל sample:                                                    │
│    → id: 128 - DOCUMENTS FROM PRIORITY ({{74.sample_ivnum}})    │
│    → id: 90 - IMPFILES                                          │
│    → Azure OCR                                                  │
│    → קוד 2/3                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  קוד 2/3 - מקבל AZURE_RESULT                                    │
│                                                                 │
│  ❌ משתמש ב-findMatchingTemplate() לזהות תבנית                 │
│  ❌ לא יודע מאיזו תבנית הגיעה הדוגמה                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. זרימת העבודה המתוקנת

```
┌─────────────────────────────────────────────────────────────────┐
│  קוד 1 (SupplierDataLearning) - מתוקן                           │
│                                                                 │
│  recommended_samples.samples:                                   │
│    [0] { template_index: 0, sample_ivnum, sample_booknum } ✅   │
│    [1] { template_index: 1, sample_ivnum, sample_booknum } ✅   │
│    [2] { template_index: 2, sample_ivnum, sample_booknum } ✅   │
│    [3] { template_index: 3, sample_ivnum, sample_booknum } ✅   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Make - BasicFeeder (Iterator)                                  │
│                                                                 │
│  לכל sample - עכשיו יש גישה ל:                                  │
│    {{74.template_index}}  ← חדש!                                │
│    {{74.sample_ivnum}}                                          │
│    {{74.sample_booknum}}                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  קוד 2/3 - מקבל template_index בקלט                             │
│                                                                 │
│  ✅ אם יש template_index → משתמש בו ישירות                     │
│  ✅ אחרת → fallback ל-findMatchingTemplate()                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. שינויים נדרשים

### 5.1 קוד 1 - SupplierDataLearning

#### 5.1.1 תיקון באג - בחירת דוגמאות (שורות 631-651)

**לפני (באג):**
```javascript
mergedTypes.forEach(() => {
    const randomIndex = Math.floor(Math.random() * analysis.all_data.length);
    const randomInvoice = analysis.all_data[randomIndex];  // ❌ מכל הנתונים!
});
```

**אחרי (מתוקן):**
```javascript
mergedTypes.forEach((docType, index) => {
    const templateSamples = docType.all_samples || [docType.sample];
    const randomIndex = Math.floor(Math.random() * templateSamples.length);
    const sampleInvoice = templateSamples[randomIndex];  // ✅ מהתבנית הספציפית!
});
```

#### 5.1.2 הוספת template_index

**לפני:**
```javascript
samples.push({
    sample_ivnum: sampleInvoice.IVNUM || '',
    sample_booknum: sampleInvoice.BOOKNUM || '',
    sample_impfnum: sampleInvoice.IMPFNUM || '',
    sample_supname: sampleInvoice.SUPNAME || ''
});
```

**אחרי:**
```javascript
samples.push({
    template_index: index,  // ← חדש!
    sample_ivnum: sampleInvoice.IVNUM || '',
    sample_booknum: sampleInvoice.BOOKNUM || '',
    sample_impfnum: sampleInvoice.IMPFNUM || '',
    sample_supname: sampleInvoice.SUPNAME || ''
});
```

---

### 5.2 קוד 2 - Processing Invoice

#### 5.2.1 תמיכה בקבלת template_index (בתוך processInvoiceComplete)

**הוספה בשלב 1 - אחרי שורה 147:**
```javascript
// אם קיבלנו template_index בקלט - להשתמש בו ישירות
let templateIndex;
if (typeof input.template_index === 'number') {
    templateIndex = input.template_index;
    executionReport.found.push(`תבנית: index=${templateIndex} (מקלט)`);
} else {
    // fallback - זיהוי אוטומטי
    templateIndex = findMatchingTemplate(config.structure, hasImport, hasDocs, debitType);
    if (templateIndex === -1) {
        executionReport.errors.push("לא נמצאה תבנית מתאימה!");
        throw new Error("לא נמצאה תבנית מתאימה");
    }
    executionReport.found.push(`תבנית: index=${templateIndex} (זיהוי אוטומטי)`);
}
```

---

### 5.3 קוד 3 - Production Invoice

#### 5.3.1 תמיכה בקבלת template_index (אותו שינוי כמו קוד 2)

**הוספה בשורה ~627:**
```javascript
// אם קיבלנו template_index בקלט - להשתמש בו ישירות
let templateIndex;
if (typeof input.template_index === 'number') {
    templateIndex = input.template_index;
} else {
    templateIndex = findMatchingTemplate(allStructures, hasImport, hasDocs, debitType);
}
```

---

### 5.4 Make - S1-PriLernSup

#### 5.4.1 העברת template_index לקוד 2/3

בכל מקום שקוראים לקוד 2 או 3, להוסיף:
```
template_index: {{74.template_index}}
```

---

## 6. סדר ביצוע

| שלב | פעולה | קובץ | עדיפות |
|-----|-------|------|--------|
| 1 | תיקון באג בחירת דוגמאות | קוד 1 | קריטי |
| 2 | הוספת template_index | קוד 1 | קריטי |
| 3 | תמיכה ב-template_index | קוד 2 | גבוהה |
| 4 | תמיכה ב-template_index | קוד 3 | גבוהה |
| 5 | עדכון Make | S1-PriLernSup | גבוהה |
| 6 | בדיקות אינטגרציה | - | בינונית |

---

## 7. תאימות לאחור

השינויים **תואמים לאחור**:
- אם `template_index` לא קיים בקלט → הקוד משתמש ב-`findMatchingTemplate()` כרגיל
- סצנריואים ישנים ימשיכו לעבוד

---

## 8. בדיקות נדרשות

### 8.1 קוד 1
- [ ] ספק עם 4 תבניות שונות → כל דוגמה מהתבנית הנכונה
- [ ] ספק עם תבנית אחת → ללא שינוי בהתנהגות

### 8.2 קוד 2/3
- [ ] עם template_index בקלט → משתמש בו
- [ ] בלי template_index בקלט → fallback לזיהוי אוטומטי

### 8.3 Make
- [ ] Iterator מעביר template_index לכל השלבים
- [ ] תוצאות נכונות לכל 4 התבניות

---

## 9. הערות נוספות

### קישור בין קוד 2 לקוד 3
בכותרת קוד 2 כתוב:
```
// ⚠️ קשור ל: MakeCode/Production Invoice/v1.0-production.js
// אם מתקנים בעיה כאן (כמו תבנית BOOKNUM, docs_list) - לבדוק גם שם!
```

יש לוודא שהשינויים מסונכרנים בין שני הקודים.

---

**נוצר על ידי:** Claude
**עודכן לאחרונה:** 12.12.2025

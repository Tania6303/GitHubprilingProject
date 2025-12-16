# הנחיות לעדכון סצנריו Make - תמיכה ב-template_index

**תאריך:** 12.12.2025
**סצנריו:** S1-PriLernSup

---

## סיכום השינויים בקודים

| קוד | גרסה חדשה | שינוי |
|-----|-----------|-------|
| קוד 1 | 1.3 | מוסיף `template_index` ל-`recommended_samples.samples` |
| קוד 2 | 4.12 | מקבל `template_index` בקלט (אופציונלי) |
| קוד 3 | 1.7.8 | מקבל `template_index` בקלט (אופציונלי) |

---

## מה השתנה בפלט של קוד 1

### לפני (גרסה 1.2):
```json
{
  "recommended_samples": {
    "samples": [
      {
        "sample_ivnum": "25070258",
        "sample_booknum": "6007405",
        "sample_impfnum": "",
        "sample_supname": "3701"
      },
      {
        "sample_ivnum": "T129628",
        "sample_booknum": "6096205",
        "sample_impfnum": "",
        "sample_supname": "3701"
      }
    ]
  }
}
```

### אחרי (גרסה 1.3):
```json
{
  "recommended_samples": {
    "samples": [
      {
        "template_index": 0,
        "sample_ivnum": "25070258",
        "sample_booknum": "6007405",
        "sample_impfnum": "",
        "sample_supname": "3701"
      },
      {
        "template_index": 1,
        "sample_ivnum": "T129628",
        "sample_booknum": "6096205",
        "sample_impfnum": "",
        "sample_supname": "3701"
      }
    ]
  }
}
```

---

## שינויים נדרשים ב-Make

### 1. BasicFeeder (id: 74) - "מפצל לקבצים"

**אין שינוי נדרש!** ה-Feeder כבר עובר על `{{79.result.recommended_samples.samples}}` וכל שדה חדש שנוסיף ל-samples יהיה זמין אוטומטית.

אחרי העדכון, בכל איטרציה תהיה גישה ל:
- `{{74.template_index}}` ← **חדש!**
- `{{74.sample_ivnum}}`
- `{{74.sample_booknum}}`
- `{{74.sample_impfnum}}`
- `{{74.sample_supname}}`

---

### 2. קריאה לקוד 2 או קוד 3 - הוספת input חדש

בכל מקום שבו את קוראת לקוד 2 או קוד 3 (בדרך כלל במודול `code:ExecuteCode`), צריך להוסיף את `template_index` לקלט.

**לפני:**
```javascript
// במודול code:ExecuteCode
var input = {
    learned_config: {{...}},
    docs_list: {{...}},
    import_files: {{...}},
    AZURE_RESULT: {{...}},
    AZURE_TEXT: {{...}},
    vehicles: {{...}}
};
```

**אחרי:**
```javascript
// במודול code:ExecuteCode
var input = {
    learned_config: {{...}},
    docs_list: {{...}},
    import_files: {{...}},
    AZURE_RESULT: {{...}},
    AZURE_TEXT: {{...}},
    vehicles: {{...}},
    template_index: {{74.template_index}}  // ← חדש!
};
```

---

### 3. אם את משתמשת ב-HTTP module לקריאה לקוד

אם את קוראת לקוד דרך HTTP (ולא ExecuteCode), הוסיפי את השדה ל-body:

```json
{
    "learned_config": "{{...}}",
    "docs_list": "{{...}}",
    "import_files": "{{...}}",
    "AZURE_RESULT": "{{...}}",
    "template_index": {{74.template_index}}
}
```

---

## זרימה מתוקנת בסצנריו

```
┌─────────────────────────────────────────────────────────────────┐
│  id: 79 - קוד 1 (SupplierDataLearning v1.3)                     │
│                                                                 │
│  פלט: recommended_samples.samples עם template_index             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  id: 74 - BasicFeeder (Iterator)                                │
│                                                                 │
│  עכשיו זמין: {{74.template_index}} לכל sample                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  id: 128 - DOCUMENTS FROM PRIORITY                              │
│  (ללא שינוי - משתמש ב-sample_ivnum)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  id: 90 - IMPFILES                                              │
│  (ללא שינוי)                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Azure OCR                                                      │
│  (ללא שינוי)                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  קוד 2/3 - ✅ הוספת template_index: {{74.template_index}}       │
│                                                                 │
│  הקוד יזהה את התבנית הנכונה ישירות!                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## בדיקות לאחר העדכון

### בדיקה 1: פלט קוד 1
1. הרץ את קוד 1 על ספק עם מספר תבניות
2. בדוק ש-`recommended_samples.samples` מכיל `template_index` לכל sample
3. בדוק שהדוגמאות מתאימות לתבניות (לא אקראיות מכל הנתונים)

### בדיקה 2: העברת template_index
1. בדוק ש-`{{74.template_index}}` מחזיר ערך (0, 1, 2, ...)
2. בדוק שה-template_index מגיע לקוד 2/3

### בדיקה 3: זיהוי תבנית בקוד 2/3
1. בדוק ב-execution_report שמופיע:
   - `תבנית: index=X (מקלט - template_index)` ← זה טוב!
   - ולא `תבנית: index=X (זיהוי אוטומטי)`

---

## תאימות לאחור

**השינויים תואמים לאחור!**

- אם `template_index` לא קיים בקלט → קוד 2/3 משתמש ב-`findMatchingTemplate()` כרגיל
- סצנריואים ישנים שלא מעבירים `template_index` ימשיכו לעבוד

---

## שאלות נפוצות

### ש: מה אם יש לי רק תבנית אחת?
ת: זה יעבוד בדיוק כמו קודם. `template_index` יהיה 0 לכל הדוגמאות.

### ש: מה אם אני לא רוצה לעדכן את Make עכשיו?
ת: הקודים תואמים לאחור! ללא `template_index` הם יעבדו כמו קודם (זיהוי אוטומטי).

### ש: איך אני יודעת שהשינוי עובד?
ת: בדוח הביצוע (`execution_report.found`) תראי:
- **עם template_index:** `תבנית: index=1 (מקלט - template_index)`
- **בלי:** `תבנית: index=1 (זיהוי אוטומטי)`

---

**נוצר על ידי:** Claude
**תאריך:** 12.12.2025

# 🧹 Text Standardization - ניקוי טקסט מ-OCR

מודול ייעודי לניקוי ונרמול טקסט מלוכלך מ-Azure Document Intelligence OCR.

## 📋 מטרה

**בעיה:** Azure OCR מחזיר טקסט עם:
- ✅ רווחים מיותרים: `"741   -  69   - 103"`
- ✅ תווים בלתי נראים: `\u200B\u00A0\uFEFF`
- ✅ מקפים שונים: en-dash (–), em-dash (—), minus (−)
- ✅ Line breaks מסוגים שונים (Windows/Mac/Unix)
- ✅ Non-breaking spaces
- ✅ תווי Unicode בעייתיים

**פתרון:** פונקציה אחת שמנקה הכל! 🎯

---

## 🚀 שימוש מהיר

### דוגמה 1: שימוש בסיסי
```javascript
const dirty = "741   -  69   - 103   טיפול    75000   ק\"מ";
const clean = standardizeText(dirty);
// תוצאה: "741-69-103 טיפול 75000 ק\"מ"
```

### דוגמה 2: עם אופציות
```javascript
const dirty = "רכב  459\u00A0-\u00A006\u200B-\u00A0303";
const clean = standardizeText(dirty, {
    fixVehicleNumbers: true,
    removeInvisibleChars: true
});
// תוצאה: "רכב 459-06-303"
```

### דוגמה 3: ניקוי מהיר (רק הבסיס)
```javascript
const clean = quickClean(dirtyText);
```

### דוגמה 4: ניקוי עמוק (הכל!)
```javascript
const clean = deepClean(dirtyText);
```

### דוגמה 5: רק מספרי רכב
```javascript
const clean = cleanForVehicles(dirtyText);
```

---

## ⚙️ אופציות

| אופציה | ברירת מחדל | תיאור |
|--------|------------|--------|
| `removeInvisibleChars` | `true` | הסר תווים בלתי נראים |
| `normalizeWhitespace` | `true` | נרמל רווחים (tabs → spaces) |
| `normalizeLineBreaks` | `true` | נרמל שורות חדשות |
| `normalizeHyphens` | `true` | נרמל מקפים (–, —, − → -) |
| `fixVehicleNumbers` | `true` | תקן מספרי רכב (XXX-XX-XXX) |
| `fixNumbers` | `true` | תקן מספרים עם רווחים |
| `normalizeHebrew` | `true` | נרמל תווים עבריים (״ → ") |
| `removeExtraSpaces` | `true` | הסר רווחים מיותרים |

---

## 📊 דוגמאות לפני/אחרי

### מספרי רכב
```
לפני:  "741   -  69   - 103"
אחרי:  "741-69-103"
```

### תווים בלתי נראים
```
לפני:  "רכב\u00A0459\u200B-\u00A006\u200B-\u00A0303"
אחרי:  "רכב 459-06-303"
```

### רווחים מרובים
```
לפני:  "טיפול    75000    ק\"מ"
אחרי:  "טיפול 75000 ק\"מ"
```

### מספרים
```
לפני:  "מחיר: 1 234.56 ש\"ח"
אחרי:  "מחיר: 1234.56 ש\"ח"
```

---

## 🔧 שילוב עם Processing Invoice

### אופציה 1: ניקוי לפני עיבוד
```javascript
// ב-Processing Invoice
const cleanAzureText = standardizeText(input.AZURE_TEXT);
const vehicles = extractVehiclesAdvanced(ocrFields, vehicleRules, cleanAzureText);
```

### אופציה 2: ב-Make.com workflow
```
AZURE_TEXT → Text Standardization → Processing Invoice
```

---

## 📁 קבצים

```
TextStandardization/
├── standardize-text.js       # קוד ראשי
├── EXEMPTS/
│   └── test-dirty-text.js   # דוגמאות לבדיקה
└── README.md                 # תיעוד זה
```

---

## 🧪 בדיקות

הרץ את הדוגמאות:
```bash
node standardize-text.js
```

או בדוק עם דוגמאות מוכנות:
```javascript
const dirtyExamples = require('./EXEMPTS/test-dirty-text.js');
const { standardizeText } = require('./standardize-text.js');

console.log(standardizeText(dirtyExamples.vehicleWithSpaces));
console.log(standardizeText(dirtyExamples.realistic));
```

---

## ✨ תכונות מיוחדות

### 1. זיהוי חכם של מספרי רכב
מזהה ומנקה מספרי רכב גם כשיש:
- רווחים: `"741 - 69 - 103"`
- תווים בלתי נראים: `"741\u200B-69-103"`
- מקפים שונים: `"741–69—103"`

### 2. הימנעות מניקוי יתר
לא משנה מספרים שהם לא מספרי רכב:
- `"12 345"` → `"12345"` ✅
- `"741 69 103"` → `"741-69-103"` ✅ (מזהה כרכב!)

### 3. תמיכה בעברית
מטפל בתווים עבריים מיוחדים:
- Gershayim: `״` → `"`
- Geresh: `׳` → `'`
- Maqaf: `־` → `-`

---

## 🎯 מקרי שימוש

1. **לפני חיפוש רכבים** - נקה את AZURE_TEXT
2. **לפני חיפוש מספרים** - נקה מרווחים
3. **לפני השוואת strings** - נרמל הכל
4. **לפני שמירה ב-DB** - הסר תווים בעייתיים

---

## 📝 גרסה

**v1.0** - 05.11.2025
- יצירה ראשונית
- תמיכה בכל סוגי הניקוי
- 3 מצבים: quick, deep, vehicles
- 10 דוגמאות מוכנות

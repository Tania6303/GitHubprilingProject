# 🆕 AZURE_TEXT_CLEAN - תמיכה בטקסט מנורמל

## גרסה 1.1 (05.11.25 18:50)

---

## 📋 מה השתנה?

Production Invoice כעת תומך ב-**input נוסף** בשם `AZURE_TEXT_CLEAN`.

זהו טקסט מנורמל (נקי) שעבר דרך **Text Standardization** לפני שהגיע לכאן.

---

## 🚀 איך להשתמש?

### **Workflow מומלץ ב-Make.com:**

```
Azure OCR
   ↓
   ├─→ AZURE_RESULT
   └─→ AZURE_TEXT (גולמי)
       ↓
Text Standardization (מודול נפרד)
       ↓
   AZURE_TEXT_CLEAN (נקי)
       ↓
Production Invoice
   ├─→ AZURE_RESULT
   ├─→ AZURE_TEXT (גולמי - גיבוי)
   ├─→ AZURE_TEXT_CLEAN (נקי) ← חדש!
   ├─→ learned_config
   ├─→ docs_list
   └─→ import_files
```

---

## 🔧 הגדרה ב-Make.com

### **מודול 1: Azure OCR**
- Output: `AZURE_RESULT`, `AZURE_TEXT`

### **מודול 2: Text Standardization**
```javascript
Input:
  input = {{1.AZURE_TEXT}}

Output:
  // הקוד מחזיר string נקי
```

### **מודול 3: Production Invoice**
```javascript
Input:
  AZURE_RESULT: {{1.AZURE_RESULT}}
  AZURE_TEXT: {{1.AZURE_TEXT}}
  AZURE_TEXT_CLEAN: {{2.result}}  ← חדש!
  learned_config: {...}
  docs_list: {...}
  import_files: {...}
```

---

## ✅ מה זה נותן?

1. **חיפוש רכבים מדויק יותר** - בלי רווחים מיותרים
   - לפני: `419  -  29  -  702` (לא נמצא)
   - אחרי: `419-29-702` (נמצא!) ✅

2. **details נקי** - בלי תווים בלתי נראים וכפל רווחים

3. **regex עובד טוב יותר** - כל חיפוש טקסט משתמש בגרסה הנקייה

---

## 🔄 Backward Compatible

**הקוד עדיין עובד בלי AZURE_TEXT_CLEAN!**

אם לא מספקים `AZURE_TEXT_CLEAN`, הקוד משתמש ב-`AZURE_TEXT` כרגיל.

```javascript
// בתוך הקוד:
const azureTextClean = inputData.AZURE_TEXT_CLEAN || "";
const azureTextRaw = inputData.AZURE_TEXT || "";
const azureText = azureTextClean || azureTextRaw;  // עדיפות לנקי
```

---

## 📊 לוגים

הקוד מדפיס לוג שמציין מאיפה הגיע הטקסט:

```
DEBUG: azureText source: CLEAN length: 1234
```

או:

```
DEBUG: azureText source: RAW length: 1234
```

---

## ⚠️ חשוב!

- **אל תשני את AZURE_TEXT** - תשאירי אותו כגולמי (גיבוי)
- **הוסיפי רק AZURE_TEXT_CLEAN** כ-input נוסף
- **Text Standardization צריך לרוץ קודם** - מודול נפרד

---

## 📝 דוגמה מלאה

```javascript
// Azure OCR Output:
AZURE_TEXT = `עוסק מורשה
558117016
מספר רכב:  419  -  29  -  702`

// Text Standardization Output:
AZURE_TEXT_CLEAN = `עוסק מורשה
558117016
מספר רכב: 419-29-702`

// Production Invoice Input:
{
  AZURE_RESULT: {...},
  AZURE_TEXT: "עוסק מורשה\n558117016\n...",      // גולמי
  AZURE_TEXT_CLEAN: "עוסק מורשה\n558117016\n...", // נקי
  learned_config: {...},
  ...
}
```

---

## ✨ תוצאה

- רכב `419-29-702` נמצא! ✅
- עוסק מורשה `558117016` לא השתנה! ✅
- הכל עובד חלק! ✅

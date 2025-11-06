# ⚠️ כללי בדיקות - חובה לקרוא לפני בדיקת תקלות!

## 📁 מיקום קבצי בדיקה

**כלל ברזל:** קבצי הבדיקה (input/output) **תמיד** נמצאים בספריית `EXEMPTS` של הקוד הרלוונטי!

### מבנה ספריות:

```
MakeCode/
├── Processing Invoice/
│   ├── v4.2-COMPLETE.js
│   └── EXEMPTS/                    ← קבצי בדיקה כאן!
│       ├── input-[timestamp].js
│       └── output-[timestamp].js
│
├── Production Invoice/
│   ├── v1.0-production.js
│   └── EXEMPTS/                    ← קבצי בדיקה כאן!
│       ├── input-[timestamp].js
│       └── output-[timestamp].js
│
└── SupplierDataLearning/
    ├── [code].js
    └── EXEMPTS/                    ← קבצי בדיקה כאן!
        ├── input-[timestamp].js
        └── output-[timestamp].js
```

---

## 🔍 איך למצוא את הקובץ הנכון לבדיקה?

### ✅ תמיד קח את הקובץ העדכני ביותר!

**פקודה:**
```bash
ls -lt "MakeCode/[MODULE_NAME]/EXEMPTS" | head -5
```

**או בפירוט מלא:**
```bash
find "MakeCode/[MODULE_NAME]/EXEMPTS" -type f -printf '%T@ %Tc %p\n' | sort -rn | head -5
```

---

## 📋 Workflow לבדיקת תקלות:

### כשהמשתמש אומר: "יש בעיה" / "עדיין לא עובד"

1. **זהה את המודול הנוכחי:**
   - Processing Invoice? → `MakeCode/Processing Invoice/EXEMPTS`
   - Production Invoice? → `MakeCode/Production Invoice/EXEMPTS`
   - SupplierDataLearning? → `MakeCode/SupplierDataLearning/EXEMPTS`

2. **מצא את הקבצים העדכניים:**
   ```bash
   ls -lt "MakeCode/[MODULE]/EXEMPTS" | head -5
   ```

3. **קרא את הקבצים לפי סדר עדכניות:**
   - הקובץ הראשון ברשימה = העדכני ביותר ✅
   - בדוק timestamp בשם הקובץ
   - בדוק גם את ה-processing_timestamp בתוך output

4. **אל תשאל את המשתמש "איפה הקבצים?"**
   - אתה יודע: `EXEMPTS/`
   - פשוט תמצא ותקרא אותם!

---

## 🎯 מודול נוכחי: Production Invoice

**כרגע עובדים על:** `MakeCode/Production Invoice/`

**ספריית בדיקה:** `MakeCode/Production Invoice/EXEMPTS/`

**קבצים לבדוק:**
```bash
ls -lt "MakeCode/Production Invoice/EXEMPTS" | head -5
```

---

## 🔄 עדכון מודול נוכחי

**כשעוברים למודול אחר**, עדכן את החלק "מודול נוכחי" למעלה!

דוגמאות:
- אם עוברים ל-Processing Invoice → `MakeCode/Processing Invoice/EXEMPTS/`
- אם עוברים ל-SupplierDataLearning → `MakeCode/SupplierDataLearning/EXEMPTS/`

---

## 📊 זיהוי קובץ עדכני

### לפי שם קובץ:
```
input-14:11-2025-11-05.js                           ← פורמט ישן
input-14:11-2025-11-05-0.8493534474825979.js       ← פורמט חדש (עם random)
```

### לפי תאריך קובץ (filesystem):
```bash
ls -lt  # מיון לפי modification time
```

### לפי processing_timestamp (בתוך output):
```json
{
  "metadata": {
    "processing_timestamp": "2025-11-05T12:28:54.112Z"  ← זה הזמן האמיתי!
  }
}
```

**חשוב:** ה-timestamp בשם הקובץ עשוי להיות שונה מה-processing_timestamp הפנימי!
**תמיד תבדוק את ה-processing_timestamp הפנימי** כדי לדעת מתי הקוד רץ בפועל.

---

## 💡 דוגמה מהחיים האמיתיים:

```bash
# 1. מצא קבצים
$ ls -lt "MakeCode/Production Invoice/EXEMPTS" | head -5
-rw-r--r-- 1 root root 2431 Nov  5 12:31 input-14:11-2025-11-05-0.8493534474825979.js
-rw-r--r-- 1 root root 2431 Nov  5 12:31 output-14:11-2025-11-05-0.36179700669836934.js
-rw-r--r-- 1 root root 2431 Nov  5 12:25 input-14:11-2025-11-05.js
-rw-r--r-- 1 root root 2431 Nov  5 12:25 output-14:11-2025-11-05.js

# 2. קרא את הקובץ העדכני
$ node -e "const fs = require('fs'); ..."

# 3. בדוק processing_timestamp
"processing_timestamp": "2025-11-05T12:28:54.112Z"

# 4. השווה לגרסת הקוד
"version": "1.0 - 05.11.25.14:40"

# 5. אם processing_timestamp < code version → הרצה ישנה!
```

---

## ⚠️ אזהרות חשובות:

1. **אל תניח** שהקובץ העדכני בשם הוא העדכני בתוכן!
   - תמיד תבדוק את ה-processing_timestamp הפנימי

2. **אל תשאל** "איפה הקבצים?"
   - תמיד ב-EXEMPTS/

3. **השווה timestamps:**
   - processing_timestamp < code version → הרצה ישנה
   - processing_timestamp > code version → הרצה חדשה ✅

---

📅 נוצר: 2025-11-05
🎯 מטרה: למנוע בזבוז זמן בשאלות "איפה הקבצים?" וללמוד לקחת אותם אוטומטית

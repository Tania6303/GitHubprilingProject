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

### ⚠️ חשוב מאוד: תמיד חפש לפי GIT COMMIT DATE!

**❌ אל תסתמך על:**
- `ls -lt` (modification time)
- שם הקובץ
- filesystem timestamps

**✅ השתמש ב-git log:**
```bash
cd "MakeCode/[MODULE]/EXEMPTS" && git log --name-only --pretty=format:"%H %ci %s" --all -- . | head -50
```

**דוגמה:**
```bash
cd "MakeCode/Production Invoice/EXEMPTS" && git log --name-only --pretty=format:"%ci %s" --all -- . | head -20
```

זה יראה לך:
```
2025-11-06 14:33:47 +0200 יצירה אוטומטית מתוך MakeCode
input-14:11-2025-11-06-0.7707135552764477.js

2025-11-06 14:33:46 +0200 יצירה אוטומטית מתוך MakeCode
output-14:11-2025-11-06-0.5093925310866825.js
```

**הקבצים עם התאריך האחרון ביותר = העדכניים!**

---

## 📋 Workflow לבדיקת תקלות:

### כשהמשתמש אומר: "יש בעיה" / "עדיין לא עובד"

1. **זהה את המודול הנוכחי:**
   - Processing Invoice? → `MakeCode/Processing Invoice/EXEMPTS`
   - Production Invoice? → `MakeCode/Production Invoice/EXEMPTS`
   - SupplierDataLearning? → `MakeCode/SupplierDataLearning/EXEMPTS`

2. **⚠️ מצא את הקבצים העדכניים לפי GIT LOG:**
   ```bash
   cd "MakeCode/[MODULE]/EXEMPTS" && git log --name-only --pretty=format:"%ci %s" --all -- . | head -20
   ```

   **קח את הקבצים עם התאריך האחרון ביותר!**

3. **קרא את הקבצים:**
   - הקבצים עם commit date האחרון = העדכניים ביותר ✅
   - **לא** לפי שם הקובץ!
   - **לא** לפי modification time!

4. **אל תשאל את המשתמש "איפה הקבצים?"**
   - אתה יודע: `EXEMPTS/`
   - פשוט תמצא ותקרא אותם עם git log!

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

## 📚 עדכון תיעוד אחרי בדיקה

### ⚠️ חוק ברזל:
**אחרי כל בדיקה או תיקון - עדכן את התיעוד המסכם!**

### 📋 Checklist אחרי בדיקה וקבלת OK מהמשתמש:

1. **עדכנתי את COMPLETE-SYSTEM-DOCUMENTATION.html?**
   - [ ] הוספתי את התיקון לרשימת "תיקונים אחרונים"
   - [ ] עדכנתי את הגרסה
   - [ ] תיעדתי את הבעיה ואת הפתרון

2. **עדכנתי את README של המודול?**
   - [ ] הוספתי שורת גרסה חדשה
   - [ ] רשמתי מה תוקן
   - [ ] הוספתי דוגמה אם רלוונטי

3. **יצרתי test case?**
   - [ ] השארתי את הקבצים ב-EXEMPTS כדוגמה
   - [ ] רשמתי את השם והתאריך
   - [ ] הוספתי הערה מה זה בודק

### 🎯 דוגמה - מה לעדכן אחרי תיקון:

```markdown
אם תיקנתי bug ב-DETAILS (v1.7.2):

1. COMPLETE-SYSTEM-DOCUMENTATION.html:
   - סעיף Module 3 → info-box:
     "גרסה נוכחית: v1.7.2
      תיקונים אחרונים:
      • DETAILS לפי שורה 1 PDES ✅"

2. Production Invoice/README.md:
   - "## עדכונים אחרונים"
   - "### 6 נובמבר 2025 - v1.7.2"
   - "תיקון: DETAILS עכשיו לפי PDES של שורה 1"

3. EXEMPTS:
   - השארתי input-12:11-2025-11-06...js
   - השארתי DATA_ORIG...js
   - הוספתי test-vehicle.js
```

### 💡 למה זה חשוב?

- **למשתמש הבא (כולל אתה בעתיד)** יהיה נוח לראות מה השתנה
- **התיעוד יישאר עדכני** ולא יישכח
- **הדוגמאות ב-EXEMPTS** ישמשו כרגרסיה testing

---

📅 נוצר: 2025-11-05
📅 עדכון: 2025-11-06
🎯 מטרה: למנוע בזבוז זמן בשאלות "איפה הקבצים?" + שמירה על תיעוד עדכני

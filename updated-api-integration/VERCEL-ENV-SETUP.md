# הגדרת משתני סביבה ב-Vercel
## Azure OpenAI as Primary + Claude as Fallback

---

## 🎯 סיכום השינויים

המערכת עודכנה להשתמש ב-**Azure OpenAI כ-LLM ראשי** ו-**Claude כגיבוי בלבד**.

### לוגיקה חדשה:
```
InvokeLLM → Azure OpenAI (ראשי) ✅
         ↓ (אם נכשל)
         → Claude (גיבוי) ⚠️

ExtractDataFromUploadedFile → Azure Form Recognizer ✅
```

---

## 📋 משתני סביבה נדרשים ב-Vercel

### 1️⃣ Azure OpenAI (חדש! - ראשי)

| משתנה | ערך לדוגמה | הסבר |
|-------|------------|------|
| `VITE_AZURE_OPENAI_ENDPOINT` | `https://YOUR-RESOURCE.openai.azure.com/` | כתובת ה-endpoint של Azure OpenAI |
| `VITE_AZURE_OPENAI_KEY` | `abc123def456...` | API Key של Azure OpenAI |
| `VITE_AZURE_OPENAI_DEPLOYMENT` | `gpt-4o` | שם ה-deployment שיצרת ב-Azure |
| `VITE_AZURE_OPENAI_API_VERSION` | `2024-02-15-preview` | גרסת API (אופציונלי, ברירת מחדל: 2024-02-15-preview) |

### 2️⃣ Azure Form Recognizer (קיים - ממשיך לעבוד)

| משתנה | ערך לדוגמה | הסבר |
|-------|------------|------|
| `VITE_AZURE_ENDPOINT` | `https://YOUR-RESOURCE.cognitiveservices.azure.com/` | כתובת Azure Form Recognizer |
| `VITE_AZURE_KEY` | `xyz789...` | API Key של Form Recognizer |

### 3️⃣ Claude (גיבוי בלבד - אופציונלי)

| משתנה | ערך לדוגמה | הסבר |
|-------|------------|------|
| `VITE_CLAUDE_API_KEY` | `sk-ant-...` | API Key של Claude (ישמש רק אם Azure נכשל) |

### 4️⃣ Supabase (קיים - ממשיך לעבוד)

| משתנה | ערך לדוגמה | הסבר |
|-------|------------|------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | כתובת הפרויקט ב-Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Public API Key של Supabase |

---

## 🔧 איך להגדיר ב-Vercel?

### שלב 1: כניסה ל-Vercel Dashboard
1. היכנס ל-https://vercel.com
2. בחר את הפרויקט שלך (PRILINQ_NEW)
3. לחץ על **Settings** → **Environment Variables**

### שלב 2: הוספת משתנים חדשים
לחץ על **Add New** והוסף כל משתנה:

#### Azure OpenAI Endpoint
```
Name:  VITE_AZURE_OPENAI_ENDPOINT
Value: https://YOUR-RESOURCE-NAME.openai.azure.com/
Environment: Production, Preview, Development
```

#### Azure OpenAI Key
```
Name:  VITE_AZURE_OPENAI_KEY
Value: [המפתח שלך מ-Azure Portal]
Environment: Production, Preview, Development
```

#### Azure OpenAI Deployment
```
Name:  VITE_AZURE_OPENAI_DEPLOYMENT
Value: gpt-4o
Environment: Production, Preview, Development
```

### שלב 3: שמור ופרוס מחדש
1. לחץ **Save**
2. Vercel יבקש **Redeploy** - לחץ **Redeploy**
3. המערכת תעלה מחדש עם המשתנים החדשים

---

## 🔍 איך למצוא את הערכים ב-Azure Portal?

### Azure OpenAI Endpoint ו-Key:
1. היכנס ל-https://portal.azure.com
2. חפש את ה-Resource שלך: **Azure OpenAI**
3. בתפריט הצד: **Keys and Endpoint**
4. העתק:
   - **Endpoint** → `VITE_AZURE_OPENAI_ENDPOINT`
   - **KEY 1** → `VITE_AZURE_OPENAI_KEY`

### Azure OpenAI Deployment Name:
1. באותו Resource, לך ל-**Model deployments**
2. לחץ **Manage Deployments** (יפתח ב-Azure OpenAI Studio)
3. תראה רשימת Deployments
4. העתק את **Deployment name** (למשל: `gpt-4o`, `gpt-35-turbo`)

### Azure Form Recognizer:
1. חפש את ה-Resource: **Form Recognizer** / **Document Intelligence**
2. **Keys and Endpoint**
3. העתק:
   - **Endpoint** → `VITE_AZURE_ENDPOINT`
   - **KEY 1** → `VITE_AZURE_KEY`

---

## ✅ בדיקה שהכל עובד

### 1. בדוק ב-Console
פתח את הקונסול בדפדפן (F12) ובדוק:
- ✅ אין אזהרות על משתנים חסרים
- ✅ הודעות מסוג: `🎯 InvokeLLM: Trying Azure OpenAI first...`
- ✅ הודעות מסוג: `✅ Azure OpenAI succeeded`

### 2. בדוק QuickUpload
1. העלה מסמך דרך QuickUpload
2. וודא שהטקסט מנותח ומוחזר
3. בקונסול תראה שהשימוש ב-Azure OpenAI

### 3. אם יש בעיה
אם Azure נכשל, המערכת תעבור אוטומטית ל-Claude:
```
⚠️ Azure OpenAI failed, falling back to Claude...
✅ Claude fallback succeeded
```

---

## 🛠️ Troubleshooting

### שגיאה: "Azure OpenAI credentials not configured"
**פתרון:**
- ודא ש-`VITE_AZURE_OPENAI_ENDPOINT` מוגדר
- ודא ש-`VITE_AZURE_OPENAI_KEY` מוגדר
- Redeploy את הפרויקט ב-Vercel

### שגיאה: "Azure OpenAI API error (401)"
**פתרון:**
- המפתח (`VITE_AZURE_OPENAI_KEY`) לא תקין
- בדוק שהעתקת את KEY 1 מ-Azure Portal
- ודא שה-Resource לא נחסם

### שגיאה: "Azure OpenAI API error (404)"
**פתרון:**
- שם ה-Deployment (`VITE_AZURE_OPENAI_DEPLOYMENT`) לא נכון
- בדוק ב-Azure OpenAI Studio את שם ה-Deployment המדויק
- ודא שה-Deployment פעיל (Status: Succeeded)

### שגיאה: "Both Azure and Claude failed"
**פתרון:**
- בעיית רשת או הרשאות
- בדוק שה-API Keys תקפים
- בדוק שה-Endpoints נכונים
- בדוק שה-Subscription ב-Azure פעיל

---

## 📊 עדיפויות שימוש

| תרחיש | Provider שישמש |
|-------|----------------|
| 🎯 **נורמלי** | Azure OpenAI |
| ⚠️ **Azure נכשל** | Claude (גיבוי אוטומטי) |
| ❌ **שניהם נכשלו** | שגיאה למשתמש |

---

## 📝 קבצים שצריך להעתיק ל-PRILINQ_NEW

לאחר הגדרת משתני הסביבה ב-Vercel, העתק את הקבצים הבאים:

```
updated-api-integration/azureClient.js     →  src/api/azureClient.js
updated-api-integration/integrations.js    →  src/api/integrations.js
```

---

## 💡 טיפים

1. **בדוק עלויות**: Azure OpenAI עובד לפי tokens. מומלץ להגדיר Usage Limit ב-Azure
2. **מעקב שימוש**: ב-Azure Portal → Azure OpenAI → Metrics
3. **גיבוי Claude**: אם רוצה לחסוך בעלויות, אפשר להשאיר Claude כגיבוי בלבד
4. **API Version**: אם יוצאת גרסה חדשה של Azure OpenAI API, עדכן את `VITE_AZURE_OPENAI_API_VERSION`

---

## 📞 תמיכה

אם יש בעיות:
1. בדוק את הקונסול בדפדפן (F12)
2. בדוק את ה-Logs ב-Vercel Dashboard
3. ודא שכל משתני הסביבה מוגדרים נכון
4. נסה Redeploy

---

**עודכן:** 2025-11-08
**גרסה:** 1.0
**סטטוס:** ✅ מוכן לייצור

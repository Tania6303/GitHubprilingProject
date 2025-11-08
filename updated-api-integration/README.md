# 🔄 API Integration Update - Azure OpenAI Primary

## סיכום השינוי

עדכון מערכת QuickUpload להשתמש ב-**Azure OpenAI כ-LLM ראשי** במקום Claude.

---

## 📁 קבצים מעודכנים

### 1. `azureClient.js`
**שינויים:**
- ✅ הוספת פונקציה `invokeAzureOpenAI()` - תמיכה מלאה ב-Azure OpenAI
- ✅ תמיכה בקבצים (images/PDFs) עם Vision
- ✅ תמיכה ב-JSON Schema response
- ✅ תמיכה ב-system prompts
- ✅ שמירה על Azure Form Recognizer הקיים

### 2. `integrations.js`
**שינויים:**
- ✅ `InvokeLLM()` - נסיון Azure OpenAI קודם, Claude כגיבוי
- ✅ `ChatWithClaude()` - נסיון Azure OpenAI קודם, Claude כגיבוי
- ✅ לוגים ברורים: `🎯`, `✅`, `⚠️`, `❌`
- ✅ דיווח אם נעשה שימוש בגיבוי (fallback_used: true)

### 3. `VERCEL-ENV-SETUP.md`
- 📋 מדריך מפורט להגדרת משתני סביבה
- 📋 הסברים איך למצוא ערכים ב-Azure Portal
- 📋 Troubleshooting נפוץ

---

## 🚀 איך להשתמש

### שלב 1: העתק קבצים
העתק את הקבצים המעודכנים למאגר `PRILINQ_NEW`:

```bash
# במאגר PRILINQ_NEW
cp updated-api-integration/azureClient.js     src/api/azureClient.js
cp updated-api-integration/integrations.js    src/api/integrations.js
```

### שלב 2: הגדר משתני סביבה ב-Vercel
עקוב אחר המדריך ב-`VERCEL-ENV-SETUP.md`

משתנים חדשים נדרשים:
- `VITE_AZURE_OPENAI_ENDPOINT`
- `VITE_AZURE_OPENAI_KEY`
- `VITE_AZURE_OPENAI_DEPLOYMENT`

### שלב 3: Deploy
Vercel יבקש Redeploy אוטומטית אחרי שמירת משתני הסביבה.

---

## 🧪 בדיקה

### QuickUpload
1. העלה מסמך דרך QuickUpload
2. פתח Console (F12)
3. חפש:
   ```
   🎯 InvokeLLM: Trying Azure OpenAI first...
   ✅ Azure OpenAI succeeded
   ```

### אם Azure נכשל
המערכת תעבור אוטומטית ל-Claude:
```
🎯 InvokeLLM: Trying Azure OpenAI first...
⚠️ Azure OpenAI failed, falling back to Claude...
✅ Claude fallback succeeded
```

---

## 📊 התנהגות חדשה

| פעולה | Provider ראשי | Fallback |
|-------|---------------|----------|
| `InvokeLLM` | Azure OpenAI | Claude |
| `ChatWithClaude` | Azure OpenAI | Claude |
| `ExtractDataFromUploadedFile` | Azure Form Recognizer | - |

---

## ⚙️ משתני סביבה - רשימה מלאה

### Azure OpenAI (חדש)
```
VITE_AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com/
VITE_AZURE_OPENAI_KEY=your-key-here
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-4o
VITE_AZURE_OPENAI_API_VERSION=2024-02-15-preview  # אופציונלי
```

### Azure Form Recognizer (קיים)
```
VITE_AZURE_ENDPOINT=https://YOUR-RESOURCE.cognitiveservices.azure.com/
VITE_AZURE_KEY=your-key-here
```

### Claude (גיבוי)
```
VITE_CLAUDE_API_KEY=sk-ant-your-key-here
```

### Supabase (קיים)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here
```

---

## 🔍 מה לא השתנה

- ✅ QuickUpload.jsx - ללא שינוי
- ✅ claudeClient.js - ללא שינוי
- ✅ supabaseClient.js - ללא שינוי
- ✅ כל שאר הקומפוננטים - ללא שינוי

**רק שני קבצים שונו:** `azureClient.js` ו-`integrations.js`

---

## 💰 עלויות

### Azure OpenAI
- מחיר לפי tokens (input + output)
- כדאי להגדיר **Usage Limit** ב-Azure Portal
- מעקב: Azure Portal → Azure OpenAI → Metrics

### Claude (גיבוי)
- ישמש רק אם Azure נכשל
- עלות מינימלית (רק במקרי חירום)

---

## 🛡️ Fallback Logic

```javascript
async function InvokeLLM({ prompt, ...options }) {
  try {
    // 1. Try Azure OpenAI (PRIMARY)
    return await invokeAzureOpenAI(prompt, options);
  } catch (azureError) {
    // 2. Try Claude (FALLBACK)
    try {
      return await invokeLLM(prompt, options);
    } catch (claudeError) {
      // 3. Both failed - return error
      return { status: 'failed', details: '...' };
    }
  }
}
```

---

## 📝 קבצים בתיקייה

```
updated-api-integration/
├── azureClient.js           # ✅ Azure Form Recognizer + Azure OpenAI
├── integrations.js          # ✅ Azure קודם, Claude גיבוי
├── VERCEL-ENV-SETUP.md      # 📋 מדריך הגדרת Vercel
└── README.md                # 📄 המסמך הזה
```

---

## ✅ Checklist

- [ ] העתק `azureClient.js` ל-`src/api/`
- [ ] העתק `integrations.js` ל-`src/api/`
- [ ] הוסף משתני סביבה ב-Vercel (ראה VERCEL-ENV-SETUP.md)
- [ ] Redeploy ב-Vercel
- [ ] בדוק QuickUpload עם מסמך
- [ ] ודא בקונסול שAzure OpenAI משמש

---

## 🎯 מטרה

**Azure = מרכזי (ראשי)**
**Claude = גיבוי בלבד**

המערכת תשתמש ב-Azure OpenAI לכל פעולות LLM, ותעבור ל-Claude רק במקרה של בעיה.

---

**תאריך:** 2025-11-08
**גרסה:** 1.0
**סטטוס:** ✅ מוכן ליישום

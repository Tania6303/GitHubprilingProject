# Base44 Integration למערכת עיבוד חשבוניות

## 📋 מה זה?

שכבת אינטגרציה בין **Base44** (פלטפורמת no-code) לבין **מערכת עיבוד החשבוניות הקיימת** שלך.

---

## 🎯 3 אופציות מימוש

### ✅ אופציה 1: Base44 UI + Azure OCR (מומלץ!)

**למה זה הכי טוב:**
- ✅ ממשיכים עם Azure OCR הקיים (הכי מדויק!)
- ✅ Base44 משמש רק כממשק UI/Dashboard
- ✅ שינוי מינימלי בקוד

```
┌─────────────────────────────────┐
│  Base44 Web Application         │
│  ┌──────────┐  ┌──────────┐    │
│  │ העלאה    │  │ Dashboard │    │
│  └────┬─────┘  └──────────┘    │
└───────┼─────────────────────────┘
        │ file_url, metadata
        ↓
┌─────────────────────────────────┐
│  Azure Form Recognizer          │ ← הקוד הקיים שלך!
│  (OCR + Document Intelligence)  │
└───────┬─────────────────────────┘
        │ AZURE_RESULT
        ↓
┌─────────────────────────────────┐
│  AzureInvoiceProcessor v2.0     │
└───────┬─────────────────────────┘
        │
        ↓
┌─────────────────────────────────┐
│  Processing/Production Invoice  │
└───────┬─────────────────────────┘
        │
        ↓
┌─────────────────────────────────┐
│  Priority ERP                   │
└─────────────────────────────────┘
```

**עלות:** Azure OCR בלבד (~$1.50 ל-1000 עמודים)

---

### 🔄 אופציה 2: Base44 + DigiParser

**מתי להשתמש:**
- רוצים להיפטר מ-Azure
- צריכים תמחור פשוט יותר
- DigiParser מספיק טוב לצרכים שלכם

```
┌─────────────────────────────────┐
│  Base44 + DigiParser            │
│  (OCR מובנה)                    │
└───────┬─────────────────────────┘
        │ Converted to Azure format
        ↓
    הקוד הקיים שלך
```

**צריך לעשות:**
1. הוסף המרה `convertDigiParserToAzureFormat()`
2. שינוי קל ב-AzureInvoiceProcessor

**עלות:** DigiParser (~$0.10 למסמך)

---

### 🤖 אופציה 3: Base44 + OpenAI Vision

**מתי להשתמש:**
- צריכים גמישות מקסימלית
- רוצים תמיכה בעברית מושלמת
- חשבוניות מורכבות/לא סטנדרטיות

```
┌─────────────────────────────────┐
│  Base44 + OpenAI Vision API     │
│  (gpt-4o vision)                │
└───────┬─────────────────────────┘
        │ JSON מובנה
        ↓
    הקוד הקיים שלך
```

**יתרונות:**
- ✅ הבנה מושלמת של עברית
- ✅ זיהוי חכם של שדות לא סטנדרטיים
- ✅ תמיכה בהנחיות מותאמות אישית

**עלות:** OpenAI Vision (~$0.01 לתמונה)

---

## 🚀 התקנה

### שלב 1: התקן תלויות

```bash
npm install node-fetch dotenv
```

### שלב 2: הגדר משתני סביבה

צור קובץ `.env`:

```bash
# Azure (אם משתמשים באופציה 1)
AZURE_OCR_KEY=your_azure_key_here
AZURE_OCR_ENDPOINT=https://prilinqdocai.cognitiveservices.azure.com

# DigiParser (אם משתמשים באופציה 2)
DIGIPARSER_API_KEY=your_digiparser_key_here

# OpenAI (אם משתמשים באופציה 3)
OPENAI_API_KEY=your_openai_key_here

# Base44
BASE44_APP_ID=your_app_id_here
BASE44_API_KEY=your_api_key_here
```

### שלב 3: צור אפליקציה ב-Base44

1. היכנס ל-https://app.base44.com
2. צור אפליקציה חדשה: "Invoice Management System"
3. צור Entity: **"Invoice"** עם השדות הבאים:

```javascript
Invoice Entity:
├── invoice_id (Text, Primary Key)
├── file_url (File Upload)
├── supplier_name (Text)
├── status (Select: pending, processing, completed, error)
├── extracted_data (JSON)
├── processed_at (DateTime)
└── ocr_provider (Text)
```

4. הוסף **Webhook**:
   - Trigger: "When Invoice created"
   - Action: "Call External API"
   - URL: `https://your-server.com/webhook/base44`

---

## 💻 דוגמת שימוש

### אופציה 1: עם Azure OCR (מומלץ)

```javascript
const { processInvoiceWithAzure } = require('./base44-invoice-wrapper');

// קלט מ-Base44
const base44Data = {
    file_url: 'https://base44-storage.com/invoices/invoice123.pdf',
    invoice_id: 'INV-2025-001',
    supplier_name: 'מוסך ABC'
};

// עיבוד
const result = await processInvoiceWithAzure(base44Data);

console.log(result);
// {
//   status: 'success',
//   invoice_id: 'INV-2025-001',
//   extracted_data: {
//     InvoiceId: '...',
//     InvoiceDate: '...',
//     Items: [...]
//   },
//   metadata: {
//     supplier: 'מוסך ABC',
//     ocr_provider: 'Azure Form Recognizer'
//   }
// }
```

### אופציה 2: עם DigiParser

```javascript
const { processInvoiceWithDigiParser } = require('./base44-invoice-wrapper');

const result = await processInvoiceWithDigiParser(base44Data);
```

### אופציה 3: עם OpenAI Vision

```javascript
const { processInvoiceWithOpenAI } = require('./base44-invoice-wrapper');

const result = await processInvoiceWithOpenAI(base44Data);
```

---

## 🌐 הגדרת Webhook Server

### Express.js Server

```javascript
const express = require('express');
const { handleBase44Webhook } = require('./base44-invoice-wrapper');

const app = express();
app.use(express.json());

app.post('/webhook/base44', async (req, res) => {
    const result = await handleBase44Webhook(req);
    res.status(result.statusCode).json(JSON.parse(result.body));
});

app.listen(3000, () => {
    console.log('Webhook server running on port 3000');
});
```

---

## 📊 השוואת אופציות

| תכונה | Azure OCR | DigiParser | OpenAI Vision |
|---|---|---|---|
| **דיוק** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **עלות** | $1.50/1000 | $0.10/doc | $0.01/image |
| **תמיכה בעברית** | מצוין | טוב | מושלם |
| **מהירות** | מהיר | מהיר | בינוני |
| **שינוי קוד** | ❌ אפס | ⚠️ קל | ⚠️ בינוני |
| **גמישות** | נמוכה | בינונית | גבוהה מאוד |

---

## 🎨 דוגמת UI ב-Base44

### 1. דף העלאת חשבונית

```
┌─────────────────────────────────────────┐
│  📄 העלאת חשבונית חדשה                  │
├─────────────────────────────────────────┤
│                                         │
│  🏢 שם ספק: [________________]          │
│                                         │
│  📁 קובץ חשבונית:                       │
│     [גרור קובץ או לחץ להעלאה]           │
│                                         │
│  ⚙️ בחר OCR Provider:                   │
│     ○ Azure Form Recognizer (מומלץ)     │
│     ○ DigiParser                        │
│     ○ OpenAI Vision                     │
│                                         │
│     [שלח לעיבוד]                        │
└─────────────────────────────────────────┘
```

### 2. Dashboard

```
┌─────────────────────────────────────────┐
│  📊 Dashboard - חשבוניות                │
├─────────────────────────────────────────┤
│  סה"כ חשבוניות: 1,247                   │
│  ממתינות: 12  |  בעיבוד: 3  |  הושלמו: 1,232
│                                         │
│  📋 חשבוניות אחרונות:                   │
│  ┌───────────────────────────────────┐  │
│  │ INV-001 | מוסך ABC | ₪2,500       │  │
│  │ Status: ✅ Completed               │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ INV-002 | ספק XYZ | ₪1,200        │  │
│  │ Status: 🔄 Processing              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### בעיה: Base44 לא מצליח לקרוא ל-webhook

**פתרון:**
1. בדוק ש-webhook URL נגיש מהאינטרנט (לא localhost)
2. השתמש ב-ngrok לפיתוח: `ngrok http 3000`
3. ודא שה-webhook מוגדר ב-Base44

### בעיה: Azure OCR timeout

**פתרון:**
- הגדל את `maxAttempts` ב-`pollAzureResult()`
- בדוק שה-API Key תקף

### בעיה: DigiParser לא מחזיר נתונים נכונים

**פתרון:**
- בדוק את ה-parser_id ב-DigiParser dashboard
- שפר את `convertDigiParserToAzureFormat()`

---

## 📚 משאבים נוספים

- [Base44 Documentation](https://docs.base44.com)
- [Azure Form Recognizer Docs](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
- [DigiParser API](https://www.digiparser.com/api-docs)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)

---

## 💡 המלצה שלי

**התחילי עם אופציה 1 (Base44 UI + Azure OCR):**

✅ **למה?**
1. אין צורך לשנות את הקוד הקיים
2. Azure OCR כבר עובד ומדויק
3. Base44 מוסיף רק UI/UX משופר
4. אפשר להוסיף אחר כך DigiParser/OpenAI

✅ **איך?**
1. צרי App ב-Base44 (10 דקות)
2. הוסיפי webhook (5 דקות)
3. הריצי את הקוד הזה (5 דקות)
4. **סיימת!** יש לך ממשק מקצועי

---

**גרסה:** 1.0
**תאריך:** 4 נובמבר 2025
**מחבר:** Claude Code

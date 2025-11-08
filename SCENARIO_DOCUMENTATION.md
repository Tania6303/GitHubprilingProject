# תיעוד התהליכים (Scenarios) - PriLingQ Invoice Processing

## סקירה כללית

מערכת עיבוד חשבוניות אוטומטית המשלבת:
- קליטת נתונים דרך webhook
- ניתוח PDF דרך Azure Form Recognizer
- עיבוד AI לזיהוי ספקים
- שמירת נתונים בPriority וBASE44

---

## 1. S2 - SUP_LERN_CODE (Processing Invoice)

### מטרת התהליך
עיבוד וניתוח קונפיגורציה של ספקים. התהליך מקבל מידע שנלמד על ספקים, מוריד ומבצע סקריפט עיבוד מ-GitHub, וכן שומר את התוצאות בדטאסטור כדי ליצור מאגר ידע ממשי.

### קלטים
| שדה | סוג | תיאור |
|-----|-----|-------|
| ALL (JSON) | JSON | מערך נתונים עם: conf (תנאים), docs (מסמכים), imfp (קבצי import), AZURE_RESULT, azuretext |
| branch | String | שם ענף ב-GitHub לשליפת הסקריפט |
| supplier_id | String | מזהה הספק עבור מפתח ה-Datastore |

### פלטים
- LERN_ALL: מערך JSON עם תוצאות הניתוח השמור בדטאסטור
- סטטוס עדכון בדטאסטור עם המפתח supplier_id

### שלבי התהליך
1. **Parse Input JSON** (json:ParseJSON) - פיענוח JSON של הקלט לפי סכימה שהוגדרה
2. **Fetch Processing Script** (http:ActionSendDataAPIKeyAuth) - הורדת סקריפט עיבוד מ-GitHub
3. **Execute Processing Logic** (code:ExecuteCode) - הרצת סקריפט ה-JavaScript עם הקלט
4. **Store Results** (datastore:AddRecord) - שמירת התוצאה בדטאסטור
5. **Route & Complete** (builtin:BasicRouter) - ניתוב לפי תנאים ואישור סיום

### סטטיסטיקות
- **גודל קובץ**: 168 KB
- **מספר Modules**: 5
- **זמן ריצה משוער**: 2-5 שניות
- **מפעילות עיקריות**: JSON parsing, GitHub API, Code execution, Datastore write

---

## 2. P0 - AZURE_Production_Invoice

### מטרת התהליך
עיבוד חשבוניות PDF מ-Google Drive דרך Azure Form Recognizer. התהליך מוריד קבצים, שולח לשירותי AI של Azure, מיצוי מידע, ריצת agent AI לזיהוי ספק, אחסון בדטאסטור, וקריאה לתהליכים משניים להמשך.

### קלטים
| שדה | סוג | תיאור |
|-----|-----|-------|
| PDF Files | File | קבצי PDF משכבה בGoogle Drive (DOCUMENTS folder) |
| Azure API Key | String | מפתח API ל-Azure Form Recognizer |
| Supplier Template | Object | תבנית ספק שמורה בדטאסטור |

### פלטים
- Supplier data: שם ספק, מספר עסק, מספר מע"מ
- Invoice analysis: תוכן מושם, מידע מובנה
- Updated Priority link: קישור לדוקומנט שעודכן בPriority
- Webhook response: שליחה לhook לעדכון תהליכים חיצוניים

### שלבי התהליך
1. **Search PDF Files** (google-drive:searchForFilesFolders) - חיפוש קבצי PDF בGoogle Drive
2. **Get File Content** (google-drive:getAFile) - קריאת תוכן הקובץ (בינארי)
3. **Send to Azure** (http:ActionSendData) - שליחת ה-PDF ל-Azure Form Recognizer API
4. **Parse Azure Response** (json:ParseJSON) - פיענוח התשובה מ-Azure
5. **Extract Supplier Info** (ai-tools:Extract) - חילוץ שם ספק, מספרים, אימייל וטלפון
6. **Identify Supplier** (ai-agent:RunAnAIAgent) - זיהוי מספר ספק בPriority

### תהליכים משניים (CallSubscenarios)
- **SCN_7900688**: עדכון מידע הספק בDatastore עם התוצאות
- **SCN_7900797**: עדכון סטטוסים וקליטת הנתונים לשלב הבא

### סטטיסטיקות
- **גודל קובץ**: 206 KB
- **מספר Modules**: 21
- **זמן ריצה משוער**: 5-10 שניות לקובץ
- **מפעילות עיקריות**: Google Drive API, Azure Form Recognizer, AI Extract, AI Agent, Datastore

---

## 3. P1 - PriProductionInvoice

### מטרת התהליך
קליטת נתוני חשבוניות דרך webhook, עיבוד טקסט וניקיון נתונים, קריאה לתהליכים משניים להוספה ל-Priority ו-BASE44, ושמירת הנתונים לתמיד. התהליך משלב עבודה עם GitHub ודטאסטור בצורה מורכבת.

### קלטים
| שדה | סוג | תיאור |
|-----|-----|-------|
| Webhook Data | JSON | נתונים מ-webhook עם AZURE (array), DOCS, IMPFILES, SUPNAME, FILENAME, FILE_DATA, SUP_TEMP, FILE_LINK |
| Branch | String | שם ענף Git לשליפת סקריפטים |
| AZURE Text | Text | טקסט לניקיון מ-Azure Form Recognizer |

### פלטים
- Cleaned AZURE text: טקסט מנוקה וממורמט
- Updated Priority document: דוקומנט שנוסף/עודכן בPriority עם IVNUM
- BASE44 entry: כניסה בBASE44 עם סיכום מידע
- GitHub stored exempts: קבצים שנשמרו ב-GitHub עם input/output
- Processed status: סטטוס עדכון המידע

### שלבי התהליך
1. **Receive Webhook** (gateway:CustomWebHook) - קליטת בקשת webhook עם כל נתוני החשבונית
2. **Parse Main JSON** (json:ParseJSON) - פיענוח ה-JSON הראשי לחלקיו הבסיסיים
3. **Parse AZURE Data** (json:ParseJSON) - פיענוח מערך AZURE לפורמט מובנה
4. **Execute Code (Main Router)** (code:ExecuteCode) - הרצת לוגיקה מרכזית
5. **Route Based on Conditions** (builtin:BasicRouter) - ניתוב לשלוש דרכים שונות
6. **Execute Subscenarios** (scenario-service:CallSubscenario) - קריאה לSCN_7779086 ו-SCN_7877436

### תהליכים משניים (CallSubscenarios)
- **SCN_7779086 (OPEN_PIV_PRIORITY)**: הוסף/עדכן דוקומנט בפריוריטי עם IV (מספר חשבונית)
- **SCN_7877436 (TO_BASE44)**: שמירת הנתונים בBASE44 עם טקסט, IVNUM, סיכום, שם ספק וקישור Priority

### סטטיסטיקות
- **גודל קובץ**: 606 KB
- **מספר Modules**: 6
- **Nested Routes**: 3
- **זמן ריצה משוער**: 3-8 שניות
- **מפעילות עיקריות**: JSON parsing, code execution, GitHub API, Priority integration, nested subscenarios

---

## זרימת הנתונים

```
Webhook (P1) 
    ↓
P1 - PriProductionInvoice (parse & route)
    ↓
P0 - AZURE_Production (Azure analysis)
    ↓
S2 - SUP_LERN_CODE (process & learn)
    ↓
Datastore (store results)
    ↓
P1 - Subscenarios (final update)
    ↓
Priority + BASE44 (final output)
```

---

## קשרים קריטיים

| מ | ל | מידע |
|---|---|------|
| P0 (module 72) | SCN_7900688 | Supplier name from SUPNAME |
| P0 (module 73) | SCN_7900797 | Complete processing results |
| P1 (module 162) | SCN_7779086 | JSON, IV, ANSWERS, PRI_LINK for Priority |
| P1 (module 164) | SCN_7877436 | TEXT, IVNUM, SUPNAME, FILENAME for BASE44 |

---

## הערות חשובות

⚠️ **בעיות אבטחה**:
- GitHub tokens ו-API keys מוטבעים בקוד (צריך להעביר לenv variables)
- Azure API keys מוטבעים בקוד
- Google Drive connections צריכות בדיקת הרשאות

✓ **יתרונות**:
- כל התהליכים תומכים בעברית ואנגלית
- Datastore לימוד דינמי (S2)
- Azure AI extraction חזקה
- Priority integration מלאה
- Router conditions lifespan (P1)

---

## תאריך עדכון
- **שנוצר**: 07-11-2025
- **סוג**: System Architecture Documentation

---

## קבצים נלווים
- `scenarios_documentation.json` - תיעוד מפורט בJSON
- `scenarios_summary.json` - טבלאות השוואה וקשרים

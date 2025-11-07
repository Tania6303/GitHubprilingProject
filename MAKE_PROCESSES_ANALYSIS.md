# דוח ניתוח תהליכי MAKE - ניתוח עסקי

## תמצית חוקרית

תהליכי MAKE אלה מטפלים בתהליך ניהול חשבוניות ספקים בחברה - מהלמידה של נתוני ספקים, עד עיבוד חשבוניות וייצור חשבוניות סופיות.

---

## 1. SupplierDataLearning - S1-PriLernSup.blueprint.json (8,676 שורות)

### מטרת התהליך:
**איסוף וניתוח מלא של נתוני ספקים וחשבוניותיהם מסיסטם Priority**

תפקיד מרכזי: הוא התהליך המרכזי שמחלץ את כל המידע של ספק אחד כולל כל חשבוניותיו, מסמכיו, פריטים שלו, וקבצים צמודים.

### שלבים עיקריים בתהליך:

**שלב 1: קריאה מ-Priority System**
- מודול: `app#leonai-priority:getItemsForms`
- קורא מטופס PINVOICES (חשבוניות ספק מרכזות)
- סינון: לפי מספר ספק (SUPNAME)
- קינה בתאריך החשבונית בסדר יורד

**שלב 2: הרחבת נתונים (Subforms)**
מחלץ 5 subforms (טבלאות משניות) עבור כל חשבונית:
- `PINVOICESCONT_SUBFORM` - פרטים נוספים על החשבונית
- `PIVDOC_SUBFORM` - תעודות קבלה (GRN) קשורות לחשבונית
- `PINVOICEITEMS_SUBFORM` - פריטים בחשבונית (שורות)
- `EXTFILES_SUBFORM` - קבצים צמודים (PDF בלבד)
- `INTERNALDIALOGTEXT_SUBFORM` - הערות פנימיות

**שלב 3: עיבוד וטיהור נתונים**
- המרה ל-JSON
- שליחת HTTP requests לעיבוד
- הוצאת קודים וחישובים

**שלב 4: קריאות לתהליכים משניים**
- `SCN_7803653` - עיבוד/ניקוד נתוני ספק
- `SCN_7775130` - תאימות וולידציה
- `SCN_7831155` - בדיקות בטיחות עסקית
- `SCN_7860051` - **קורא ל-S2-SUP_LERN_CODE** (עיבוד קודים)
- `SCN_7779086` - סינון/ניקיון נתונים
- `SCN_7877436` - שדה נוסף של עיבוד

**שלב 5: אחסון וחיבור נתונים**
- העלאה ל-Google Drive
- שליחה ל-API חיצוני
- צירוף קבצים

### קלטים:
- `SUPNAME` - מספר ספק (חובה)
- `LIMIT` - מספר חשבוניות להחזיר (ברירת מחדל)

### פלטים:
- רשימה מלאה של חשבוניות עם כל הנתונים המשניים
- קבצים מעובדים
- קודים סופיים

### קשרים עם תהליכים אחרים:
- **יציאה ל-S2-SUP_LERN_CODE** - עבור עיבוד קודים
- **יציאה ל-תהליכים משניים** - ל-6 scenarios שונים

---

## 2. Processing Invoice - S2-SUP_LERN_CODE.blueprint.json (3,001 שורות)

### מטרת התהליך:
**עיבוד וטיהור קודי ספקים וטיוב נתונים עבור מחקר שוק**

תפקיד משני-אך-חיוני: לוקח את הנתונים הגולמיים מ-S1 ומחזיר מהם קודים למידה ודירוגים של ספקים.

### שלבים עיקריים בתהליך:

**שלב 1: קבלת נתונים מ-S1**
- קבל JSON עם מערך של חשבוניות וקודים
- מבנה: `array[conf]` עם שדות:
  - `status` - סטטוס עיבוד
  - `supplier_id` - מס' ספק
  - `supplier_name` - שם ספק
  - `vendor_tax_id_reference` - קוד מס ספק
  - `supplier_phone` - טלפון
  - `supplier_email` - דוא"ל
  - ועוד 30+ שדות נוספים

**שלב 2: ניתוח ודירוג**
- עיבוד דרך HTTP APIs
- הרצת קוד Python/JavaScript לדירוג
- חישובי ציוני אמינות

**שלב 3: עיבוד משניים**
- Aggregation של נתונים
- JSON transformation
- ValidBatch routing

**שלב 4: יצירת תיעוד**
- יצירת CreateDoc ב-Priority
- שמירת דירוגים בגוגל דרייב

**שלב 5: פלט סופי**
- קודים של ספקים
- ציונים ודירוגים
- תוצאות בקרה

### קלטים:
- `ALL` - רשימה מלאה של ספקים עם נתוניהם

### פלטים:
- `SUPPLIER_CODES` - קודים משודרגים
- `RATINGS` - ציונים ודירוגים
- `VALIDATION_RESULTS` - תוצאות בקרה

### קשרים עם תהליכים אחרים:
- **קבל מ-S1-PriLernSup** - נתונים גולמיים
- **שלח ל-P0-AZURE_Production_Invoice** - נתונים מעובדים

---

## 3. Production Invoice - אפיקי הנתונים (P0 ו-P1)

### P0-AZURE_Production_Invoice.blueprint.json (4,566 שורות)

#### מטרת התהליך:
**איסוף חשבוניות מ-Azure ויצירת נתונים קאנוניים**

**שלבים:**

**שלב 1: חיפוש קבצים ב-Google Drive**
- מודול: `google-drive:searchForFilesFolders`
- חיפוש קבצי PDF בתיקיית "DOCUMENTS"
- עד 20 קבצים בבת אחת

**שלב 2: קריאות ל-subscenarios**
- `SCN_7900688` - עיבוד חשבוניות מ-Azure
- `SCN_7900797` - מיפוי חשבוניות לספקים

**שלב 3: המרה ל-JSON**
- המרת מסמכים PDF
- חילוץ טקסט וקרא"ים

**שלב 4: שליחה ל-Priority**
- יצירת רשומות חדשות
- קישור לספקים

### P1-PriProductionInvoice.blueprint.json (8,738 שורות)

#### מטרת התהליך:
**עיבוד סופי של חשבוניות וייצור חשבוניות מופקות**

זהו התהליך הסופי ויותר מורכב - מסדיר הכל וגדר חשבוניות סופיות.

**שלבים:**

**שלב 1: קבלת טריגר**
- מודול: `gateway:CustomWebHook`
- מסדר אירועים חיצוניים (webhook)
- קבל JSON עם:
  - `AZURE` - נתונים מ-Azure
  - `DOCS` - מסמכים מעובדים
  - מידע נוסף של חשבוניות

**שלב 2: ניתוח JSON**
- פרסור הנתונים המתקבלים
- בדיקות תקינות

**שלב 3: עיבוד משניים**
- קריאה לתהליכים `SCN_7779086` ו-`SCN_7877436`
- שונות בעיבוד נתונים

**שלב 4: הורדת קבצים מ-Priority**
- מודול: `app#leonai-priority:filedownload`
- הורדת תיקיות מ-Priority
- קבצי PDF מחשבוניות קודמות

**שלב 5: עיבוד קוד מותאם**
- קריאה ל-ExecuteCode - בדיקות בטיחות
- חישובים נוספים
- מיפוי שדות

**שלב 6: יצירת חשבוניות סופיות**
- מודול: `leonai-priority:CreateDoc`
- יצירת מסמכי חשבונית סופיים ב-Priority
- חתימה דיגיטלית

**שלב 7: העלאה ל-Google Drive**
- מודול: `google-drive:uploadAFile`
- העלאת חשבוניות סופיות לגוגל דרייב
- סידור לפי תאריך וספק

**שלב 8: שליחה ל-סיסטם חיצוני**
- HTTP ActionSendData
- שליחה לבנק/מערכת חשבונות
- סינכרון מאזן

### קלטים (P1):
- Webhook input עם נתונים מ-Azure וקבצים
- נתונים של חשבוניות מ-S1

### פלטים (P1):
- חשבוניות סופיות ב-Priority
- קבצים בגוגל דרייב
- דוחות סינכרון

---

## 4. תהליכים משניים (SubScenarios)

כל אלה הם תהליכים עזר שקרויים מהתהליכים הראשיים:

| ID Scenario | קורא מאת | תפקיד |
|---|---|---|
| SCN_7866658 | DOCUMENTS FROM PRIORITY BY IVNUM | אחסון תעודות |
| SCN_7803653 | S1-PriLernSup | בדיקות ראשוניות |
| SCN_7775130 | S1-PriLernSup | בדיקות תאימות |
| SCN_7831155 | S1-PriLernSup | בדיקות בטיחות |
| SCN_7860051 | S1-PriLernSup | קוד S2 |
| SCN_7779086 | S1, P1 | סינון/ניקיון (משותף) |
| SCN_7877436 | S1, P1 | סיוע נוסף (משותף) |
| SCN_7900688 | P0 | עיבוד Azure |
| SCN_7900797 | P0 | מיפוי חשבוניות |

---

## 5. קשרים בין התהליכים (Architecture)

```
┌─────────────────────────────────────────┐
│         Priority System (מקור)            │
│         PINVOICES Form                    │
└────────────────┬────────────────────────┘
                 │
    ┌────────────▼────────────┐
    │                         │
    │  S1-PriLernSup          │
    │  (Supplier Learning)    │
    │  - איסוף נתונים         │
    │  - subforms             │
    │  - בדיקות ראשוניות      │
    │                         │
    └────────────┬────────────┘
         ┌───────┘
         │
         ├──→ SCN_7803653 (בדיקות)
         ├──→ SCN_7775130 (תאימות)
         ├──→ SCN_7831155 (בטיחות)
         │
         ├──→ S2-SUP_LERN_CODE ◄──────┐
         │    (Processing)             │
         │    - עיבוד קודים            │
         │    - דירוגים                │
         └────────────────────────────┘
         │
         ├──→ P0-AZURE_Production_Invoice
         │    (חשבוניות מ-Azure)
         │    - חיפוש בגוגל דרייב
         │    - עיבוד PDF
         │    - ספריים בראשוניים
         │
         └──→ P1-PriProductionInvoice
              (חשבוניות סופיות)
              - Webhook trigger
              - CreateDoc ב-Priority
              - Google Drive upload
              - סינכרון חיצוני
```

---

## 6. זרימת נתונים (Data Flow)

| שלב | מקור | יעד | פורמט |
|---|---|---|---|
| 1 | Priority - PINVOICES | S1-PriLernSup | SQL Query |
| 2 | S1 output | S2-SUP_LERN_CODE | JSON |
| 3 | S1 output | Google Drive | Files |
| 4 | Google Drive | P0-AZURE_Production | Files |
| 5 | P0 output | P1 input | JSON/Webhook |
| 6 | P1 processing | Priority CreateDoc | Document |
| 7 | P1 output | Google Drive | Files |
| 8 | P1 output | External System | HTTP |

---

## 7. טכנולוגיות ומערכות משתלבות

| סיסטם | תפקיד | ממשק |
|---|---|---|
| Priority (ERP) | מקור נתונים | API app#leonai-priority |
| Google Drive | אחסון קבצים | API google-drive |
| Azure | אחסון/עיבוד | Webhook gateway |
| HTTP APIs | סינכרון חיצוני | ActionSendData |
| Make.com | Orchestration | Scenario service |

---

## 8. קובצי מדריך ייחוס

```
Path: /home/user/GitHubprilingProject/MakeCode/scenario_make

SupplierDataLearning/
├── S1-PriLernSup.blueprint.json (8,676 שורות) - תהליך ראשי
├── DOCUMENTS FROM PRIORITY BY IVNUM.json (2,247 שורות) - תהליך תעודות
└── IMPFILES.json (1,061 שורות) - תהליך תיקי יבוא

Processing Invoice/
└── S2- SUP_LERN_CODE.blueprint.json (3,001 שורות) - עיבוד קודים

Production Invoice/
├── P0-AZURE_Production_Invoice.blueprint.json (4,566 שורות) - חיפוש קבצים
└── P1-PriProductionInvoice.blueprint.json (8,738 שורות) - עיבוד סופי

סה"כ: 28,289 שורות JSON
```

---

## 9. סיכום יחסי ממשק בין הקבצים

```
Input:  SUPNAME (מס' ספק) ──┐
                             │
                        S1-PriLernSup (S1)
                             │
        ┌────────────────────┼────────────────┐
        │                    │                │
        │                    │         S2-SUP_LERN_CODE (S2)
        │                    │    (Processing Invoice)
        │                    │                │
        │                    │                │
        └────────────────────┼────────────────┘
                 │          │
     (outputs)   │          │
                 │          │
    ┌────────────▼──┐   ┌───▼────────────────┐
    │ Google Drive  │   │ Priority System    │
    │ CSV/PDF files │   │ (new records)      │
    │               │   │                    │
    └───────────────┘   └────────────────────┘
         │                     │
         │     P0-AZURE + P1   │
         │                     │
         └────────┬────────────┘
                  │
         ┌────────▼──────────┐
         │ Production Invoice│
         │ Final Output      │
         │ - Signed PDF      │
         │ - Posted to banks │
         └───────────────────┘
```

---

## 10. דעה לסיכום

**התהליך האפיקי הזה משמש למטרה עסקית חשובה:**

1. **לקיום ניהול חשבוניות מרכזי** - האיחוד של Priority ERP עם עיבוד אוטומטי
2. **לצמצום שגיאות ידניות** - דרך בדיקות וולידציה רבות
3. **לאוטומציה של תהליכים** - מאיסוף עד הפקה סופית
4. **לשדרוג נתונים** - דרך עיבוד ודירוגים

זהו תהליך מתוחכם שעוסק בנתונים פיננסיים אמיתיים וקריטיים לעסק.

---

## 11. מודולים עיקריים בשימוש

### נתונים:
- `app#leonai-priority:getItemsForms` - שליפת נתונים מ-Priority
- `app#leonai-priority:getSubformAdv` - הרחבת נתונים משניים
- `app#leonai-priority:filedownload` - הורדת קבצים
- `app#leonai-priority:CreateDoc` - יצירת מסמכים

### עיבוד:
- `json:ParseJSON` - פרסור JSON
- `json:AggregateToJSON` - איגום נתונים
- `code:ExecuteCode` - הרצת קוד מותאם
- `util:SetVariables` - הגדרת משתנים

### שילובים חיצוניים:
- `google-drive:searchForFilesFolders` - חיפוש בגוגל דרייב
- `google-drive:uploadAFile` - העלאה לגוגל דרייב
- `http:ActionSendData` - שליחת HTTP requests
- `gateway:CustomWebHook` - קבלת webhooks

### בקרה:
- `builtin:BasicRouter` - חלוקה לנתיבים
- `builtin:BasicAggregator` - איגום תוצאות
- `builtin:BasicFeeder` - הנחיית נתונים
- `scenario-service:CallSubscenario` - קריאה לתהליכים משניים

---

*דוח זה נוצר בתאריך: 2025-11-07*
*נושא: ניתוח עמוק של תהליכי MAKE בספרייה MakeCode/scenario_make*

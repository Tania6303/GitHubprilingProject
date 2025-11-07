# ⚠️ כללי עבודה קריטיים - חובה לקרוא לפני כל שינוי!

## 🔴 כלל מספר 0: מיקום קבצי בדיקה

**📁 קבצי בדיקה (input/output) תמיד נמצאים בספריית EXEMPTS/**

- Processing Invoice: `MakeCode/Processing Invoice/EXEMPTS/`
- Production Invoice: `MakeCode/Production Invoice/EXEMPTS/`
- SupplierDataLearning: `MakeCode/SupplierDataLearning/EXEMPTS/`

**למציאת הקובץ העדכני:**
```bash
ls -lt "MakeCode/[MODULE]/EXEMPTS" | head -5
```

**חשוב:** מיקום זה **חייב** להיות רשום בכותרת כל קובץ קוד (מייד אחרי שורת הגרסה)!

**דוגמה לכותרת נכונה:**
```javascript
// קוד Production Invoice - עיבוד חשבוניות (גרסה 1.0 - 05.11.25.14:40)
// מקבל: מבנה חדש עם AZURE, CARS, SUPNAME
// מחזיר: JSON לפריוריטי + דוח ביצוע
//
// 📁 קבצי בדיקה: MakeCode/Production Invoice/EXEMPTS/
// לקיחת הקובץ העדכני: ls -lt "MakeCode/Production Invoice/EXEMPTS" | head -5
```

זה מבטיח שבכל שיחה חדשה, מיקום קבצי הבדיקה יהיה זמין!

---

## 🔴 כלל מספר 1: שרשרת תלות בין מודולים

```
SupplierDataLearning → Processing Invoice → Production Invoice
```

### ⚠️ חוק ברזל:
**כל שינוי ב-Processing Invoice חייב להיבדק ולהתעדכן מיד ב-Production Invoice!**

---

## 📋 Checklist חובה אחרי שינוי ב-Processing Invoice:

### ✅ לפני Commit:

1. **זיהיתי איזה שדות שיניתי במבנה הפלט?**
   - [ ] רשימה של שדות שעברו מקום
   - [ ] רשימה של שדות חדשים
   - [ ] רשימה של שדות שנמחקו

2. **חיפשתי את כל השדות האלה ב-Production Invoice?**
   - [ ] חיפוש גלובלי (Grep) על שם השדה
   - [ ] בדיקה של כל תוצאת חיפוש
   - [ ] עדכון של כל מקום שתלוי בשדה

3. **בדקתי את נקודות החיבור הקריטיות?**
   - [ ] `parseLearnedConfig()` - קורא את הפלט של Processing Invoice
   - [ ] `buildInvoiceFromTemplate()` - משתמש בשדות מהתבנית
   - [ ] `result.supplier_identification` - חילוץ supplier_code/name
   - [ ] כל מקום שיש `learnedConfig.`

4. **בדקתי backward compatibility?**
   - [ ] הוספתי fallback למבנה הישן?
   - [ ] השתמשתי ב-optional chaining (`?.`)?
   - [ ] בדקתי שהקוד לא קורס אם שדה חסר?

### ✅ אחרי Commit:

5. **תיעדתי את השינוי?**
   - [ ] עדכנתי Documentation אם צריך
   - [ ] הוספתי הערות בקוד על המבנה החדש
   - [ ] רשמתי ב-commit message את השפעת השינוי

---

## 🎯 דוגמה מהחיים האמיתיים:

### ❌ מה שקרה (שגיאה):

```javascript
// Processing Invoice v4.2 - שיניתי מבנה:
{
  llm_prompt: {
    supplier_code: "5014",  // ← עבר לכאן
    all_templates: [...]
  }
}

// Production Invoice - לא תיקנתי את כל המקומות:
supplier_code: learnedConfig.supplier_id  // ← עדיין חיפש במקום הישן!
// תוצאה: SUPNAME = "" ❌
```

### ✅ מה שהייתי צריך לעשות:

1. **לפני השינוי** - לרשום רשימה:
   ```
   שדות שעוברים מקום:
   - supplier_code: מרמה עליונה → llm_prompt.supplier_code
   - supplier_name: מרמה עליונה → llm_prompt.supplier_name
   - invoice_data: מרמה עליונה → llm_prompt.all_templates[].invoice_data
   ```

2. **חיפוש ב-Production Invoice**:
   ```bash
   grep -n "supplier_code" "MakeCode/Production Invoice/v1.0-production.js"
   # תוצאות: שורה 287, 722, 970 → לתקן את כולן!
   ```

3. **תיקון כל המקומות בבת אחת**:
   ```javascript
   // הוסף fallback לכל מקום:
   supplier_code: learnedConfig.supplier_id ||
                 learnedConfig.llm_prompt?.supplier_code ||
                 learnedConfig.technical_config?.supplier_code ||
                 config.supplier_config?.supplier_code || ""
   ```

---

## 🚨 שאלות לשאול את עצמי לפני Commit:

1. **האם שיניתי מבנה פלט ב-Processing Invoice?**
   → אם כן: **עצור! בדוק Production Invoice עכשיו!**

2. **האם הוספתי/מחקתי שדה?**
   → אם כן: **חפש את השדה ב-Production Invoice!**

3. **האם שיניתי איך שדה מחושב?**
   → אם כן: **ודא ש-Production Invoice לא תלוי בחישוב הישן!**

4. **האם הרצתי בדיקה מלאה?**
   → אם לא: **אל תעשה commit!**

---

## 📝 Template לסיכום שינוי:

```markdown
### שינוי ב-Processing Invoice

**שדות ששונו:**
- [שם שדה]: [מה השתנה]

**השפעה על Production Invoice:**
- [מיקום 1]: [מה תיקנתי]
- [מיקום 2]: [מה תיקנתי]

**בדיקות שעשיתי:**
- [ ] חיפוש גלובלי על כל השדות
- [ ] עדכון כל המקומות התלויים
- [ ] הוספת fallback למבנה ישן
- [ ] בדיקת backward compatibility
```

---

## 💡 זכור:

> **"כל שינוי ב-Processing Invoice = שינוי ב-Production Invoice"**
>
> **לא לעשות Commit לפני שבדקת את שני הקבצים!**

---

## 🔴 כלל מספר 2: עדכון תיעוד מסכם

### ⚠️ חוק ברזל:
**כל סיום קוד או שינוי חוקים חייב לגרור עדכון של COMPLETE-SYSTEM-DOCUMENTATION.html!**

```
קוד חדש/עדכון → עדכון תיעוד מסכם
```

### 📋 Checklist חובה אחרי שינוי קוד:

1. **עדכנתי את התיעוד המסכם?**
   - [ ] `COMPLETE-SYSTEM-DOCUMENTATION.html` עודכן
   - [ ] הגרסה בתיעוד תואמת לגרסה בקוד
   - [ ] התיקונים האחרונים מתועדים

2. **עדכנתי את README של המודול?**
   - [ ] הקובץ README.md של המודול עודכן
   - [ ] הדוגמאות תואמות לקוד החדש

3. **שדות חדשים או שינויי לוגיקה?**
   - [ ] הוספתי drill-down מלא בתיעוד
   - [ ] הדגמתי עם דוגמה
   - [ ] עדכנתי את field_mapping אם רלוונטי

### 📍 מיקומי תיעוד:

- **תיעוד מסכם מאוחד**: `/COMPLETE-SYSTEM-DOCUMENTATION.html` (רמה ראשית)
- **תיעוד מודול 1**: `MakeCode/SupplierDataLearning/README.md`
- **תיעוד מודול 2**: `MakeCode/Processing Invoice/README.md`
- **תיעוד מודול 3**: `MakeCode/Production Invoice/README.md`

### 🎯 דוגמה - מה לעדכן:

```markdown
אם הוספתי שדה חדש ל-metadata או תיקנתי לוגיקה:

1. עדכן COMPLETE-SYSTEM-DOCUMENTATION.html:
   - הוסף את השדה החדש ל-metadata section
   - הסבר מה הוא מכיל ומתי משתמשים בו
   - הוסף דוגמה

2. עדכן README של המודול:
   - רשום בשורת הגרסה
   - הוסף לסעיף "עדכונים אחרונים"

3. עדכן field_mapping (אם רלוונטי):
   - הוסף את השדה החדש לטבלה
   - הסבר מה המקור
```

### 💡 זכור:

> **"קוד בלי תיעוד = קוד שאיבד תפקיד אחרי חודש"**
>
> **התיעוד המסכם = README של הפרויקט - תמיד מעודכן!**

---

📅 נוצר: 2025-11-05
📅 עדכון: 2025-11-06
🎯 מטרה: למנוע בזבוז זמן ותקלות בגלל שינויים לא מסונכרנים + שמירה על תיעוד עדכני

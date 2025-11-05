# ⚠️ כללי עבודה קריטיים - חובה לקרוא לפני כל שינוי!

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

📅 נוצר: 2025-11-05
🎯 מטרה: למנוע בזבוז זמן ותקלות בגלל שינויים לא מסונכרנים

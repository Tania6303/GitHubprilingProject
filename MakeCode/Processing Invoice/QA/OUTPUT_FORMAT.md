# תבנית JSON - פלט עיבוד חשבונית (v4.2)

## סקירה כללית

הקוד מייצר פלט JSON עם **5 שדות ברמה עליונה**:

```json
{
  "status": "success",
  "invoice_data": {...},
  "llm_prompt": {...},
  "technical_config": {...},
  "processing_scenario": {...}
}
```

## עקרון התמיכה במספר תבניות

**כל ספק יכול להיות בעל מספר תבניות חשבונית** (לדוגמה: רגילה, יבוא+תעודות, זיכוי).

הפלט מכיל:
- **התבנית שנבחרה** - ברמה הראשונה של כל אובייקט
- **כל התבניות** - בשדה `all_templates` בתוך כל אובייקט

---

## 1️⃣ status

```json
"status": "success"
```

**ערכים אפשריים:** `"success"` | `"error"`

---

## 2️⃣ invoice_data

JSON מוכן ל-Priority עם **חשבונית לכל תבנית**.

### מבנה:
```json
{
  "PINVOICES": [
    {
      "SUPNAME": "279992",
      "CODE": "ש\"ח",
      "DEBIT": "D",
      "IVDATE": "09/09/25",
      "BOOKNUM": "250000620",
      "PINVOICEITEMS_SUBFORM": [...]
    },
    {
      "SUPNAME": "279992",
      "CODE": "ש\"ח",
      "DEBIT": "D",
      "IVDATE": "09/09/25",
      "BOOKNUM": "250000620",
      "ORDNAME": "2501004925",
      "IMPFNUM": "25c00104",
      "DOCNO": "25025301",
      "PIVDOC_SUBFORM": [...]
    },
    {
      "SUPNAME": "279992",
      "CODE": "ש\"ח",
      "DEBIT": "C",
      "IVDATE": "09/09/25",
      "BOOKNUM": "250000620",
      "PINVOICESCONT_SUBFORM": [...]
    }
  ]
}
```

### הסבר:
- **PINVOICES** - מערך באורך `n` (מספר התבניות)
- **אינדקס 0** - חשבונית רגילה
- **אינדקס 1** - חשבונית יבוא+תעודות
- **אינדקס 2** - זיכוי

### שדות משתנים לפי תבנית:
| תבנית | DEBIT | שדות נוספים | SUBFORMS |
|-------|-------|-------------|----------|
| רגילה | D | - | PINVOICEITEMS_SUBFORM |
| יבוא+תעודות | D | ORDNAME, IMPFNUM, DOCNO | PINVOICEITEMS_SUBFORM, PIVDOC_SUBFORM |
| זיכוי | C | - | PINVOICEITEMS_SUBFORM, PINVOICESCONT_SUBFORM |

---

## 3️⃣ llm_prompt

הנחיות ל-LLM לחילוץ נתונים מ-OCR.

### מבנה:
```json
{
  "supplier_code": "279992",
  "supplier_name": "מודגל מתכת (99) בע\"מ",
  "document_type": "חשבונית רגילה עם פירוט",
  "instructions": {
    "overview": "...",
    "processing_steps": [...],
    "fields": {...},
    "validation": {...},
    "special_notes": [...]
  },
  "all_templates": [
    { /* prompt for template 0 */ },
    { /* prompt for template 1 */ },
    { /* prompt for template 2 */ }
  ]
}
```

### הסבר:
- **ברמה הראשונה:** הנחיות לתבנית שנבחרה (תבנית 0 בדוגמה)
- **all_templates:** מערך עם הנחיות לכל 3 התבניות

### document_type לפי תבנית:
- תבנית 0: `"חשבונית רגילה עם פירוט"`
- תבנית 1: `"חשבונית עם תיק יבוא עם תעודות"`
- תבנית 2: `"זיכוי רגיל עם פירוט"`

---

## 4️⃣ technical_config

קונפיגורציה טכנית למערכת.

### מבנה:
```json
{
  "supplier_code": "279992",
  "supplier_name": "מודגל מתכת (99) בע\"מ",
  "version": "4.2",
  "document_type": "regular_invoice",
  "extraction_rules": {...},
  "vehicle_mapping": {...},
  "template": {...},
  "validation_rules": {...},
  "all_templates": [
    { /* config for template 0 */ },
    { /* config for template 1 */ },
    { /* config for template 2 */ }
  ]
}
```

### document_type לפי תבנית:
- תבנית 0: `"regular_invoice"`
- תבנית 1: `"import_with_docs_invoice"`
- תבנית 2: `"credit_note"`

---

## 5️⃣ processing_scenario

מה MAKE צריך לשלוף מהמערכת.

### מבנה:
```json
{
  "check_docs": false,
  "check_import": false,
  "check_vehicles": false,
  "all_templates": [
    {
      "check_docs": false,
      "check_import": false,
      "check_vehicles": false
    },
    {
      "check_docs": true,
      "check_import": true,
      "check_vehicles": false
    },
    {
      "check_docs": false,
      "check_import": false,
      "check_vehicles": false
    }
  ]
}
```

### הסבר:
- **ברמה הראשונה:** סצנריו לתבנית שנבחרה
- **all_templates:** מערך עם סצנריות לכל התבניות

### דוגמה:
- תבנית 0 (רגילה): לא צריך docs/import
- תבנית 1 (יבוא+תעודות): **צריך** docs + import ✓
- תבנית 2 (זיכוי): לא צריך docs/import

---

## קבצים

1. **`OUTPUT_TEMPLATE.json`** - דוגמה מלאה עם נתונים אמיתיים (38KB)
2. **`OUTPUT_SCHEMA.json`** - תיאור מבני מפורט
3. **`OUTPUT_FORMAT.md`** - מדריך זה

## שימוש

```javascript
const result = processInvoiceComplete(input);

// גישה לכל החשבוניות
result.invoice_data.PINVOICES.forEach((invoice, i) => {
  console.log(`Template ${i}:`, invoice.DEBIT);
});

// גישה להנחיות LLM לכל התבניות
result.llm_prompt.all_templates.forEach((prompt, i) => {
  console.log(`Template ${i}:`, prompt.document_type);
});

// בדיקת סצנריו לתבנית 1
const template1Scenario = result.processing_scenario.all_templates[1];
if (template1Scenario.check_import) {
  console.log('תבנית 1 דורשת בדיקת תיק יבוא');
}
```

---

## עקרונות חשובים

✅ **המבנה לא השתנה** - 5 שדות ברמה עליונה בלבד
✅ **התוכן התרחב** - כל אובייקט מכיל `all_templates` עם כל התבניות
✅ **תאימות לאחור** - השדות ברמה הראשונה זהים למקור
✅ **גמישות** - תמיכה בכל מספר תבניות (לא מוגבל ל-3)

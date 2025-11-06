// ====================================================================
// דוגמה לשילוב Text Standardization עם Processing Invoice
// ====================================================================

const { standardizeText, cleanForVehicles } = require('../standardize-text.js');

/**
 * דוגמה 1: שימוש ב-Processing Invoice - ניקוי AZURE_TEXT
 *
 * במקום להעביר את AZURE_TEXT הגולמי, נעביר אותו דרך standardization
 */
function example1_processingInvoice() {
    console.log("═══════════════════════════════════════════════════");
    console.log("דוגמה 1: שילוב עם Processing Invoice");
    console.log("═══════════════════════════════════════════════════\n");

    // סימולציה של input מ-Make.com
    const rawAzureText = `חשבונית מס'/קבלה
טכומטר-מכון ספידומטרים בע"מ
מספר רכב:  741   -  69   - 103
מחיר:   300   ש"ח`;

    console.log("📥 AZURE_TEXT מקורי:");
    console.log(rawAzureText);
    console.log("");

    // ניקוי לפני עיבוד
    const cleanAzureText = standardizeText(rawAzureText);

    console.log("🧹 AZURE_TEXT לאחר ניקוי:");
    console.log(cleanAzureText);
    console.log("");

    // עכשיו אפשר להעביר ל-Processing Invoice
    console.log("✅ מוכן להעברה ל-Processing Invoice");
    console.log("   const vehicles = extractVehiclesAdvanced(ocrFields, vehicleRules, cleanAzureText);");
    console.log("");
}

/**
 * דוגמה 2: שימוש ייעודי לחילוץ רכבים
 */
function example2_vehicleExtraction() {
    console.log("═══════════════════════════════════════════════════");
    console.log("דוגמה 2: חילוץ רכבים עם cleanForVehicles()");
    console.log("═══════════════════════════════════════════════════\n");

    const dirtyText = `מספר רכב:  741   -  69   - 103
שני רכב: 459\\u00A0-\\u00A006\\u200B-\\u00A0303`;

    console.log("📥 טקסט מקורי עם רווחים ותווים בלתי נראים");
    console.log("");

    // ניקוי מיוחד לרכבים
    const cleanText = cleanForVehicles(dirtyText);

    console.log("🧹 טקסט נקי:");
    console.log(cleanText);
    console.log("");

    // חילוץ מספרי רכב
    const vehiclePattern = /\d{3}-\d{2}-\d{3}/g;
    const vehicles = cleanText.match(vehiclePattern);

    console.log("🚗 רכבים שנמצאו:", vehicles);
    console.log("");
}

/**
 * דוגמה 3: ניקוי מספרי חשבוניות (BOOKNUM)
 */
function example3_booknumCleaning() {
    console.log("═══════════════════════════════════════════════════");
    console.log("דוגמה 3: ניקוי מספרי חשבוניות");
    console.log("═══════════════════════════════════════════════════\n");

    const dirtyBooknums = [
        "288756   Ns",
        "286015 NS",
        "SI12345",
        "  12345  "
    ];

    dirtyBooknums.forEach(dirty => {
        const clean = standardizeText(dirty);
        // הסרת suffix (Ns, NS)
        const booknum = clean.match(/^[\d\-\/]+/)?.[0] || clean;
        console.log(`"${dirty}" → "${booknum}"`);
    });
    console.log("");
}

/**
 * דוגמה 4: ניקוי לפני חיפוש OCR Fields
 */
function example4_ocrFieldsCleaning() {
    console.log("═══════════════════════════════════════════════════");
    console.log("דוגמה 4: ניקוי OCR Fields");
    console.log("═══════════════════════════════════════════════════\n");

    // סימולציה של OCR Fields עם רווחים מיותרים
    const ocrFields = {
        InvoiceId: "288756   Ns",
        InvoiceDate: "22/10/2025",
        InvoiceTotal: "  354.00  ש\"ח",
        VendorName: "טכומטר-מכון  ספידומטרים   בע\"מ"
    };

    console.log("📥 OCR Fields מקורי:");
    console.log(JSON.stringify(ocrFields, null, 2));
    console.log("");

    // ניקוי כל השדות
    const cleanedFields = {};
    for (const [key, value] of Object.entries(ocrFields)) {
        cleanedFields[key] = standardizeText(String(value));
    }

    console.log("🧹 OCR Fields לאחר ניקוי:");
    console.log(JSON.stringify(cleanedFields, null, 2));
    console.log("");
}

/**
 * דוגמה 5: שימוש ב-Make.com Workflow
 */
function example5_makeWorkflow() {
    console.log("═══════════════════════════════════════════════════");
    console.log("דוגמה 5: שימוש ב-Make.com Workflow");
    console.log("═══════════════════════════════════════════════════\n");

    console.log("אופציה 1: מודול נפרד ב-Make.com");
    console.log("─────────────────────────────────────────────────");
    console.log("Azure OCR → Text Standardization → Processing Invoice → Production Invoice");
    console.log("");

    console.log("אופציה 2: שילוב בתוך Processing Invoice");
    console.log("─────────────────────────────────────────────────");
    console.log("// בתחילת Processing Invoice:");
    console.log("const { standardizeText } = require('./TextStandardization/standardize-text.js');");
    console.log("const cleanAzureText = standardizeText(input.AZURE_TEXT);");
    console.log("");

    console.log("אופציה 3: שילוב בתוך Production Invoice");
    console.log("─────────────────────────────────────────────────");
    console.log("// ניקוי BOOKNUM:");
    console.log("const cleanBooknum = standardizeText(ocrFields.InvoiceId);");
    console.log("const booknum = cleanBooknum.match(/^[\\d\\-\\/]+/)?.[0] || cleanBooknum;");
    console.log("");
}

// ====================================================================
// הרצת כל הדוגמאות
// ====================================================================

console.log("\n");
console.log("🚀 הרצת דוגמאות שילוב Text Standardization");
console.log("════════════════════════════════════════════════════════════════\n");

example1_processingInvoice();
example2_vehicleExtraction();
example3_booknumCleaning();
example4_ocrFieldsCleaning();
example5_makeWorkflow();

console.log("════════════════════════════════════════════════════════════════");
console.log("✅ כל הדוגמאות הושלמו בהצלחה!");
console.log("════════════════════════════════════════════════════════════════");

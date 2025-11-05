// ============================================================================
// Text Standardization - ניקוי ונרמול טקסט מ-OCR (גרסה 1.0 - 05.11.25)
// משימה אחת: ניקוי טקסט מלוכלך מ-Azure OCR
// מקבל: טקסט גולמי (AZURE_TEXT או כל טקסט אחר)
// מחזיר: טקסט נקי ומנורמל
//
// 📁 קבצי בדיקה: MakeCode/TextStandardization/EXEMPTS/
// ============================================================================

/**
 * פונקציה ראשית - standardization מלא
 * @param {string} text - הטקסט הגולמי
 * @param {object} options - אופציות (אופציונלי)
 * @returns {string} טקסט נקי
 */
function standardizeText(text, options = {}) {
    if (!text || typeof text !== 'string') return "";

    // אופציות ברירת מחדל
    const opts = {
        removeInvisibleChars: true,      // הסר תווים בלתי נראים
        normalizeWhitespace: true,       // נרמל רווחים
        normalizeLineBreaks: true,       // נרמל שורות חדשות
        normalizeHyphens: true,          // נרמל מקפים
        removeExtraSpaces: true,         // הסר רווחים מיותרים
        fixVehicleNumbers: true,         // תקן מספרי רכב (XXX-XX-XXX)
        fixNumbers: true,                // תקן מספרים עם רווחים
        normalizeHebrew: true,           // נרמל תווים עבריים
        ...options
    };

    let cleaned = text;

    // שלב 1: הסרת תווים בלתי נראים
    if (opts.removeInvisibleChars) {
        cleaned = removeInvisibleCharacters(cleaned);
    }

    // שלב 2: נרמול line breaks
    if (opts.normalizeLineBreaks) {
        cleaned = normalizeLineBreaks(cleaned);
    }

    // שלב 3: נרמול רווחים
    if (opts.normalizeWhitespace) {
        cleaned = normalizeWhitespace(cleaned);
    }

    // שלב 4: נרמול מקפים
    if (opts.normalizeHyphens) {
        cleaned = normalizeHyphens(cleaned);
    }

    // שלב 5: תיקון מספרי רכב
    if (opts.fixVehicleNumbers) {
        cleaned = fixVehicleNumbers(cleaned);
    }

    // שלב 6: תיקון מספרים כלליים
    if (opts.fixNumbers) {
        cleaned = fixNumbers(cleaned);
    }

    // שלב 7: נרמול עברית
    if (opts.normalizeHebrew) {
        cleaned = normalizeHebrew(cleaned);
    }

    // שלב 8: הסרת רווחים מיותרים
    if (opts.removeExtraSpaces) {
        cleaned = removeExtraSpaces(cleaned);
    }

    // שלב 9: trim סופי
    cleaned = cleaned.trim();

    return cleaned;
}

// ============================================================================
// פונקציות עזר - כל פונקציה מטפלת בבעיה ספציפית
// ============================================================================

/**
 * הסרת תווים בלתי נראים (zero-width, non-breaking spaces, etc.)
 */
function removeInvisibleCharacters(text) {
    return text
        // Zero-width characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // Non-breaking space → רווח רגיל
        .replace(/\u00A0/g, ' ')
        // Soft hyphen
        .replace(/\u00AD/g, '')
        // Left-to-right / Right-to-left marks
        .replace(/[\u200E\u200F]/g, '')
        // Other control characters (except tab, newline)
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

/**
 * נרמול line breaks (Windows, Mac, Unix)
 */
function normalizeLineBreaks(text) {
    return text
        .replace(/\r\n/g, '\n')  // Windows → Unix
        .replace(/\r/g, '\n')    // Mac → Unix
        .replace(/\n{3,}/g, '\n\n');  // 3+ שורות → 2 שורות
}

/**
 * נרמול רווחים (tabs, multiple spaces)
 */
function normalizeWhitespace(text) {
    return text
        // Tab → רווח
        .replace(/\t/g, ' ')
        // Multiple spaces → single space
        .replace(/  +/g, ' ')
        // רווח בתחילת שורה
        .replace(/^ +/gm, '')
        // רווח בסוף שורה
        .replace(/ +$/gm, '');
}

/**
 * נרמול מקפים (en-dash, em-dash, minus → hyphen)
 */
function normalizeHyphens(text) {
    return text
        // En-dash (–) → hyphen (-)
        .replace(/\u2013/g, '-')
        // Em-dash (—) → hyphen (-)
        .replace(/\u2014/g, '-')
        // Minus sign (−) → hyphen (-)
        .replace(/\u2212/g, '-')
        // Figure dash → hyphen
        .replace(/\u2012/g, '-')
        // Horizontal bar → hyphen
        .replace(/\u2015/g, '-');
}

/**
 * תיקון מספרי רכב ישראליים (XXX-XX-XXX)
 * בעיה נפוצה: "741 - 69 - 103" או "741- 69 -103"
 */
function fixVehicleNumbers(text) {
    // מצא דפוס של מספר רכב עם רווחים
    // תומך ב: "741 - 69 - 103", "741- 69 -103", "741 -69- 103"
    return text.replace(/(\d{3})\s*-?\s*(\d{2})\s*-?\s*(\d{3})/g, (match, p1, p2, p3) => {
        // בדוק שזה לא חלק ממספר ארוך יותר
        const validVehicleNumber = match.match(/^\d{3}\s*-?\s*\d{2}\s*-?\s*\d{3}$/);
        if (validVehicleNumber) {
            return `${p1}-${p2}-${p3}`;
        }
        return match;  // אל תשנה אם זה לא מספר רכב תקין
    });
}

/**
 * תיקון מספרים כלליים עם רווחים
 * בעיה: "12 345" → "12345", "1 234.56" → "1234.56"
 */
function fixNumbers(text) {
    // מספרים עם רווחים (אבל לא מספרי רכב!)
    return text.replace(/\b(\d{1,3})(\s+\d{3})+\b/g, (match) => {
        // אל תיגע במספרי רכב (בדיוק 3-2-3 ספרות)
        if (match.match(/^\d{3}\s+\d{2}\s+\d{3}$/)) {
            return match;
        }
        // הסר רווחים מכל מספר אחר
        return match.replace(/\s+/g, '');
    });
}

/**
 * נרמול תווים עבריים (gershayim, geresh)
 */
function normalizeHebrew(text) {
    return text
        // Gershayim (״) → double quote (")
        .replace(/\u05F4/g, '"')
        // Geresh (׳) → single quote (')
        .replace(/\u05F3/g, "'")
        // Hebrew punctuation
        .replace(/[\u05BE\u05C0]/g, '-');  // Maqaf → hyphen
}

/**
 * הסרת רווחים מיותרים (סיכום סופי)
 */
function removeExtraSpaces(text) {
    return text
        // רווחים מרובים → בודד
        .replace(/  +/g, ' ')
        // רווח לפני סימני פיסוק
        .replace(/ +([,.:;!?])/g, '$1')
        // רווח אחרי פתיחת סוגר
        .replace(/\(\s+/g, '(')
        // רווח לפני סגירת סוגר
        .replace(/\s+\)/g, ')');
}

// ============================================================================
// פונקציות עזר נוספות
// ============================================================================

/**
 * ניקוי מהיר - רק הבסיס
 */
function quickClean(text) {
    return standardizeText(text, {
        removeInvisibleChars: true,
        normalizeWhitespace: true,
        normalizeLineBreaks: true,
        normalizeHyphens: false,
        fixVehicleNumbers: false,
        fixNumbers: false,
        normalizeHebrew: false,
        removeExtraSpaces: true
    });
}

/**
 * ניקוי עמוק - הכל
 */
function deepClean(text) {
    return standardizeText(text, {
        removeInvisibleChars: true,
        normalizeWhitespace: true,
        normalizeLineBreaks: true,
        normalizeHyphens: true,
        fixVehicleNumbers: true,
        fixNumbers: true,
        normalizeHebrew: true,
        removeExtraSpaces: true
    });
}

/**
 * ניקוי רק למספרי רכב
 */
function cleanForVehicles(text) {
    return standardizeText(text, {
        removeInvisibleChars: true,
        normalizeWhitespace: true,
        normalizeLineBreaks: false,
        normalizeHyphens: true,
        fixVehicleNumbers: true,
        fixNumbers: false,
        normalizeHebrew: false,
        removeExtraSpaces: true
    });
}

// ============================================================================
// דוגמאות שימוש
// ============================================================================

/**
 * דוגמה 1: שימוש בסיסי
 */
function example1() {
    const dirtyText = "741   -  69   - 103   טיפול    75000   ק\"מ";
    const clean = standardizeText(dirtyText);
    console.log("Before:", dirtyText);
    console.log("After:", clean);
    // Output: "741-69-103 טיפול 75000 ק\"מ"
}

/**
 * דוגמה 2: עם אופציות מותאמות
 */
function example2() {
    const dirtyText = "רכב  459\u00A0-\u00A006\u200B-\u00A0303";
    const clean = standardizeText(dirtyText, {
        fixVehicleNumbers: true,
        removeInvisibleChars: true
    });
    console.log("Before:", JSON.stringify(dirtyText));
    console.log("After:", clean);
    // Output: "רכב 459-06-303"
}

/**
 * דוגמה 3: ניקוי מהיר
 */
function example3() {
    const dirtyText = "מחיר:   1  234.56   ש\"ח";
    const clean = quickClean(dirtyText);
    console.log("Before:", dirtyText);
    console.log("After:", clean);
}

// ============================================================================
// טיפול ב-input מ-Make.com
// ============================================================================

if (typeof input !== 'undefined') {
    // קריאה מ-Make.com
    let textToClean = "";
    let options = {};

    // תמיכה בפורמטים שונים
    if (typeof input === 'string') {
        textToClean = input;
    } else if (input && input.text) {
        textToClean = input.text;
        options = input.options || {};
    } else if (input && input.AZURE_TEXT) {
        textToClean = input.AZURE_TEXT;
    }

    // ביצוע הניקוי
    const result = standardizeText(textToClean, options);

    // החזרת התוצאה
    console.log("=== TEXT STANDARDIZATION ===");
    console.log("Original length:", textToClean.length);
    console.log("Cleaned length:", result.length);
    console.log("Invisible chars removed:", textToClean.length - result.replace(/\s/g, '').length);
    console.log("\n=== RESULT ===");
    console.log(result);

    // return לסביבת Make
    return result;
}

// ייצוא לשימוש במודולים אחרים
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        standardizeText,
        quickClean,
        deepClean,
        cleanForVehicles,
        // פונקציות ספציפיות
        removeInvisibleCharacters,
        normalizeLineBreaks,
        normalizeWhitespace,
        normalizeHyphens,
        fixVehicleNumbers,
        fixNumbers,
        normalizeHebrew,
        removeExtraSpaces
    };
}

const fs = require('fs');

// קריאת הקוד - נטען כמודול זמני
delete require.cache[require.resolve('./v1.0-production.js')];

// קריאת ה-input
const inputData = JSON.parse(fs.readFileSync('QA/279992_input.txt', 'utf8'));

// הרצת הפונקציה
const inputObj = inputData[0];

// הרץ את הקוד ישירות במבנה Processing
const processInvoiceModule = require('./v1.0-production.js');
// הקוד Production מחזיר תוצאה ישירות כי יש לו את נקודת הכניסה בקובץ
// בואו נקרא את הקובץ ישירות

// הצג תוצאה
console.log('=== RESULT STATUS ===');
console.log('Status:', result.status);

if (result.status === 'success') {
    console.log('\n=== PINVOICES ===');
    const invoice = result.invoice_data.PINVOICES[0];
    console.log('SUPNAME:', invoice.SUPNAME);
    console.log('BOOKNUM:', invoice.BOOKNUM);
    console.log('IVDATE:', invoice.IVDATE);
    console.log('DEBIT:', invoice.DEBIT);
    console.log('CODE:', invoice.CODE);

    console.log('\n=== METADATA ===');
    console.log('OCR Invoice ID:', result.metadata.ocr_invoice_id);
    console.log('OCR Invoice Date:', result.metadata.ocr_invoice_date);
    console.log('OCR Total Amount:', result.metadata.ocr_total_amount);

    console.log('\n=== VALIDATION ===');
    console.log('All Valid:', result.validation.all_valid);
    console.log('Warnings:', result.validation.warnings);
} else {
    console.log('\n=== ERROR ===');
    console.log('Error Type:', result.error_type);
    console.log('Message:', result.message);
}

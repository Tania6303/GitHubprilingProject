// Test v1.7.5 - Simple test
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Production Invoice v1.7.5');
console.log('=====================================\n');

// Load the input
const inputPath = path.join(__dirname, 'EXEMPTS', 'input-15:11-2025-11-06-0.37438671944847757.js');
const inputContent = fs.readFileSync(inputPath, 'utf8');
const inputData = JSON.parse(inputContent.replace(/^'|'$/g, ''));

console.log('📥 Input loaded:');
const docsList = inputData.docs_list ? JSON.parse(inputData.docs_list) : [];
console.log('   - docs_list: ' + docsList.length + ' תעודות');

// Count invalid BOOKNUMs in input
const invalidInInput = docsList.filter(d => !d.BOOKNUM || d.BOOKNUM.length < 7);
console.log('   - תעודות עם BOOKNUM לא תקין ב-input: ' + invalidInInput.length);
if (invalidInInput.length > 0) {
    invalidInInput.forEach(doc => {
        console.log('      • DOCNO=' + doc.DOCNO + ', BOOKNUM="' + doc.BOOKNUM + '"');
    });
}

// Load production code with wrapper
const productionCodeRaw = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');

// Wrap in function to avoid global return
const wrappedCode = `
(function() {
    ${productionCodeRaw}
    return processInvoice;
})()
`;

console.log('\n🔧 Loading v1.7.5 code...');

const processInvoice = eval(wrappedCode);

console.log('✅ Code loaded successfully\n');
console.log('🚀 Running processInvoice...\n');
console.log('─'.repeat(60));

try {
    const result = processInvoice(inputData);

    console.log('─'.repeat(60));
    console.log('\n✅ הרצה הושלמה!\n');

    // Check results
    if (result && result.invoice_data && result.invoice_data.PINVOICES && result.invoice_data.PINVOICES[0]) {
        const invoice = result.invoice_data.PINVOICES[0];

        if (invoice.PIVDOC_SUBFORM) {
            console.log('📋 PIVDOC_SUBFORM:');
            console.log('   סה"כ תעודות: ' + invoice.PIVDOC_SUBFORM.length + '\n');

            invoice.PIVDOC_SUBFORM.forEach((doc, i) => {
                const isValid = doc.BOOKNUM && doc.BOOKNUM.length >= 7;
                const status = isValid ? '✅' : '❌';
                const lenInfo = doc.BOOKNUM ? doc.BOOKNUM.length : 0;
                console.log('   ' + (i + 1) + '. ' + status + ' DOCNO=' + doc.DOCNO + ', BOOKNUM=' + doc.BOOKNUM + ' (length=' + lenInfo + ')');
            });

            // Final check
            const invalidDocs = invoice.PIVDOC_SUBFORM.filter(d => !d.BOOKNUM || d.BOOKNUM.length < 7);

            console.log('\n' + '='.repeat(60));
            if (invalidDocs.length > 0) {
                console.log('❌ FAIL: נמצאו ' + invalidDocs.length + ' תעודות עם BOOKNUM לא תקין!');
                console.log('='.repeat(60));
                process.exit(1);
            } else {
                console.log('✅ PASS: כל התעודות עם BOOKNUM תקין (≥7 תווים)');
                console.log('✅ תיקון v1.7.5 עובד כראוי!');
                console.log('='.repeat(60));
            }
        } else {
            console.log('ℹ️  אין PIVDOC_SUBFORM (לא נמצאו תעודות)');
        }
    }

} catch (error) {
    console.log('─'.repeat(60));
    console.log('\n❌ שגיאה בהרצה:');
    console.log(error.message);
    console.log(error.stack);
    process.exit(1);
}

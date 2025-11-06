// Test v1.7.5 - BOOKNUM validation fix
const fs = require('fs');
const path = require('path');

// Load the input
const inputPath = path.join(__dirname, 'EXEMPTS', 'input-15:11-2025-11-06-0.37438671944847757.js');
const inputContent = fs.readFileSync(inputPath, 'utf8');
const inputData = JSON.parse(inputContent.replace(/^'|'$/g, ''));

console.log('🧪 Testing Production Invoice v1.7.5');
console.log('=====================================\n');

// Load and run the production code
const productionCode = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');
eval(productionCode);

// Run the code
console.log('📥 Input loaded:');
const docsList = inputData.docs_list ? JSON.parse(inputData.docs_list) : [];
console.log('   - docs_list: ' + docsList.length + ' תעודות');
console.log('   - AZURE_RESULT: ' + (inputData.AZURE_RESULT ? 'yes' : 'no'));
console.log('   - AZURE_TEXT_CLEAN: ' + (inputData.AZURE_TEXT_CLEAN ? inputData.AZURE_TEXT_CLEAN.substring(0, 50) + '...' : 'no') + '\n');

console.log('🔧 Running v1.7.5...\n');
console.log('─'.repeat(60));

try {
    const result = processInvoice(inputData);

    console.log('─'.repeat(60));
    console.log('\n✅ הרצה הושלמה!\n');

    // Check for PIVDOC_SUBFORM
    if (result && result.invoice_data && result.invoice_data.PINVOICES && result.invoice_data.PINVOICES[0]) {
        const invoice = result.invoice_data.PINVOICES[0];

        if (invoice.PIVDOC_SUBFORM) {
            console.log('📋 PIVDOC_SUBFORM נמצא:');
            console.log('   סה"כ תעודות: ' + invoice.PIVDOC_SUBFORM.length + '\n');

            invoice.PIVDOC_SUBFORM.forEach((doc, i) => {
                const status = doc.BOOKNUM && doc.BOOKNUM.length >= 7 ? '✅' : '❌';
                console.log('   ' + (i + 1) + '. ' + status + ' DOCNO=' + doc.DOCNO + ', BOOKNUM=' + doc.BOOKNUM + ' (length=' + (doc.BOOKNUM ? doc.BOOKNUM.length : 0) + ')');
            });

            // Check for invalid BOOKNUMs
            const invalidDocs = invoice.PIVDOC_SUBFORM.filter(d => !d.BOOKNUM || d.BOOKNUM.length < 7);
            if (invalidDocs.length > 0) {
                console.log('\n❌ נמצאו ' + invalidDocs.length + ' תעודות עם BOOKNUM לא תקין!');
            } else {
                console.log('\n✅ כל התעודות עם BOOKNUM תקין (≥7 תווים)');
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
}

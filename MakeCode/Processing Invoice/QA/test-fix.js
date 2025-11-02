const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('=== TESTING 279992 AFTER REGEX FIX ===\n');

const result = processInvoiceComplete(input);

console.log('Status:', result.status);

if (result.status === 'success') {
    console.log('\n✅ SUCCESS!\n');

    const inv = result.invoice_data.PINVOICES[0];
    console.log('SUPNAME:', inv.SUPNAME);
    console.log('BOOKNUM:', inv.BOOKNUM);
    console.log('IVDATE:', inv.IVDATE);
    console.log('Has DOCNO:', !!inv.DOCNO);
    console.log('Has IMPFNUM:', !!inv.IMPFNUM);
    console.log('Has PINVOICEITEMS_SUBFORM:', !!inv.PINVOICEITEMS_SUBFORM);

    if (inv.PINVOICEITEMS_SUBFORM) {
        console.log('Items count:', inv.PINVOICEITEMS_SUBFORM.length);
    }

    console.log('\n=== EXPECTED ===');
    console.log('Template 0: has_import=false, has_doc=false, debit=D');
    console.log('Should have PINVOICEITEMS_SUBFORM');

} else {
    console.log('\n❌ ERROR:', result.message);
}

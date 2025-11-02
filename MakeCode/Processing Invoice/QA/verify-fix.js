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
    console.log('\n✅ SUCCESS - Template matching worked!\n');

    const inv = result.invoice_data.PINVOICES[0];
    console.log('=== INVOICE DATA ===');
    console.log('SUPNAME:', inv.SUPNAME);
    console.log('BOOKNUM:', inv.BOOKNUM);
    console.log('IVDATE:', inv.IVDATE);
    console.log('DEBITTYPE:', inv.DEBITTYPE);
    console.log('Has DOCNO:', !!inv.DOCNO);
    console.log('Has IMPFNUM:', !!inv.IMPFNUM);
    console.log('Has PINVOICEITEMS_SUBFORM:', !!inv.PINVOICEITEMS_SUBFORM);

    if (inv.PINVOICEITEMS_SUBFORM) {
        console.log('Items count:', inv.PINVOICEITEMS_SUBFORM.length);
        console.log('\nFirst item:');
        console.log('  PARTNAME:', inv.PINVOICEITEMS_SUBFORM[0].PARTNAME);
        console.log('  TQUANT:', inv.PINVOICEITEMS_SUBFORM[0].TQUANT);
        console.log('  IPRICE:', inv.PINVOICEITEMS_SUBFORM[0].IPRICE);
    }

    console.log('\n=== EXPECTED RESULT ===');
    console.log('Should be Template 0 (regular invoice):');
    console.log('  - has_import: false');
    console.log('  - has_doc: false (no docs in docs_list)');
    console.log('  - debit_type: D (regular invoice)');
    console.log('  - Should have PINVOICEITEMS_SUBFORM with items');
    console.log('  - Should NOT have DOCNO or IMPFNUM');

} else {
    console.log('\n❌ ERROR:', result.message);
}

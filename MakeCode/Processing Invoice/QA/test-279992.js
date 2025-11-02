const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('=== TESTING 279992_INPUT.TXT ===\n');

try {
    const result = processInvoiceComplete(input);

    console.log('Status:', result.status);

    if (result.status === 'success') {
        console.log('\n=== EXECUTION REPORT ===');
        console.log('Found:');
        result.execution_report.found.forEach(f => console.log('  -', f));

        if (result.execution_report.errors.length > 0) {
            console.log('\nErrors:');
            result.execution_report.errors.forEach(e => console.log('  !', e));
        }

        console.log('\n=== INVOICE ===');
        const inv = result.invoice_data.PINVOICES[0];
        console.log('SUPNAME:', inv.SUPNAME);
        console.log('BOOKNUM:', inv.BOOKNUM);
        console.log('IVDATE:', inv.IVDATE);
        console.log('Has DOCNO:', !!inv.DOCNO);
        console.log('Has PIVDOC_SUBFORM:', !!inv.PIVDOC_SUBFORM);
        console.log('Has IMPFNUM:', !!inv.IMPFNUM);

    } else {
        console.log('ERROR:', result.message);
    }
} catch (error) {
    console.log('EXCEPTION:', error.message);
}

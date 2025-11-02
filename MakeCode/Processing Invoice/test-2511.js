const fs = require('fs');
const { processInvoiceComplete } = require('./v4.2-COMPLETE.js');

// Read test input
const rawData = JSON.parse(fs.readFileSync('QA/2511_input.txt', 'utf8'));

// Convert Make.com format to function input format
const makeModule = rawData[0];
const inputArray = makeModule.input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('=== Processing invoice 2511 ===');
console.log('Input keys:', Object.keys(input));

// Process
const result = processInvoiceComplete(input);

console.log('\n=== Result Status ===');
console.log('Status:', result.status);

if (result.status === 'error') {
    console.log('Error Type:', result.error_type);
    console.log('Message:', result.message);
} else {
    console.log('✓ Processing successful');
    console.log('\n=== Invoice Data ===');
    const invoice = result.invoice_data.PINVOICES[0];
    console.log('SUPNAME:', invoice.SUPNAME);
    console.log('Items count:', invoice.PINVOICEITEMS_SUBFORM ? invoice.PINVOICEITEMS_SUBFORM.length : 0);
    console.log('Has DOCNO:', !!invoice.DOCNO);
    console.log('Has PIVDOC_SUBFORM:', !!invoice.PIVDOC_SUBFORM);

    console.log('\n=== USER WARNINGS ===');
    if (result.user_warnings) {
        console.log('Total warnings:', result.user_warnings.total_count);
        console.log('Summary:', result.user_warnings.summary);
    } else {
        console.log('No user_warnings in result');
    }
}

const fs = require('fs');
const { processInvoiceComplete } = require('./v4.2-COMPLETE.js');

// Read test input
const rawData = JSON.parse(fs.readFileSync('QA/279992.TXT', 'utf8'));

// Convert Make.com format to function input format
const makeModule = rawData[0];
const inputArray = makeModule.input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('=== Processing invoice 279992 ===');
console.log('Input keys:', Object.keys(input));

// Process
const result = processInvoiceComplete(input);

console.log('\n=== Result Status ===');
console.log('Status:', result.status);

if (result.status === 'error') {
    console.log('Error Type:', result.error_type);
    console.log('Message:', result.message);
} else {
    console.log('\n=== USER WARNINGS ===');
    console.log(JSON.stringify(result.user_warnings, null, 2));
}

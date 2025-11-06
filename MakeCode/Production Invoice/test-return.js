// Test if IIFE returns value
const fs = require('fs');
const path = require('path');

// Load input
const inputFile = path.join(__dirname, 'EXEMPTS', 'input-11:11-2025-11-06-0.2223916893283866.js');
const inputContent = fs.readFileSync(inputFile, 'utf8');
const inputData = JSON.parse(inputContent.slice(1, -1));

// Load code
const code = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');

// Execute
const input = inputData;
const result = eval(code);

console.log('🧪 Testing IIFE return value...\n');
console.log('Result type:', typeof result);
console.log('Result:', JSON.stringify(result, null, 2).slice(0, 200) + '...');
console.log('\nStatus:', result?.status);
console.log('Has invoice_data:', !!result?.invoice_data);
console.log('BOOKNUM:', result?.invoice_data?.PINVOICES?.[0]?.BOOKNUM);
console.log('DOCNO:', result?.invoice_data?.PINVOICES?.[0]?.DOCNO);
console.log('Has items:', !!result?.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM);

if (result && result.status === 'success' && result.invoice_data) {
    console.log('\n✅ IIFE returns result correctly!');
    console.log('✅ Result is not empty: {}');
    process.exit(0);
} else {
    console.log('\n❌ IIFE does not return result or result is incomplete');
    process.exit(1);
}

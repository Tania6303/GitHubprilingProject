// Test that simulates exactly how Make.com runs the code
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Make.com style execution...\n');

// Load input
const inputFile = path.join(__dirname, 'EXEMPTS', 'input-11:11-2025-11-06-0.2223916893283866.js');
const inputContent = fs.readFileSync(inputFile, 'utf8');
const inputData = JSON.parse(inputContent.slice(1, -1));

// Load code
const code = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');

// Set up global input (like Make.com does)
global.input = inputData;

// Execute the code (like Make.com does)
// This should define 'result' as a global variable
eval(code);

// Check if result is accessible (like Make.com does)
console.log('📊 Checking global result variable...\n');

if (typeof result === 'undefined') {
    console.log('❌ FAILED: result is undefined!');
    console.log('This means Make.com will receive nothing.');
    process.exit(1);
}

if (result === null) {
    console.log('❌ FAILED: result is null!');
    process.exit(1);
}

if (typeof result !== 'object') {
    console.log('❌ FAILED: result is not an object, type:', typeof result);
    process.exit(1);
}

if (Object.keys(result).length === 0) {
    console.log('❌ FAILED: result is empty object {}');
    process.exit(1);
}

// Success checks
console.log('✅ result is accessible as global variable');
console.log('✅ result type:', typeof result);
console.log('✅ result.status:', result.status);
console.log('✅ result.invoice_data exists:', !!result.invoice_data);
console.log('✅ BOOKNUM:', result.invoice_data?.PINVOICES?.[0]?.BOOKNUM);
console.log('✅ DOCNO:', result.invoice_data?.PINVOICES?.[0]?.DOCNO);
console.log('✅ Has items:', !!result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM);

console.log('\n🎉 SUCCESS! Make.com will receive the result correctly!');

// Show what Make.com will see
console.log('\n📦 Make.com will receive:');
console.log(JSON.stringify({
    status: result.status,
    supplier_code: result.supplier_identification?.supplier_code,
    BOOKNUM: result.invoice_data?.PINVOICES?.[0]?.BOOKNUM,
    DOCNO: result.invoice_data?.PINVOICES?.[0]?.DOCNO,
    has_items: !!result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM,
    items_count: result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM?.length || 0
}, null, 2));

process.exit(0);

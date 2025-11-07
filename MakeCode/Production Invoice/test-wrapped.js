// Test that simulates Make.com wrapping the code in a function
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Make.com wrapper function style...\n');

// Load input
const inputFile = path.join(__dirname, 'EXEMPTS', 'input-11:11-2025-11-06-0.2223916893283866.js');
const inputContent = fs.readFileSync(inputFile, 'utf8');
const inputData = JSON.parse(inputContent.slice(1, -1));

// Load code
const codeContent = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');

// Simulate Make.com: wrap the code in a function
const wrappedCode = `
(function() {
    var input = arguments[0];
    ${codeContent}
})(inputData);
`;

console.log('📦 Executing code wrapped in function (like Make.com)...\n');

try {
    // Execute
    const result = eval(wrappedCode);

    console.log('✅ Execution completed!');
    console.log('');
    console.log('📊 Result from wrapped function:');
    console.log('  - type:', typeof result);

    if (result === undefined) {
        console.log('');
        console.log('❌ FAILED: result is undefined!');
        console.log('The return statement did not work properly.');
        process.exit(1);
    }

    if (result === null) {
        console.log('');
        console.log('❌ FAILED: result is null!');
        process.exit(1);
    }

    if (typeof result !== 'object' || Object.keys(result).length === 0) {
        console.log('');
        console.log('❌ FAILED: result is empty or not an object');
        console.log('result:', JSON.stringify(result));
        process.exit(1);
    }

    console.log('  - status:', result.status);
    console.log('  - BOOKNUM:', result.invoice_data?.PINVOICES?.[0]?.BOOKNUM);
    console.log('  - DOCNO:', result.invoice_data?.PINVOICES?.[0]?.DOCNO);
    console.log('  - has_items:', !!result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM);

    console.log('');
    console.log('🎉 SUCCESS! Make.com will receive the result correctly!');
    console.log('');
    console.log('📦 Make.com will receive:');
    console.log(JSON.stringify({
        status: result.status,
        supplier_code: result.supplier_identification?.supplier_code,
        BOOKNUM: result.invoice_data?.PINVOICES?.[0]?.BOOKNUM,
        DOCNO: result.invoice_data?.PINVOICES?.[0]?.DOCNO,
        has_items: !!result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM,
        items_count: result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM?.length || 0
    }, null, 2));

    process.exit(0);

} catch (error) {
    console.error('❌ Execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}

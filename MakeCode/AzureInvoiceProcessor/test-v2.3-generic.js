/**
 * Test v2.3 Generic UnidentifiedNumbers Extraction
 * Run: node test-v2.3-generic.js
 */

const fs = require('fs');
const path = require('path');

// Read the v2.3 code
const code = fs.readFileSync(path.join(__dirname, 'v2.0(30.10.25)'), 'utf8');

// Read test input
const testInput = JSON.parse(fs.readFileSync(path.join(__dirname, 'EXEMPTS/input.txt'), 'utf8'));

console.log('='.repeat(80));
console.log('Testing v2.3 Generic UnidentifiedNumbers Extraction');
console.log('='.repeat(80));

// Extract the input from the test file structure
const inputData = testInput[0].input;

// Build the input object for the processor
const processorInput = {};
for (const item of inputData) {
    if (item.name === 'contentlong') {
        processorInput.contentLong = item.value;
    } else if (item.name === 'pages') {
        processorInput.pages = item.value;
    } else if (item.name === 'tables') {
        processorInput.tables = item.value;
    } else if (item.name === 'documents') {
        processorInput.documents = item.value;
    } else if (item.name === 'modelid') {
        processorInput.modelId = item.value;
    }
}

console.log('\nInput structure:');
console.log('- contentLong:', processorInput.contentLong ? processorInput.contentLong.substring(0, 100) + '...' : 'missing');
console.log('- pages:', processorInput.pages ? processorInput.pages.length + ' pages' : 'missing');
console.log('- tables:', processorInput.tables ? processorInput.tables.length + ' tables' : 'missing');
console.log('- documents:', processorInput.documents ? processorInput.documents.length + ' documents' : 'missing');
console.log('- modelId:', processorInput.modelId || 'missing');

// Run the processor
console.log('\n' + '='.repeat(80));
console.log('Running processor...');
console.log('='.repeat(80));

try {
    // Wrap the Make.com module code in a function
    const wrappedCode = `
        (function(input) {
            ${code}
        })
    `;

    const func = eval(wrappedCode);
    const result = func(processorInput);

    console.log('\n✅ Processing completed successfully!\n');

    // Check for UnidentifiedNumbers
    const unidentifiedNumbers = result.data?.fields?.UnidentifiedNumbers || [];

    console.log('='.repeat(80));
    console.log(`UnidentifiedNumbers Found: ${unidentifiedNumbers.length}`);
    console.log('='.repeat(80));

    if (unidentifiedNumbers.length > 0) {
        console.log('\n📋 Extracted UnidentifiedNumbers:\n');
        unidentifiedNumbers.forEach((item, index) => {
            console.log(`${index + 1}. ${item.label}: ${item.value}`);
            if (item.context) {
                console.log(`   Context: ${item.context.substring(0, 80)}...`);
            }
        });

        // Look for specific codes we expect
        console.log('\n' + '='.repeat(80));
        console.log('Verification: Looking for expected codes');
        console.log('='.repeat(80));

        const expectedCodes = [
            { code: 'SH25SP005743', desc: 'תעודה (Delivery Note)' },
            { code: 'SO25SP004701', desc: 'הזמנה (Order)' },
            { code: '1005223', desc: 'הזמנתכם (Customer Order)' }
        ];

        expectedCodes.forEach(expected => {
            const found = unidentifiedNumbers.find(item => item.value === expected.code);
            if (found) {
                console.log(`✅ ${expected.desc}: ${expected.code} - FOUND`);
            } else {
                console.log(`❌ ${expected.desc}: ${expected.code} - MISSING`);
            }
        });
    } else {
        console.log('\n❌ No UnidentifiedNumbers extracted!');
        console.log('\nDebugging info:');
        console.log('- Total fields extracted:', result.data?.fields ? Object.keys(result.data.fields).length : 0);
        console.log('- Fields:', result.data?.fields ? Object.keys(result.data.fields).join(', ') : 'none');
    }

    // Write output
    const output = [{
        logs: { stdout: [], stderr: [] },
        executionTimeMs: 0,
        result: result
    }];

    fs.writeFileSync(
        path.join(__dirname, 'EXEMPTS/output-v2.3-test.txt'),
        JSON.stringify(output, null, 4),
        'utf8'
    );

    console.log('\n' + '='.repeat(80));
    console.log('✅ Output saved to: EXEMPTS/output-v2.3-test.txt');
    console.log('='.repeat(80));

} catch (error) {
    console.error('\n❌ Error running processor:');
    console.error(error.message);
    console.error(error.stack);
}

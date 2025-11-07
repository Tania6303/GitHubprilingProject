// Direct run test
const fs = require('fs');
const path = require('path');

console.log('🧪 Direct test - v1.7.5 validation\n');

// Load input exactly as Make.com does
const inputFile = path.join(__dirname, 'EXEMPTS', 'input-15:11-2025-11-06-0.37438671944847757.js');
const inputContent = fs.readFileSync(inputFile, 'utf8');

// Parse - remove surrounding quotes
const inputData = JSON.parse(inputContent.slice(1, -1));

// Check docs_list for invalid BOOKNUMs
console.log('Checking input for invalid BOOKNUMs...');
const docsListStr = inputData.docs_list;

// Count occurrences of BOOKNUM:"1"
const invalidMatches = docsListStr.match(/"BOOKNUM":"1"/g);
console.log('Found ' + (invalidMatches ? invalidMatches.length : 0) + ' occurrences of BOOKNUM:"1" in input\n');

// Load and run production code
const code = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');
global.input = inputData;

console.log('Running v1.7.5...\n');
console.log('─'.repeat(60));

eval(code);

console.log('─'.repeat(60) + '\n');

// Check result
if (result && result.invoice_data && result.invoice_data.PINVOICES && result.invoice_data.PINVOICES[0]) {
    const invoice = result.invoice_data.PINVOICES[0];

    if (invoice.PIVDOC_SUBFORM) {
        console.log('PIVDOC_SUBFORM results:');
        console.log('  Total docs: ' + invoice.PIVDOC_SUBFORM.length + '\n');

        invoice.PIVDOC_SUBFORM.forEach((doc, i) => {
            const valid = doc.BOOKNUM && doc.BOOKNUM.length >= 7;
            const mark = valid ? '✅' : '❌';
            console.log('  ' + (i+1) + '. ' + mark + ' DOCNO=' + doc.DOCNO + ', BOOKNUM="' + doc.BOOKNUM + '"');
        });

        // Check for BOOKNUM:"1"
        const bad = invoice.PIVDOC_SUBFORM.filter(d => d.BOOKNUM === '1');

        console.log('\n' + '='.repeat(60));
        if (bad.length > 0) {
            console.log('❌ FAIL: Found BOOKNUM="1" in output!');
            console.log('The validation did NOT work!');
        } else {
            console.log('✅ PASS: No BOOKNUM="1" in output!');
            console.log('✅ All invalid BOOKNUMs were filtered out!');
        }
        console.log('='.repeat(60));
    } else {
        console.log('No PIVDOC_SUBFORM in result');
    }
}

// Test v1.7.5 - BOOKNUM validation fix
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Production Invoice v1.7.5');
console.log('=====================================\n');

// Load input - the one with BOOKNUM="1" in docs_list
const inputFile = path.join(__dirname, 'EXEMPTS', 'input-15:11-2025-11-06-0.37438671944847757.js');
const inputContent = fs.readFileSync(inputFile, 'utf8');
const inputData = JSON.parse(inputContent.slice(1, -1)); // Remove surrounding quotes

console.log('📥 Input loaded:');
console.log('   File:', path.basename(inputFile));

// Parse docs_list to check for invalid BOOKNUMs
const docsListStr = inputData.docs_list;
const docsListArray = JSON.parse(docsListStr);
console.log('   Total docs in docs_list:', docsListArray.length);

// Find invalid docs
const invalidDocs = docsListArray.filter(d => !d.BOOKNUM || d.BOOKNUM.length < 7);
console.log('   ⚠️  Invalid BOOKNUMs in input:', invalidDocs.length);
if (invalidDocs.length > 0) {
    invalidDocs.forEach(doc => {
        console.log('      • DOCNO=' + doc.DOCNO + ', BOOKNUM="' + doc.BOOKNUM + '" (length=' + doc.BOOKNUM.length + ')');
    });
}

// Load code
console.log('\n🔧 Loading v1.7.5 code...');
const code = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');

// Check version
const versionMatch = code.match(/Production Invoice v(\d+\.\d+\.\d+)/);
if (versionMatch) {
    console.log('   Code version: ' + versionMatch[1]);
}

// Set up global input (like Make.com does)
global.input = inputData;

console.log('\n🚀 Running code...\n');
console.log('─'.repeat(70));

// Execute
eval(code);

console.log('─'.repeat(70));

// Check result
if (typeof result === 'undefined') {
    console.log('\n❌ FAILED: result is undefined');
    process.exit(1);
}

console.log('\n✅ Execution completed!\n');

// Analyze PIVDOC_SUBFORM
if (result && result.invoice_data && result.invoice_data.PINVOICES && result.invoice_data.PINVOICES[0]) {
    const invoice = result.invoice_data.PINVOICES[0];

    console.log('📋 Invoice details:');
    console.log('   BOOKNUM:', invoice.BOOKNUM);
    console.log('   SUPNAME:', invoice.SUPNAME);

    if (invoice.PIVDOC_SUBFORM && invoice.PIVDOC_SUBFORM.length > 0) {
        console.log('\n📋 PIVDOC_SUBFORM found:');
        console.log('   Total documents:', invoice.PIVDOC_SUBFORM.length);
        console.log();

        invoice.PIVDOC_SUBFORM.forEach((doc, i) => {
            const isValid = doc.BOOKNUM && doc.BOOKNUM.length >= 7;
            const status = isValid ? '✅' : '❌';
            const lenInfo = doc.BOOKNUM ? doc.BOOKNUM.length : 0;
            console.log('   ' + (i + 1) + '. ' + status + ' DOCNO=' + doc.DOCNO + ', BOOKNUM="' + doc.BOOKNUM + '" (length=' + lenInfo + ')');
        });

        // Final validation
        const outputInvalidDocs = invoice.PIVDOC_SUBFORM.filter(d => !d.BOOKNUM || d.BOOKNUM.length < 7);

        console.log('\n' + '='.repeat(70));
        console.log('TEST RESULTS:');
        console.log('='.repeat(70));
        console.log('Input had ' + invalidDocs.length + ' invalid BOOKNUM(s) in docs_list');
        console.log('Output has ' + outputInvalidDocs.length + ' invalid BOOKNUM(s) in PIVDOC_SUBFORM');

        if (outputInvalidDocs.length > 0) {
            console.log('\n❌ FAIL: Invalid BOOKNUMs were NOT filtered out!');
            console.log('The v1.7.5 validation is NOT working!');
            console.log('='.repeat(70));
            process.exit(1);
        } else {
            console.log('\n✅ PASS: All BOOKNUMs in output are valid (≥7 characters)');
            console.log('✅ v1.7.5 validation is working correctly!');
            console.log('✅ Invalid BOOKNUMs (like "1") were successfully filtered out!');
            console.log('='.repeat(70));
        }
    } else {
        console.log('\nℹ️  No PIVDOC_SUBFORM found (no documents in output)');
        console.log('This might mean no documents matched in AZURE_TEXT');
    }
} else {
    console.log('\n⚠️  No invoice data in result');
}

process.exit(0);

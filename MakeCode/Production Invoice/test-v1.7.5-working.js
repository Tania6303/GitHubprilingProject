// Test v1.7.5 - BOOKNUM validation (working version)
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Production Invoice v1.7.5');
console.log('Testing BOOKNUM validation fix\n');
console.log('='.repeat(70) + '\n');

// STEP 1: Analyze OLD output (before fix)
console.log('📊 STEP 1: Analyzing OLD output (v1.7.1 - before fix)');
console.log('─'.repeat(70));

const oldOutputFile = path.join(__dirname, 'EXEMPTS', 'output-15:11-2025-11-06-0.5101386343096652.js');
const oldOutputContent = fs.readFileSync(oldOutputFile, 'utf8');
const oldOutput = JSON.parse(oldOutputContent.slice(1, -1));

if (oldOutput.result.invoice_data?.PINVOICES?.[0]?.PIVDOC_SUBFORM) {
    const oldDocs = oldOutput.result.invoice_data.PINVOICES[0].PIVDOC_SUBFORM;
    console.log('Total documents in old output: ' + oldDocs.length + '\n');

    oldDocs.forEach((doc, i) => {
        const valid = doc.BOOKNUM && doc.BOOKNUM.length >= 7;
        const mark = valid ? '✅' : '❌';
        console.log('  ' + (i + 1) + '. ' + mark + ' DOCNO=' + doc.DOCNO + ', BOOKNUM="' + doc.BOOKNUM + '" (length=' + doc.BOOKNUM.length + ')');
    });

    const oldBad = oldDocs.filter(d => !d.BOOKNUM || d.BOOKNUM.length < 7);
    console.log('\n⚠️  OLD OUTPUT HAD: ' + oldBad.length + ' invalid BOOKNUM(s)');
    if (oldBad.length > 0) {
        oldBad.forEach(d => {
            console.log('     • DOCNO=' + d.DOCNO + ' with BOOKNUM="' + d.BOOKNUM + '"');
        });
    }
}

// STEP 2: Run NEW code
console.log('\n\n📊 STEP 2: Running NEW code (v1.7.5 - with fix)');
console.log('─'.repeat(70));

// Load input
const inputFile = path.join(__dirname, 'EXEMPTS', 'input-15:11-2025-11-06-0.37438671944847757.js');
const inputContent = fs.readFileSync(inputFile, 'utf8');
const inputData = JSON.parse(inputContent.slice(1, -1));

// Load NEW code
const code = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');

// Set up global input (like Make.com does)
global.input = inputData;

// Execute the code
try {
    eval(code);

    console.log('✅ Code executed successfully\n');

    // Analyze new output
    if (result && result.invoice_data && result.invoice_data.PINVOICES && result.invoice_data.PINVOICES[0]) {
        const invoice = result.invoice_data.PINVOICES[0];

        if (invoice.PIVDOC_SUBFORM && invoice.PIVDOC_SUBFORM.length > 0) {
            console.log('Total documents in new output: ' + invoice.PIVDOC_SUBFORM.length + '\n');

            invoice.PIVDOC_SUBFORM.forEach((doc, i) => {
                const valid = doc.BOOKNUM && doc.BOOKNUM.length >= 7;
                const mark = valid ? '✅' : '❌';
                console.log('  ' + (i + 1) + '. ' + mark + ' DOCNO=' + doc.DOCNO + ', BOOKNUM="' + doc.BOOKNUM + '" (length=' + doc.BOOKNUM.length + ')');
            });

            const newBad = invoice.PIVDOC_SUBFORM.filter(d => !d.BOOKNUM || d.BOOKNUM.length < 7);

            console.log('\n✅ NEW OUTPUT HAS: ' + newBad.length + ' invalid BOOKNUM(s)');

            // FINAL VERDICT
            console.log('\n\n' + '='.repeat(70));
            console.log('FINAL TEST RESULTS:');
            console.log('='.repeat(70));

            if (newBad.length > 0) {
                console.log('❌ FAIL: v1.7.5 validation did NOT work!');
                console.log('Invalid BOOKNUMs are still in the output!');
                process.exit(1);
            } else if (invoice.PIVDOC_SUBFORM.some(d => d.BOOKNUM === '1')) {
                console.log('❌ FAIL: BOOKNUM="1" still exists in output!');
                process.exit(1);
            } else {
                console.log('✅ PASS: All BOOKNUMs in output are valid!');
                console.log('✅ v1.7.5 successfully filtered out BOOKNUM="1"!');
                console.log('\nBefore: Had 1 document with BOOKNUM="1"');
                console.log('After:  BOOKNUM="1" was filtered out!');
                console.log('\n🎉 The fix is working correctly!');
            }
            console.log('='.repeat(70));
        } else {
            console.log('⚠️  No PIVDOC_SUBFORM in new output');
        }
    } else {
        console.log('⚠️  No invoice data in result');
    }

} catch (error) {
    console.log('\n❌ Error running code:');
    console.log(error.message);
    process.exit(1);
}

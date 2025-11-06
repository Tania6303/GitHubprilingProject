const fs = require('fs');

// Load input
const inputContent = fs.readFileSync('EXEMPTS/input-12:11-2025-11-06-0.8039356340816306.js', 'utf8');
const input = JSON.parse(inputContent.slice(1, -1));

console.log('🧪 Testing v1.6.9 with vehicle example...');
console.log('');

// Load and execute code
const codeContent = fs.readFileSync('v1.0-production.js', 'utf8');

// Remove the final return statement for eval
const codeWithoutReturn = codeContent.replace(/^return result;$/m, '// return result;');

try {
    eval(codeWithoutReturn);

    console.log('');
    console.log('==================== RESULT ====================');

    if (result.status === 'error') {
        console.log('❌ Status: ERROR');
        console.log('Message:', result.message);
        if (result.execution_report) {
            console.log('');
            console.log('Execution report:');
            console.log(JSON.stringify(result.execution_report, null, 2));
        }
    } else if (result.invoice_data && result.invoice_data.PINVOICES && result.invoice_data.PINVOICES[0]) {
        const invoice = result.invoice_data.PINVOICES[0];
        console.log('✅ Status: SUCCESS');
        console.log('');
        console.log('📋 Invoice:');
        console.log('  BOOKNUM:', invoice.BOOKNUM);
        console.log('  IVDATE:', invoice.IVDATE);
        console.log('  SUPNAME:', invoice.SUPNAME);
        console.log('');

        if (invoice.PINVOICEITEMS_SUBFORM) {
            console.log('📦 Items:', invoice.PINVOICEITEMS_SUBFORM.length);
            console.log('');
            invoice.PINVOICEITEMS_SUBFORM.forEach((item, i) => {
                console.log(`  [${i}] PARTNAME: ${item.PARTNAME}`);
                console.log(`      PDES: ${item.PDES}`);
                console.log(`      ACCNAME: ${item.ACCNAME}`);
                console.log(`      TQUANT: ${item.TQUANT}`);
                console.log(`      PRICE: ${item.PRICE}`);
                if (item._learningNote) {
                    console.log(`      NOTE: ${item._learningNote}`);
                }
                console.log('');
            });
        } else {
            console.log('❌ No PINVOICEITEMS_SUBFORM');
        }

        if (invoice.DOCNO) {
            console.log('📄 DOCNO:', invoice.DOCNO);
        }
    }

    console.log('');
    console.log('Full result keys:', Object.keys(result));

} catch (error) {
    console.error('❌ Error running code:', error.message);
    console.error(error.stack);
}

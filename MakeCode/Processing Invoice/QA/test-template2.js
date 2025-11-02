const fs = require('fs');

// יצירת input מדומה עם תבנית 2 (זיכוי)
const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

// שינוי InvoiceTotal לשלילי (זיכוי)
input.AZURE_RESULT.data.fields.InvoiceTotal_amount = -5000;

const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

console.log('='.repeat(80));
console.log('בדיקה: תבנית 2 (זיכוי) לספק 279992');
console.log('='.repeat(80));

const result = processInvoiceComplete(input);

console.log('\n📊 Status:', result.status);

if (result.status === 'success') {
    const inv = result.invoice_data.PINVOICES[0];

    console.log('\n=== זיהוי תבנית ===');
    console.log('DEBIT:', inv.DEBIT);
    console.log('InvoiceTotal:', input.AZURE_RESULT.data.fields.InvoiceTotal_amount);

    console.log('\n=== LLM PROMPT ===');
    console.log('Document Type:', result.llm_prompt.document_type);
    console.log('Overview:', result.llm_prompt.instructions.overview);

    console.log('\n=== TECHNICAL CONFIG ===');
    console.log('Document Type:', result.technical_config.document_type);

    console.log('\n=== PROCESSING SCENARIO ===');
    console.log('check_docs:', result.processing_scenario.check_docs);
    console.log('check_import:', result.processing_scenario.check_import);

    console.log('\n=== ציפיות לתבנית 2 (זיכוי) ===');
    const expectedDocType = "זיכוי רגיל עם פירוט";
    const expectedTechType = "credit_note";

    console.log('✓ Document Type צריך להיות:', expectedDocType);
    console.log('  קיבלנו:', result.llm_prompt.document_type);
    console.log('  תואם?', result.llm_prompt.document_type === expectedDocType ? '✅' : '❌');

    console.log('✓ Technical document_type צריך להיות:', expectedTechType);
    console.log('  קיבלנו:', result.technical_config.document_type);
    console.log('  תואם?', result.technical_config.document_type === expectedTechType ? '✅' : '❌');

    console.log('✓ DEBIT צריך להיות C');
    console.log('  תואם?', inv.DEBIT === 'C' ? '✅' : '❌');
}

console.log('\n' + '='.repeat(80));

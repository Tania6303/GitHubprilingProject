const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('='.repeat(80));
console.log('בדיקת מבנה מלא - תמיכה במספר תבניות');
console.log('='.repeat(80));

const result = processInvoiceComplete(input);

console.log('\n📊 Status:', result.status);

if (result.status === 'success') {
    console.log('\n=== 1. מבנה התוצאה הכללי ===');
    console.log('Keys:', Object.keys(result));

    console.log('\n=== 2. invoice_data ===');
    console.log('Keys in invoice_data:', Object.keys(result.invoice_data));
    console.log('PINVOICES.length:', result.invoice_data.PINVOICES.length);
    console.log('\nחשבונית לכל תבנית:');
    result.invoice_data.PINVOICES.forEach((invoice, i) => {
        console.log(`  [${i}] SUPNAME: ${invoice.SUPNAME}, DEBIT: ${invoice.DEBIT}, BOOKNUM: ${invoice.BOOKNUM}`);
        const fields = Object.keys(invoice).filter(k => k !== 'SUPNAME' && k !== 'CODE' && k !== 'DEBIT' && k !== 'IVDATE' && k !== 'BOOKNUM');
        console.log(`      שדות נוספים: ${fields.join(', ')}`);
    });

    console.log('\n=== 3. llm_prompt ===');
    console.log('document_type (נבחר):', result.llm_prompt.document_type);
    console.log('all_templates.length:', result.llm_prompt.all_templates.length);

    console.log('\n=== 4. technical_config ===');
    console.log('document_type (נבחר):', result.technical_config.document_type);
    console.log('all_templates.length:', result.technical_config.all_templates.length);

    console.log('\n=== 5. processing_scenario ===');
    console.log('Keys in processing_scenario:', Object.keys(result.processing_scenario));
    console.log('Selected scenario:');
    console.log(`  check_docs: ${result.processing_scenario.check_docs}`);
    console.log(`  check_import: ${result.processing_scenario.check_import}`);
    console.log(`  check_vehicles: ${result.processing_scenario.check_vehicles}`);

    if (result.processing_scenario.all_templates) {
        console.log('\nall_templates.length:', result.processing_scenario.all_templates.length);
        console.log('Scenarios לכל תבנית:');
        result.processing_scenario.all_templates.forEach((scenario, i) => {
            console.log(`  [${i}] docs:${scenario.check_docs}, import:${scenario.check_import}, vehicles:${scenario.check_vehicles}`);
        });
    }

    console.log('\n=== 6. ציפיות ===');
    const hasThreeInvoices = result.invoice_data.PINVOICES.length === 3;
    const hasProcessingScenarioTemplates = result.processing_scenario.all_templates && result.processing_scenario.all_templates.length === 3;
    const structureUnchanged = Object.keys(result).length === 5; // status, invoice_data, llm_prompt, technical_config, processing_scenario

    console.log('✓ יש 3 חשבוניות ב-PINVOICES:', hasThreeInvoices ? '✅' : '❌');
    console.log('✓ יש all_templates ב-processing_scenario:', hasProcessingScenarioTemplates ? '✅' : '❌');
    console.log('✓ מבנה לא השתנה (5 שדות ברמה עליונה):', structureUnchanged ? '✅' : '❌');

    if (hasThreeInvoices && hasProcessingScenarioTemplates && structureUnchanged) {
        console.log('\n🎉 מושלם! כל התבניות נוצרו בהצלחה!');
    } else {
        console.log('\n❌ יש בעיה');
    }
}

console.log('\n' + '='.repeat(80));

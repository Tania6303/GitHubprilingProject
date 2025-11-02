const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('מייצר תבנית JSON מלאה...\n');

const result = processInvoiceComplete(input);

// שמירה לקובץ JSON מעוצב
const outputFile = 'OUTPUT_TEMPLATE.json';
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');

console.log('✅ תבנית JSON נשמרה בקובץ:', outputFile);
console.log('\n=== מבנה כללי ===');
console.log('Top-level keys:', Object.keys(result));
console.log('\ninvoice_data.PINVOICES.length:', result.invoice_data.PINVOICES.length);
console.log('llm_prompt.all_templates.length:', result.llm_prompt.all_templates.length);
console.log('technical_config.all_templates.length:', result.technical_config.all_templates.length);
console.log('processing_scenario.all_templates.length:', result.processing_scenario.all_templates.length);

console.log('\n=== גודל הקובץ ===');
const stats = fs.statSync(outputFile);
console.log(`${(stats.size / 1024).toFixed(2)} KB`);

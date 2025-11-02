const fs = require('fs');
const { processInvoiceComplete } = require('./v4.2-COMPLETE.js');

// Read test input
const rawData = JSON.parse(fs.readFileSync('QA/2511_input.txt', 'utf8'));

// Convert Make.com format
const makeModule = rawData[0];
const inputArray = makeModule.input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('=== Processing invoice 2511 ===');

// Process
const result = processInvoiceComplete(input);

console.log('\n=== Result Status ===');
console.log('Status:', result.status);

if (result.status === 'error') {
    console.log('Error Type:', result.error_type);
    console.log('Message:', result.message);
} else {
    console.log('\n=== LLM PROMPT ===');
    console.log('Supplier Code:', result.llm_prompt.supplier_code);
    console.log('Supplier Name:', result.llm_prompt.supplier_name);
    console.log('Document Type:', result.llm_prompt.document_type);
    console.log('\nOverview:', result.llm_prompt.instructions.overview);
    console.log('\nProcessing Steps:');
    result.llm_prompt.instructions.processing_steps.forEach(step => {
        console.log('  ', step);
    });
}

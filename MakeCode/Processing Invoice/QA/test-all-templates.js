const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('='.repeat(80));
console.log('בדיקה: כל 3 התבניות מיוצרות בפלט');
console.log('='.repeat(80));

const result = processInvoiceComplete(input);

console.log('\n📊 Status:', result.status);

if (result.status === 'success') {
    console.log('\n=== תבנית שנבחרה ===');
    console.log('selected_template_index:', result.selected_template_index);

    console.log('\n=== כמה תבניות בפלט? ===');
    console.log('all_llm_prompts.length:', result.all_llm_prompts.length);
    console.log('all_technical_configs.length:', result.all_technical_configs.length);

    console.log('\n=== כל התבניות (LLM Prompts) ===');
    result.all_llm_prompts.forEach((prompt, i) => {
        console.log(`\nתבנית ${i}:`);
        console.log('  document_type:', prompt.document_type);
        console.log('  overview:', prompt.instructions.overview.substring(0, 80) + '...');
    });

    console.log('\n=== כל התבניות (Technical Configs) ===');
    result.all_technical_configs.forEach((config, i) => {
        console.log(`\nתבנית ${i}:`);
        console.log('  document_type:', config.document_type);
        console.log('  has documents rules?', !!config.extraction_rules.documents);
    });

    console.log('\n=== backward compatibility ===');
    console.log('llm_prompt (selected):', result.llm_prompt.document_type);
    console.log('technical_config (selected):', result.technical_config.document_type);

    console.log('\n=== ציפיות ===');
    const expectedTemplates = 3;
    const allPromptsCorrect = result.all_llm_prompts.length === expectedTemplates;
    const allConfigsCorrect = result.all_technical_configs.length === expectedTemplates;
    const selectedCorrect = result.selected_template_index === 0;

    console.log('✓ צריך להיות 3 prompts:', allPromptsCorrect ? '✅' : '❌', `(${result.all_llm_prompts.length})`);
    console.log('✓ צריך להיות 3 configs:', allConfigsCorrect ? '✅' : '❌', `(${result.all_technical_configs.length})`);
    console.log('✓ נבחרה תבנית 0:', selectedCorrect ? '✅' : '❌', `(${result.selected_template_index})`);

    console.log('\n=== תבניות שונות? ===');
    const uniqueDocTypes = new Set(result.all_llm_prompts.map(p => p.document_type));
    console.log('מספר document_type שונים:', uniqueDocTypes.size);
    console.log('Document types:', Array.from(uniqueDocTypes));

    if (uniqueDocTypes.size === 3) {
        console.log('✅ מצוין! כל תבנית יש document_type שונה!');
    } else {
        console.log('❌ בעיה - צריך להיות 3 document_type שונים');
    }
}

console.log('\n' + '='.repeat(80));

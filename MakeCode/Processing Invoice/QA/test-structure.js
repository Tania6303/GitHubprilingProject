const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('='.repeat(80));
console.log('בדיקת מבנה הפלט - all_templates בתוך llm_prompt');
console.log('='.repeat(80));

const result = processInvoiceComplete(input);

console.log('\n📊 Status:', result.status);

if (result.status === 'success') {
    console.log('\n=== מבנה הפלט ===');
    console.log('Keys in result:');
    Object.keys(result).forEach(key => {
        console.log('  -', key);
    });

    console.log('\n=== llm_prompt ===');
    console.log('Keys in llm_prompt:');
    Object.keys(result.llm_prompt).forEach(key => {
        console.log('  -', key);
    });

    console.log('\nllm_prompt.supplier_code:', result.llm_prompt.supplier_code);
    console.log('llm_prompt.document_type:', result.llm_prompt.document_type);
    console.log('llm_prompt.all_templates exists?', !!result.llm_prompt.all_templates);
    console.log('llm_prompt.all_templates.length:', result.llm_prompt.all_templates?.length);

    console.log('\n=== technical_config ===');
    console.log('Keys in technical_config:');
    Object.keys(result.technical_config).forEach(key => {
        console.log('  -', key);
    });

    console.log('\ntechnical_config.supplier_code:', result.technical_config.supplier_code);
    console.log('technical_config.document_type:', result.technical_config.document_type);
    console.log('technical_config.all_templates exists?', !!result.technical_config.all_templates);
    console.log('technical_config.all_templates.length:', result.technical_config.all_templates?.length);

    console.log('\n=== all_templates content ===');
    if (result.llm_prompt.all_templates) {
        result.llm_prompt.all_templates.forEach((template, i) => {
            console.log(`Template ${i}:`, template.document_type);
        });
    }

    console.log('\n=== ציפיות ===');
    const hasAllTemplatesInLlm = result.llm_prompt.hasOwnProperty('all_templates');
    const hasAllTemplatesInConfig = result.technical_config.hasOwnProperty('all_templates');
    const noTopLevelAllPrompts = !result.hasOwnProperty('all_llm_prompts');
    const noTopLevelAllConfigs = !result.hasOwnProperty('all_technical_configs');
    const correctCount = result.llm_prompt.all_templates?.length === 3;

    console.log('✓ llm_prompt.all_templates קיים:', hasAllTemplatesInLlm ? '✅' : '❌');
    console.log('✓ technical_config.all_templates קיים:', hasAllTemplatesInConfig ? '✅' : '❌');
    console.log('✓ אין all_llm_prompts ברמה העליונה:', noTopLevelAllPrompts ? '✅' : '❌');
    console.log('✓ אין all_technical_configs ברמה העליונה:', noTopLevelAllConfigs ? '✅' : '❌');
    console.log('✓ יש 3 תבניות:', correctCount ? '✅' : '❌');

    if (hasAllTemplatesInLlm && hasAllTemplatesInConfig && noTopLevelAllPrompts && noTopLevelAllConfigs && correctCount) {
        console.log('\n🎉 מושלם! המבנה תקין!');
    } else {
        console.log('\n❌ יש בעיה במבנה');
    }
}

console.log('\n' + '='.repeat(80));

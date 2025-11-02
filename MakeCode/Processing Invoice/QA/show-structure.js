const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');
const fs = require('fs');

// טעינת הקובץ מהבדיקה
const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

const result = processInvoiceComplete(input);

console.log('===============================================');
console.log('מבנה התוצאה המלא');
console.log('===============================================\n');

console.log('📋 שדות ברמה העליונה:');
console.log(JSON.stringify(Object.keys(result), null, 2));

console.log('\n\n🔷 llm_prompt - שדות:');
console.log(Object.keys(result.llm_prompt));

console.log('\n📝 llm_prompt.document_type (תבנית שנבחרה):');
console.log(`   "${result.llm_prompt.document_type}"`);

console.log('\n📚 llm_prompt.all_templates - כל 3 התבניות:');
result.llm_prompt.all_templates.forEach((t, i) => {
  console.log(`   [${i}] document_type: "${t.document_type}"`);
  console.log(`       supplier_code: ${t.supplier_code}`);
  console.log(`       keys: ${Object.keys(t).length} fields`);
});

console.log('\n\n🔧 technical_config - שדות:');
console.log(Object.keys(result.technical_config));

console.log('\n⚙️  technical_config.document_type (תבנית שנבחרה):');
console.log(`   "${result.technical_config.document_type}"`);

console.log('\n📚 technical_config.all_templates - כל 3 התבניות:');
result.technical_config.all_templates.forEach((t, i) => {
  console.log(`   [${i}] document_type: "${t.document_type}"`);
  console.log(`       supplier_code: ${t.supplier_code}`);
  console.log(`       keys: ${Object.keys(t).length} fields`);
});

console.log('\n\n===============================================');
console.log('דוגמה למבנה JSON (מקוצר):');
console.log('===============================================\n');

const example = {
  status: result.status,
  selected_template_index: result.selected_template_index,
  llm_prompt: {
    supplier_code: result.llm_prompt.supplier_code,
    document_type: result.llm_prompt.document_type,
    instructions: "...",
    all_templates: result.llm_prompt.all_templates.map(t => ({
      supplier_code: t.supplier_code,
      document_type: t.document_type,
      instructions: "..."
    }))
  },
  technical_config: {
    supplier_code: result.technical_config.supplier_code,
    document_type: result.technical_config.document_type,
    extraction_rules: "...",
    all_templates: result.technical_config.all_templates.map(t => ({
      supplier_code: t.supplier_code,
      document_type: t.document_type,
      extraction_rules: "..."
    }))
  }
};

console.log(JSON.stringify(example, null, 2));

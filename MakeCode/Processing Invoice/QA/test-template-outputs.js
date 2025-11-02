const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('='.repeat(80));
console.log('בדיקה מפורטת: תבנית 0 לספק 279992');
console.log('='.repeat(80));

const result = processInvoiceComplete(input);

console.log('\n📊 Status:', result.status);

if (result.status === 'success') {
    console.log('\n=== LLM PROMPT ===');
    console.log('Document Type:', result.llm_prompt.document_type);
    console.log('Overview:', result.llm_prompt.instructions.overview);
    console.log('Processing Steps:');
    result.llm_prompt.instructions.processing_steps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
    });

    console.log('\n=== TECHNICAL CONFIG ===');
    console.log('Document Type:', result.technical_config.document_type);
    console.log('Has documents extraction rules?', !!result.technical_config.extraction_rules.documents);
    console.log('Has vehicles extraction rules?', !!result.technical_config.extraction_rules.vehicles);

    console.log('\n=== PROCESSING SCENARIO ===');
    console.log('check_docs:', result.processing_scenario.check_docs);
    console.log('check_import:', result.processing_scenario.check_import);
    console.log('check_vehicles:', result.processing_scenario.check_vehicles);

    console.log('\n=== ציפיות לתבנית 0 (חשבונית רגילה) ===');
    console.log('✓ Document Type צריך להיות: "חשבונית רגילה עם פירוט"');
    console.log('  קיבלנו:', result.llm_prompt.document_type);
    console.log('✓ Technical document_type צריך להיות: "regular_invoice"');
    console.log('  קיבלנו:', result.technical_config.document_type);
    console.log('✓ Overview לא צריך לכלול "יבוא" או "תעודות" או "רכב"');
    console.log('  קיבלנו:', result.llm_prompt.instructions.overview);
    console.log('✓ לא צריך documents extraction rules');
    console.log('  קיבלנו:', result.technical_config.extraction_rules.documents ? 'יש (שגיאה!)' : 'אין (נכון!)');
    console.log('✓ check_docs צריך להיות false');
    console.log('  קיבלנו:', result.processing_scenario.check_docs);

    // בדיקה אם הכל תקין
    const isDocTypeCorrect = result.llm_prompt.document_type === "חשבונית רגילה עם פירוט";
    const isTechTypeCorrect = result.technical_config.document_type === "regular_invoice";
    const isOverviewCorrect = !result.llm_prompt.instructions.overview.includes('יבוא') &&
                              !result.llm_prompt.instructions.overview.includes('תעודות') &&
                              !result.llm_prompt.instructions.overview.includes('רכב');
    const isDocsRuleCorrect = !result.technical_config.extraction_rules.documents;
    const isCheckDocsCorrect = result.processing_scenario.check_docs === false;

    console.log('\n=== תוצאה סופית ===');
    if (isDocTypeCorrect && isTechTypeCorrect && isOverviewCorrect && isDocsRuleCorrect && isCheckDocsCorrect) {
        console.log('🎉 מושלם! כל הפלטים משתמשים בתבנית הנכונה!');
    } else {
        console.log('❌ יש בעיות:');
        if (!isDocTypeCorrect) console.log('  - Document Type לא תקין');
        if (!isTechTypeCorrect) console.log('  - Technical document_type לא תקין');
        if (!isOverviewCorrect) console.log('  - Overview לא תקין');
        if (!isDocsRuleCorrect) console.log('  - יש documents rules למרות שלא צריך');
        if (!isCheckDocsCorrect) console.log('  - check_docs לא false');
    }
}

console.log('\n' + '='.repeat(80));

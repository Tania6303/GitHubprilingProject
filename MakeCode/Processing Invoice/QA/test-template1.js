const fs = require('fs');

// יצירת input מדומה עם תבנית 1 (יבוא + תעודות)
const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

// שינוי ל-INPUT שמתאים לתבנית 1: יבוא + תעודות
input.import_files = {
    IMPFILES: ['{"IMPFNUM":"25c00104"}']
};

input.docs_list = {
    DOC_YES_NO: "Y",
    list_of_docs: ['{"DOCNO":"25025301","BOOKNUM":"108379736","TOTQUANT":1}']
};

// הוספת BOOKNUM ל-UnidentifiedNumbers
if (!input.AZURE_RESULT.data.fields.UnidentifiedNumbers) {
    input.AZURE_RESULT.data.fields.UnidentifiedNumbers = [];
}
input.AZURE_RESULT.data.fields.UnidentifiedNumbers.push({
    label: "מס׳ הקצאה",
    value: "108379736"
});

const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

console.log('='.repeat(80));
console.log('בדיקה: תבנית 1 (יבוא + תעודות) לספק 279992');
console.log('='.repeat(80));

const result = processInvoiceComplete(input);

console.log('\n📊 Status:', result.status);

if (result.status === 'success') {
    const inv = result.invoice_data.PINVOICES[0];

    console.log('\n=== זיהוי תבנית ===');
    console.log('יש יבוא (IMPFNUM)?', !!inv.IMPFNUM ? 'כן (' + inv.IMPFNUM + ')' : 'לא');
    console.log('יש תעודות (DOCNO)?', !!inv.DOCNO ? 'כן (' + inv.DOCNO + ')' : 'לא');

    console.log('\n=== LLM PROMPT ===');
    console.log('Document Type:', result.llm_prompt.document_type);
    console.log('Overview:', result.llm_prompt.instructions.overview);

    console.log('\n=== TECHNICAL CONFIG ===');
    console.log('Document Type:', result.technical_config.document_type);
    console.log('Has documents extraction rules?', !!result.technical_config.extraction_rules.documents);

    console.log('\n=== PROCESSING SCENARIO ===');
    console.log('check_docs:', result.processing_scenario.check_docs);
    console.log('check_import:', result.processing_scenario.check_import);

    console.log('\n=== ציפיות לתבנית 1 (יבוא + תעודות) ===');
    const expectedDocType = "חשבונית עם תיק יבוא עם תעודות";
    const expectedTechType = "import_with_docs_invoice";

    console.log('✓ Document Type צריך להיות:', expectedDocType);
    console.log('  קיבלנו:', result.llm_prompt.document_type);
    console.log('  תואם?', result.llm_prompt.document_type === expectedDocType ? '✅' : '❌');

    console.log('✓ Technical document_type צריך להיות:', expectedTechType);
    console.log('  קיבלנו:', result.technical_config.document_type);
    console.log('  תואם?', result.technical_config.document_type === expectedTechType ? '✅' : '❌');

    console.log('✓ Overview צריך לכלול "יבוא + תעודות"');
    console.log('  תואם?', result.llm_prompt.instructions.overview.includes('יבוא + תעודות') ? '✅' : '❌');

    console.log('✓ צריך documents extraction rules');
    console.log('  תואם?', !!result.technical_config.extraction_rules.documents ? '✅' : '❌');

    console.log('✓ check_docs צריך להיות true');
    console.log('  תואם?', result.processing_scenario.check_docs === true ? '✅' : '❌');

    console.log('✓ check_import צריך להיות true');
    console.log('  תואם?', result.processing_scenario.check_import === true ? '✅' : '❌');
}

console.log('\n' + '='.repeat(80));

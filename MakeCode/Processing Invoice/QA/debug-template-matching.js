const fs = require('fs');

// טעינת הפונקציות
const code = fs.readFileSync('../v4.2-COMPLETE.js', 'utf8');

// חילוץ פונקציות
eval(code.match(/function checkImportExists[\s\S]*?^}/m)[0]);
eval(code.match(/function checkDocsInOCR[\s\S]*?^}/m)[0]);
eval(code.match(/function checkDocsExist[\s\S]*?^}/m)[0]);
eval(code.match(/function identifyDebitType[\s\S]*?^}/m)[0]);
eval(code.match(/function findMatchingTemplate[\s\S]*?^}/m)[0]);

// טעינת input
const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('=== STEP-BY-STEP TEMPLATE MATCHING ===\n');

// 1. Check import
const hasImport = checkImportExists(input.import_files);
console.log('1. checkImportExists:', hasImport);
console.log('   IMPFILES length:', input.import_files.IMPFILES ? input.import_files.IMPFILES.length : 0);

// 2. Check docs in OCR
const hasDocsInOCR = checkDocsInOCR(input.AZURE_RESULT.data.fields, input.AZURE_TEXT || '');
console.log('\n2. checkDocsInOCR:', hasDocsInOCR);

// 3. Check docs in list
const hasDocsInList = checkDocsExist(input.docs_list);
console.log('   checkDocsExist (docs_list):', hasDocsInList);
console.log('   DOC_YES_NO:', input.docs_list.DOC_YES_NO);

const hasDocs = hasDocsInOCR || hasDocsInList;
console.log('   → Combined hasDocs:', hasDocs);

// 4. Debit type
const debitType = identifyDebitType(input.AZURE_RESULT.data.fields);
console.log('\n3. identifyDebitType:', debitType);

// 5. Find matching template
console.log('\n4. Looking for template with:');
console.log('   has_import =', hasImport);
console.log('   has_doc =', hasDocs);
console.log('   debit_type =', debitType);

const config = input.learned_config.config;
const templateIndex = findMatchingTemplate(config.structure, hasImport, hasDocs, debitType);

console.log('\n5. findMatchingTemplate result:', templateIndex);

if (templateIndex === -1) {
    console.log('\n❌ NO MATCHING TEMPLATE FOUND!');
    console.log('\nAvailable templates:');
    config.structure.forEach((s, idx) => {
        console.log(`\n   Template ${idx}:`);
        console.log('     has_import:', s.has_import);
        console.log('     has_doc:', s.has_doc);
        console.log('     debit_type:', s.debit_type);
    });
} else {
    console.log('\n✅ Found template at index:', templateIndex);
}

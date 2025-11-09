/**
 * Test v2.3 with DEBUG logs
 */

const fs = require('fs');
const path = require('path');

// Read the v2.3 code
const code = fs.readFileSync(path.join(__dirname, 'v2.0(30.10.25)'), 'utf8');

// Read test input
const testInput = JSON.parse(fs.readFileSync(path.join(__dirname, 'EXEMPTS/input.txt'), 'utf8'));

console.log('═'.repeat(80));
console.log('DEBUG TEST - Azure Invoice Processor v2.3');
console.log('═'.repeat(80));

// Extract the input from the test file structure
const inputData = testInput[0].input;

// Build the input object for the processor
const processorInput = {};
for (const item of inputData) {
    if (item.name === 'contentlong') {
        processorInput.contentLong = item.value;
    } else if (item.name === 'pages') {
        processorInput.pages = item.value;
    } else if (item.name === 'tables') {
        processorInput.tables = item.value;
    } else if (item.name === 'documents') {
        processorInput.documents = item.value;
    } else if (item.name === 'modelid') {
        processorInput.modelId = item.value;
    }
}

console.log('\n🔍 INPUT STRUCTURE:');
console.log('- contentLong:', processorInput.contentLong ? processorInput.contentLong.length + ' chars' : 'MISSING');
console.log('- pages:', processorInput.pages ? processorInput.pages.length + ' pages' : 'MISSING');
console.log('- tables:', processorInput.tables ? processorInput.tables.length + ' tables' : 'MISSING');
console.log('- documents:', processorInput.documents ? processorInput.documents.length + ' documents' : 'MISSING');
console.log('- modelId:', processorInput.modelId || 'MISSING');

console.log('\n' + '─'.repeat(80));
console.log('RUNNING PROCESSOR...');
console.log('─'.repeat(80) + '\n');

// Add DEBUG version of the code
const debugCode = code.replace(
    'const uniqueData = extractUniqueData(rawContent, result.fields);',
    `console.log('\\n🔍 DEBUG: Before extractUniqueData');
    console.log('- rawContent length:', rawContent ? rawContent.length : 0);
    console.log('- result.fields keys:', Object.keys(result.fields));
    const uniqueData = extractUniqueData(rawContent, result.fields);
    console.log('\\n🔍 DEBUG: After extractUniqueData');
    console.log('- uniqueData length:', uniqueData.length);
    if (uniqueData.length > 0) {
        console.log('- First 3 items:', uniqueData.slice(0, 3));
    }`
).replace(
    'if (uniqueData.length > 0) {',
    `console.log('\\n🔍 DEBUG: Checking if uniqueData.length > 0');
    console.log('- uniqueData.length:', uniqueData.length);
    if (uniqueData.length > 0) {
        console.log('✅ Adding UnidentifiedNumbers to result.fields');`
);

// Wrap the Make.com module code in a function
const wrappedCode = `
    (function(input) {
        ${debugCode}
    })
`;

try {
    const func = eval(wrappedCode);
    const result = func(processorInput);

    console.log('\n' + '═'.repeat(80));
    console.log('✅ PROCESSING COMPLETED');
    console.log('═'.repeat(80));

    console.log('\n📊 METADATA:');
    console.log('- modelId:', result.metadata.modelId || '(empty)');
    console.log('- totalFields:', result.metadata.totalFields);
    console.log('- uniqueDataFound:', result.metadata.uniqueDataFound);
    console.log('- pageCount:', result.metadata.pageCount);

    console.log('\n📋 RESULT FIELDS:');
    const fields = result.data.fields;
    for (const key in fields) {
        if (key === 'UnidentifiedNumbers') {
            console.log('✅ UnidentifiedNumbers:', fields[key] ? fields[key].length + ' items' : 'MISSING');
        } else if (key === 'Items') {
            console.log('  ', key + ':', fields[key] ? fields[key].length + ' items' : 'MISSING');
        } else if (key.indexOf('Tel') >= 0 || key.indexOf('Fax') >= 0 || key.indexOf('Email') >= 0 || key.indexOf('Time') >= 0) {
            console.log('✅', key + ':', fields[key]);
        }
    }

    if (fields.UnidentifiedNumbers) {
        console.log('\n📋 UnidentifiedNumbers (first 10):');
        for (let i = 0; i < Math.min(10, fields.UnidentifiedNumbers.length); i++) {
            const item = fields.UnidentifiedNumbers[i];
            console.log(`  ${i + 1}. ${item.label}: ${item.value}`);
        }
    } else {
        console.log('\n❌ UnidentifiedNumbers NOT FOUND IN RESULT!');
    }

    console.log('\n' + '═'.repeat(80));

} catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error.message);
    console.error(error.stack);
}

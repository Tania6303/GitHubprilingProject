const fs = require('fs');
const input = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = input[0].input;

const azureItem = inputArray.find(item => item.name === 'AZURE_RESULT');
const azure = azureItem.value;

const azureTextItem = inputArray.find(item => item.name === 'AZURE_TEXT');
const azureText = azureTextItem ? azureTextItem.value : '';

const fields = azure.data.fields;

console.log('=== CHECKING FOR DOCS IN OCR ===');
console.log('\n1. UnidentifiedNumbers:');
if (fields.UnidentifiedNumbers) {
    console.log('   Count:', fields.UnidentifiedNumbers.length);
    fields.UnidentifiedNumbers.forEach((item, idx) => {
        const val = typeof item === 'object' ? item.value : item;
        if (/^(25|108)\d{6}$/.test(val)) {
            console.log(`   [${idx}] DOC NUMBER FOUND: ${val}`);
        }
    });
}

console.log('\n2. AZURE_TEXT search for 25XXXXXX or 108XXXXXX:');
const docMatches = azureText.match(/\b(25|108)\d{6}\b/g);
if (docMatches) {
    console.log('   Found:', docMatches);
} else {
    console.log('   Not found in text');
}

console.log('\n3. What checkDocsInOCR would return:');
// Simulate checkDocsInOCR logic
const unidentified = fields.UnidentifiedNumbers || [];
const docPattern = /^25\d{6}$/;
const booknumPattern = /^108\d{6}$/;
let hasDocsInOCR = false;

if (unidentified.length > 0) {
    if (typeof unidentified[0] === 'object') {
        hasDocsInOCR = unidentified.some(item => docPattern.test(item.value) || booknumPattern.test(item.value));
    } else {
        hasDocsInOCR = unidentified.some(num => docPattern.test(num) || booknumPattern.test(num));
    }
}

if (!hasDocsInOCR && azureText) {
    hasDocsInOCR = !!(azureText.match(/25\d{6}/g) || azureText.match(/108\d{6}/g));
}

console.log('   checkDocsInOCR returns:', hasDocsInOCR);

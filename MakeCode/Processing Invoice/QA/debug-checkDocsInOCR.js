const fs = require('fs');
const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

const ocrFields = input.AZURE_RESULT.data.fields;
const azureText = input.AZURE_TEXT || '';

console.log('=== DEBUGGING checkDocsInOCR ===\n');

const unidentified = ocrFields.UnidentifiedNumbers || [];
const docPattern = /^25\d{6}$/;
const booknumPattern = /^108\d{6}$/;

console.log('1. unidentified.length:', unidentified.length);
console.log('2. typeof unidentified[0]:', typeof unidentified[0]);

let foundInUnidentified = false;

if (unidentified.length > 0) {
    if (typeof unidentified[0] === 'object' && unidentified[0].value) {
        console.log('\n3. Checking objects with .value property:');
        unidentified.forEach((item, idx) => {
            const matches = docPattern.test(item.value) || booknumPattern.test(item.value);
            if (matches || idx < 5) {  // Show first 5 or matches
                console.log(`   [${idx}] "${item.value}" - Matches: ${matches}`);
            }
        });

        foundInUnidentified = unidentified.some(item =>
            docPattern.test(item.value) || booknumPattern.test(item.value)
        );
    } else {
        console.log('\n3. Checking plain strings:');
        unidentified.forEach((num, idx) => {
            const matches = docPattern.test(num) || booknumPattern.test(num);
            if (matches || idx < 5) {
                console.log(`   [${idx}] "${num}" - Matches: ${matches}`);
            }
        });

        foundInUnidentified = unidentified.some(num =>
            docPattern.test(num) || booknumPattern.test(num)
        );
    }
}

console.log('\n4. foundInUnidentified:', foundInUnidentified);

if (!foundInUnidentified && azureText) {
    console.log('\n5. Checking azureText:');
    console.log('   azureText length:', azureText.length);

    const docMatches = azureText.match(/25\d{6}/g);
    const booknumMatches = azureText.match(/108\d{6}/g);

    console.log('   docMatches (25XXXXXX):', docMatches);
    console.log('   booknumMatches (108XXXXXX):', booknumMatches);

    if ((docMatches && docMatches.length > 0) || (booknumMatches && booknumMatches.length > 0)) {
        console.log('\n   → Found in azureText!');
        foundInUnidentified = true;
    }
}

console.log('\n=== FINAL RESULT ===');
console.log('checkDocsInOCR returns:', foundInUnidentified);

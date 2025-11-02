const fs = require('fs');
const input = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = input[0].input;

const azureItem = inputArray.find(item => item.name === 'AZURE_RESULT');
const azure = azureItem.value;
const fields = azure.data.fields;

console.log('=== UnidentifiedNumbers CONTENT ===\n');
if (fields.UnidentifiedNumbers) {
    fields.UnidentifiedNumbers.forEach((item, idx) => {
        const val = typeof item === 'object' ? item.value : item;
        const label = typeof item === 'object' ? item.label : '';
        const context = typeof item === 'object' ? item.context : '';

        console.log(`[${idx}] Value: "${val}"`);
        if (label) console.log(`     Label: "${label}"`);
        if (context) console.log(`     Context: "${context}"`);

        // בדיקות
        const isDocno = /^25\d{6}$/.test(val);
        const isBooknum = /^108\d{6}$/.test(val);

        if (isDocno || isBooknum) {
            console.log(`     >>> MATCHES DOC PATTERN! <<<`);
        }
        console.log('');
    });
}

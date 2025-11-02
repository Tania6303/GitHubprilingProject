const fs = require('fs');
const input = JSON.parse(fs.readFileSync('QA/279992_input.txt', 'utf8'));
const inputArray = input[0].input;

// מצא AZURE_RESULT
const azureResultItem = inputArray.find(item => item.name === 'AZURE_RESULT');
const azureResult = azureResultItem.value;

console.log('Keys in AZURE_RESULT:', Object.keys(azureResult));
console.log('Has data:', !!azureResult.data);
console.log('Has analyzeResult:', !!azureResult.analyzeResult);

if (azureResult.data) {
    console.log('\nKeys in data:', Object.keys(azureResult.data));
    console.log('Keys in data.fields:', Object.keys(azureResult.data.fields || {}));
}

if (azureResult.analyzeResult) {
    console.log('\nKeys in analyzeResult:', Object.keys(azureResult.analyzeResult));
    if (azureResult.analyzeResult.documents) {
        console.log('Documents count:', azureResult.analyzeResult.documents.length);
        if (azureResult.analyzeResult.documents[0]) {
            console.log('Keys in documents[0]:', Object.keys(azureResult.analyzeResult.documents[0]));
            if (azureResult.analyzeResult.documents[0].fields) {
                const fields = azureResult.analyzeResult.documents[0].fields;
                console.log('\nSample fields in documents[0].fields:', Object.keys(fields).slice(0, 10));
            }
        }
    }
}

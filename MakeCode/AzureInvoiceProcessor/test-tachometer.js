const fs = require('fs');
const path = require('path');

// Read the v2.4 code
const code = fs.readFileSync(path.join(__dirname, 'v2.0(30.10.25)'), 'utf8');

// Read test input
const testInput = JSON.parse(fs.readFileSync(path.join(__dirname, 'EXEMPTS/input-tachometer.json'), 'utf8'));

console.log('Running v2.4 on Tachometer invoice...');

const startTime = Date.now();

// Wrap the Make.com module code in a function
const wrappedCode = `
    (function(input) {
        ${code}
    })
`;

const func = eval(wrappedCode);
const result = func(testInput);

const executionTime = Date.now() - startTime;

// Write output
const output = [{
    logs: { stdout: [], stderr: [] },
    executionTimeMs: executionTime,
    result: result
}];

fs.writeFileSync(
    path.join(__dirname, 'EXEMPTS/output-tachometer.txt'),
    JSON.stringify(output, null, 4),
    'utf8'
);

console.log('✅ Output saved to EXEMPTS/output-tachometer.txt');
console.log(`Execution time: ${executionTime}ms`);
console.log(`UnidentifiedNumbers found: ${result.data?.fields?.UnidentifiedNumbers?.length || 0}`);

// Show what was found
if (result.data && result.data.fields && result.data.fields.UnidentifiedNumbers) {
    console.log('\n📋 UnidentifiedNumbers:');
    result.data.fields.UnidentifiedNumbers.forEach(item => {
        console.log('  ' + item.label + ': ' + item.value);
    });
}

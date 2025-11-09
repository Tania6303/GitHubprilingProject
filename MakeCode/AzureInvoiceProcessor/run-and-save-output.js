/**
 * Run v2.3 and save to output.txt
 */

const fs = require('fs');
const path = require('path');

// Read the v2.3 code
const code = fs.readFileSync(path.join(__dirname, 'v2.0(30.10.25)'), 'utf8');

// Read test input
const testInput = JSON.parse(fs.readFileSync(path.join(__dirname, 'EXEMPTS/input.txt'), 'utf8'));

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

console.log('Running v2.3...');

const startTime = Date.now();

// Wrap the Make.com module code in a function
const wrappedCode = `
    (function(input) {
        ${code}
    })
`;

const func = eval(wrappedCode);
const result = func(processorInput);

const executionTime = Date.now() - startTime;

// Write output in the same format as before
const output = [{
    logs: { stdout: [], stderr: [] },
    executionTimeMs: executionTime,
    result: result
}];

fs.writeFileSync(
    path.join(__dirname, 'EXEMPTS/output.txt'),
    JSON.stringify(output, null, 4),
    'utf8'
);

console.log('✅ Output saved to EXEMPTS/output.txt');
console.log(`Execution time: ${executionTime}ms`);
console.log(`UnidentifiedNumbers found: ${result.data?.fields?.UnidentifiedNumbers?.length || 0}`);

const fs = require('fs');
const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('=== CHECKING IMPORT_FILES ===\n');
const importFiles = input.import_files;

console.log('importFiles:', importFiles);
console.log('\nIMPFILES exists:', !!importFiles.IMPFILES);
console.log('IMPFILES is array:', Array.isArray(importFiles.IMPFILES));
console.log('IMPFILES length:', importFiles.IMPFILES ? importFiles.IMPFILES.length : 0);

if (importFiles.IMPFILES && importFiles.IMPFILES.length > 0) {
    console.log('\nFirst IMPFILES item:');
    const first = importFiles.IMPFILES[0];
    console.log('  Type:', typeof first);
    console.log('  Value:', first);
    console.log('  Length:', first ? first.length : 0);

    // נסה לפרסר
    if (first) {
        try {
            const parsed = JSON.parse('[' + first + ']');
            console.log('\n  Parsed successfully:');
            console.log('  ', parsed);
            console.log('  parsed[0].IMPFNUM:', parsed[0].IMPFNUM);
        } catch (e) {
            console.log('\n  Parse failed:', e.message);
        }
    }
}

// סימולציה של checkImportExists
console.log('\n=== SIMULATING checkImportExists ===');
function checkImportExists(importFiles) {
    if (!importFiles || !importFiles.IMPFILES) return false;
    if (importFiles.IMPFILES.length === 0) return false;

    try {
        const parsed = JSON.parse('[' + importFiles.IMPFILES[0] + ']');
        return parsed.length > 0 && !!parsed[0].IMPFNUM;
    } catch (e) {
        return false;
    }
}

const result = checkImportExists(importFiles);
console.log('checkImportExists returns:', result);

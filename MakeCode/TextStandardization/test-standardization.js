const standardize = require('./standardize-text.js');

const testLines = [
    "פטור מניכוי מס במקור מס': 935781872",
    "חשבונית עמילות מס (חיוב): 1917035 (202857)",
    "אסמכתא לקוח: 1234136",
    "תיק מס: 25014042594103"
];

console.log('=== Testing TextStandardization ===\n');

testLines.forEach((line, i) => {
    console.log(`Test ${i+1}:`);
    console.log('BEFORE:', JSON.stringify(line));
    const cleaned = standardize.standardizeText(line);
    console.log('AFTER: ', JSON.stringify(cleaned));
    console.log('CHANGED:', line !== cleaned ? 'YES' : 'NO');
    console.log('');
});

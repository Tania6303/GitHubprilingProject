// Test for v2.23 - Expanded Structure with originalHeader
// בדיקת המבנה המורחב עם originalHeader

const fs = require('fs');
const path = require('path');

// טען את הקוד החדש
const processorCode = fs.readFileSync(path.join(__dirname, 'v2.0(30.10.25)'), 'utf-8');

// יצירת input מזויף עבור הבדיקה
const mockInput = {
    contentLong: 'Test content',
    pages: [],
    tables: [{
        cells: [
            // Headers
            { kind: 'columnHeader', columnIndex: 0, content: 'שורה', rowIndex: 0 },
            { kind: 'columnHeader', columnIndex: 1, content: 'הזמנתכם', rowIndex: 0 },
            { kind: 'columnHeader', columnIndex: 2, content: 'מק"ט', rowIndex: 0 },
            { kind: 'columnHeader', columnIndex: 3, content: 'תאור מוצר', rowIndex: 0 },
            { kind: 'columnHeader', columnIndex: 4, content: 'כמות', rowIndex: 0 },
            { kind: 'columnHeader', columnIndex: 5, content: 'מחיר ליחידה', rowIndex: 0 },
            { kind: 'columnHeader', columnIndex: 6, content: 'סה"כ מחיר', rowIndex: 0 },

            // Data row
            { columnIndex: 0, content: '1', rowIndex: 1 },
            { columnIndex: 1, content: '6175', rowIndex: 1 },
            { columnIndex: 2, content: 'C61050-50', rowIndex: 1 },
            { columnIndex: 3, content: 'צינור קוברה 50 גמיש -תקני (50 מ\')', rowIndex: 1 },
            { columnIndex: 4, content: '600.00 מטר', rowIndex: 1 },
            { columnIndex: 5, content: '2.30 ש"ח', rowIndex: 1 },
            { columnIndex: 6, content: '1,380.00', rowIndex: 1 }
        ]
    }],
    documents: [],
    modelId: 'test-model'
};

console.log('🧪 Testing v2.23 Expanded Structure\n');
console.log('═══════════════════════════════════════\n');

// הרץ את הקוד - עטוף בפונקציה כי הוא מכיל return
const result = (function() {
    const input = mockInput;
    return eval(processorCode);
})();

console.log('📊 Test Results:\n');

// בדיקה 1: האם יש Items?
if (result.structure && result.structure.Items) {
    console.log('✅ Items structure exists');

    const itemsStructure = result.structure.Items[0];

    // בדיקה 2: האם המבנה מורחב?
    if (itemsStructure && typeof itemsStructure === 'object') {
        console.log('✅ Items structure is an object');

        // בדיקה 3: האם יש originalHeader?
        const firstField = Object.keys(itemsStructure)[0];
        const firstFieldValue = itemsStructure[firstField];

        if (firstFieldValue && typeof firstFieldValue === 'object' && firstFieldValue.originalHeader !== undefined) {
            console.log('✅ originalHeader exists in structure');
            console.log('\n📋 Structure Sample:\n');

            // הצג את המבנה
            for (const fieldName in itemsStructure) {
                const field = itemsStructure[fieldName];
                console.log(`  ${fieldName}:`);
                console.log(`    type: ${field.type}`);
                console.log(`    originalHeader: ${field.originalHeader}`);
                console.log('');
            }

            // בדיקה 4: האם התרגום עבד?
            if (itemsStructure.LineNumber) {
                console.log('✅ LineNumber field exists (translated from "שורה")');
                if (itemsStructure.LineNumber.originalHeader === 'שורה') {
                    console.log('✅ originalHeader preserved correctly: "שורה"');
                }
            }

            if (itemsStructure.CustomerOrder) {
                console.log('✅ CustomerOrder field exists (translated from "הזמנתכם")');
                if (itemsStructure.CustomerOrder.originalHeader === 'הזמנתכם') {
                    console.log('✅ originalHeader preserved correctly: "הזמנתכם"');
                }
            }

            if (itemsStructure.ProductCode) {
                console.log('✅ ProductCode field exists (translated from "מק\\"ט")');
            }

            if (itemsStructure.TotalPrice) {
                console.log('✅ TotalPrice field exists (translated from "סה\\"כ מחיר")');
            }

        } else {
            console.log('❌ originalHeader NOT found in structure');
            console.log('   Expected: { type: "...", originalHeader: "..." }');
            console.log('   Got:', JSON.stringify(firstFieldValue, null, 2));
        }
    } else {
        console.log('❌ Items structure is NOT an object');
        console.log('   Got:', typeof itemsStructure);
    }
} else {
    console.log('❌ Items structure NOT found');
}

// בדיקה 5: האם Data נשמר נכון?
if (result.data && result.data.fields && result.data.fields.Items) {
    console.log('\n✅ Items data exists');

    const firstItem = result.data.fields.Items[0];
    if (firstItem) {
        console.log('\n📋 Data Sample:\n');
        console.log('  First Item:');
        for (const key in firstItem) {
            console.log(`    ${key}: ${firstItem[key]}`);
        }
    }
}

console.log('\n═══════════════════════════════════════');
console.log('🎯 Test Complete!');
console.log('═══════════════════════════════════════\n');

// שמור את התוצאה לקובץ
const outputPath = path.join(__dirname, 'EXEMPTS', 'output-v2.23-test.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
console.log('💾 Full result saved to:', outputPath);

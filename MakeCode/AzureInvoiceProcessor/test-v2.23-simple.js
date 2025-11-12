// Simple test for v2.23 - Test individual functions
// בדיקה פשוטה לפונקציות החדשות

console.log('🧪 Testing v2.23 - Individual Functions\n');
console.log('═══════════════════════════════════════\n');

// =========================================================
// העתקה של הפונקציות החדשות מהקוד
// =========================================================

function getHeaderTranslationMap() {
    return [
        {
            field: 'LineNumber',
            hebrewHeaders: ['שורה', 'מס שורה', "מס' שורה", 'מספר שורה', 'ש', '#'],
            englishHeaders: ['line', 'line number', 'line no', 'row', 'row number', '#']
        },
        {
            field: 'CustomerOrder',
            hebrewHeaders: ['הזמנתכם', 'הזמנת לקוח', "מס' הזמנה", 'מספר הזמנה', 'הזמנה'],
            englishHeaders: ['customer order', 'your order', 'order number', 'order no', 'po number', 'po']
        },
        {
            field: 'ProductCode',
            hebrewHeaders: ['מק"ט', 'מקט', 'קוד פריט', 'קוד מוצר', 'מק״ט'],
            englishHeaders: ['sku', 'item code', 'product code', 'code', 'item', 'part number', 'part no']
        },
        {
            field: 'Description',
            hebrewHeaders: ['תאור', 'תאור מוצר', 'תיאור', 'תיאור מוצר', 'שם מוצר', 'פריט'],
            englishHeaders: ['description', 'item description', 'product description', 'name', 'product name', 'item name']
        },
        {
            field: 'Quantity',
            hebrewHeaders: ['כמות', 'כמ', 'כמות מוזמנת'],
            englishHeaders: ['quantity', 'qty', 'amount', 'ordered qty']
        },
        {
            field: 'TotalPrice',
            hebrewHeaders: ['סה"כ', 'סה״כ', 'סה"כ מחיר', 'סכום', 'סך הכל', 'סכום כולל'],
            englishHeaders: ['total', 'total price', 'amount', 'sum', 'total amount', 'line total']
        }
    ];
}

function guessFieldNameGeneric(content, colIndex) {
    if (!content || content.trim() === '') {
        return {
            fieldName: 'UnknownColumn_' + colIndex,
            originalHeader: '',
            isUnknown: true
        };
    }

    const originalHeader = content.trim();
    const text = content.toLowerCase().trim();

    // נסה למצוא התאמה במילון התרגום
    const translationMap = getHeaderTranslationMap();

    for (let i = 0; i < translationMap.length; i++) {
        const mapping = translationMap[i];

        // בדיקה מול כותרות עבריות
        for (let j = 0; j < mapping.hebrewHeaders.length; j++) {
            const hebrewHeader = mapping.hebrewHeaders[j].toLowerCase();
            if (text === hebrewHeader || text.indexOf(hebrewHeader) >= 0) {
                return {
                    fieldName: mapping.field,
                    originalHeader: originalHeader,
                    isUnknown: false
                };
            }
        }

        // בדיקה מול כותרות אנגליות
        for (let k = 0; k < mapping.englishHeaders.length; k++) {
            const englishHeader = mapping.englishHeaders[k].toLowerCase();
            if (text === englishHeader || text.indexOf(englishHeader) >= 0) {
                return {
                    fieldName: mapping.field,
                    originalHeader: originalHeader,
                    isUnknown: false
                };
            }
        }
    }

    // אם לא נמצאה התאמה - החזר עמודה לא מזוהה
    return {
        fieldName: 'UnknownColumn_' + colIndex,
        originalHeader: originalHeader,
        isUnknown: true
    };
}

// =========================================================
// בדיקות
// =========================================================

console.log('📝 Test 1: Hebrew Header Translation\n');

const test1 = guessFieldNameGeneric('שורה', 0);
console.log('Input: "שורה"');
console.log('Result:', JSON.stringify(test1, null, 2));
console.log(test1.fieldName === 'LineNumber' ? '✅ PASS' : '❌ FAIL');
console.log(test1.originalHeader === 'שורה' ? '✅ originalHeader preserved' : '❌ originalHeader NOT preserved');
console.log('');

console.log('📝 Test 2: Hebrew Header - הזמנתכם\n');

const test2 = guessFieldNameGeneric('הזמנתכם', 1);
console.log('Input: "הזמנתכם"');
console.log('Result:', JSON.stringify(test2, null, 2));
console.log(test2.fieldName === 'CustomerOrder' ? '✅ PASS' : '❌ FAIL');
console.log(test2.originalHeader === 'הזמנתכם' ? '✅ originalHeader preserved' : '❌ originalHeader NOT preserved');
console.log('');

console.log('📝 Test 3: Hebrew Header - מק"ט\n');

const test3 = guessFieldNameGeneric('מק"ט', 2);
console.log('Input: "מק\\"ט"');
console.log('Result:', JSON.stringify(test3, null, 2));
console.log(test3.fieldName === 'ProductCode' ? '✅ PASS' : '❌ FAIL');
console.log(test3.originalHeader === 'מק"ט' ? '✅ originalHeader preserved' : '❌ originalHeader NOT preserved');
console.log('');

console.log('📝 Test 4: Hebrew Header - תאור מוצר\n');

const test4 = guessFieldNameGeneric('תאור מוצר', 3);
console.log('Input: "תאור מוצר"');
console.log('Result:', JSON.stringify(test4, null, 2));
console.log(test4.fieldName === 'Description' ? '✅ PASS' : '❌ FAIL');
console.log(test4.originalHeader === 'תאור מוצר' ? '✅ originalHeader preserved' : '❌ originalHeader NOT preserved');
console.log('');

console.log('📝 Test 5: Unknown Header\n');

const test5 = guessFieldNameGeneric('עמודה לא מוכרת', 10);
console.log('Input: "עמודה לא מוכרת"');
console.log('Result:', JSON.stringify(test5, null, 2));
console.log(test5.fieldName === 'UnknownColumn_10' ? '✅ PASS' : '❌ FAIL');
console.log(test5.isUnknown === true ? '✅ isUnknown=true' : '❌ isUnknown NOT true');
console.log(test5.originalHeader === 'עמודה לא מוכרת' ? '✅ originalHeader preserved' : '❌ originalHeader NOT preserved');
console.log('');

console.log('═══════════════════════════════════════');
console.log('🎯 Tests Complete!');
console.log('═══════════════════════════════════════\n');

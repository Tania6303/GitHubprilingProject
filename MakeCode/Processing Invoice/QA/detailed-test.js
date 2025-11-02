const fs = require('fs');
const { processInvoiceComplete } = require('../v4.2-COMPLETE.js');

console.log('='.repeat(80));
console.log('בדיקת לוגיקה של 3 תבניות לספק 279992');
console.log('='.repeat(80));

// טעינת הקובץ
const rawData = JSON.parse(fs.readFileSync('279992_INPUT.TXT', 'utf8'));
const inputArray = rawData[0].input;

const input = {};
inputArray.forEach(item => {
    input[item.name] = item.value;
});

console.log('\n📋 פרטי ספק:');
console.log('קוד ספק:', input.learned_config.config.supplier_config.supplier_code);
console.log('שם ספק:', input.learned_config.config.supplier_config.supplier_name);
console.log('מספר תבניות:', input.learned_config.config.structure.length);

console.log('\n📝 התבניות הקיימות:');
input.learned_config.config.structure.forEach((s, i) => {
    console.log(`\nתבנית ${i}:`);
    console.log(`  has_import: ${s.has_import}`);
    console.log(`  has_doc: ${s.has_doc}`);
    console.log(`  debit_type: ${s.debit_type}`);
    console.log(`  תיאור: ${s.has_import && s.has_doc ? 'יבוא + תעודות' :
                         s.has_import ? 'יבוא' :
                         s.has_doc ? 'תעודות' :
                         s.debit_type === 'C' ? 'זיכוי' : 'חשבונית רגילה'}`);
});

console.log('\n' + '='.repeat(80));
console.log('הרצת הקוד...');
console.log('='.repeat(80));

const result = processInvoiceComplete(input);

console.log('\n📊 תוצאות:');
console.log('Status:', result.status);

if (result.status === 'success') {
    console.log('\n✅ הצלחה!\n');

    const inv = result.invoice_data.PINVOICES[0];

    console.log('🔍 מידע מהחשבונית:');
    console.log('  SUPNAME:', inv.SUPNAME);
    console.log('  BOOKNUM:', inv.BOOKNUM);
    console.log('  IVDATE:', inv.IVDATE);

    console.log('\n🎯 זיהוי סוג החשבונית:');
    console.log('  יש יבוא (IMPFNUM)?', !!inv.IMPFNUM ? 'כן' : 'לא');
    console.log('  יש תעודות (DOCNO)?', !!inv.DOCNO ? 'כן' : 'לא');
    console.log('  סוג (DEBITTYPE):', inv.DEBITTYPE || 'לא מוגדר');

    console.log('\n📦 מבנה החשבונית:');
    console.log('  יש PINVOICEITEMS_SUBFORM?', !!inv.PINVOICEITEMS_SUBFORM ? 'כן' : 'לא');
    if (inv.PINVOICEITEMS_SUBFORM) {
        console.log('  כמות פריטים:', inv.PINVOICEITEMS_SUBFORM.length);
        if (inv.PINVOICEITEMS_SUBFORM.length > 0) {
            console.log('\n  פריט ראשון:');
            const item = inv.PINVOICEITEMS_SUBFORM[0];
            console.log('    PARTNAME:', item.PARTNAME);
            console.log('    TQUANT:', item.TQUANT);
            console.log('    IPRICE:', item.IPRICE);
            console.log('    QPRICE:', item.QPRICE);
        }
    }

    console.log('\n🎯 תבנית שנבחרה:');
    console.log('  לפי הזיהוי:');
    console.log('    has_import =', !!inv.IMPFNUM);
    console.log('    has_doc =', !!inv.DOCNO);
    console.log('    debit_type =', inv.DEBITTYPE || 'D');

    // נבדוק איזו תבנית זה
    const hasImport = !!inv.IMPFNUM;
    const hasDoc = !!inv.DOCNO;
    const debit = inv.DEBITTYPE || 'D';

    const templateIndex = input.learned_config.config.structure.findIndex(s =>
        s.has_import === hasImport &&
        s.has_doc === hasDoc &&
        s.debit_type === debit
    );

    console.log(`  תבנית שנבחרה: תבנית ${templateIndex}`);

    console.log('\n✅ תוצאה נכונה:');
    if (templateIndex === 0) {
        console.log('  ✓ נבחרה תבנית 0 (חשבונית רגילה)');
        console.log('  ✓ אין יבוא, אין תעודות, חיוב רגיל');
        console.log('  ✓ יש PINVOICEITEMS_SUBFORM עם פריטים');
    } else if (templateIndex === 1) {
        console.log('  ✓ נבחרה תבנית 1 (יבוא + תעודות)');
    } else if (templateIndex === 2) {
        console.log('  ✓ נבחרה תבנית 2 (זיכוי)');
    }

} else {
    console.log('\n❌ שגיאה:', result.message);
    console.log('Error type:', result.error_type);
}

console.log('\n' + '='.repeat(80));

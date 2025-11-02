// בדיקה מהירה ש-Production Invoice תומך במספר תבניות

const { processProductionInvoice } = require('./v1.0-production.js');

// דוגמה מינימלית לבדיקה
const testInput = {
    SUPNAME: "279992",
    AZURE: JSON.stringify({
        data: {
            fields: {
                InvoiceId: "SI250000620",
                InvoiceDate: "2025-09-09",
                InvoiceTotal_amount: 23600,
                TotalTax_amount: 3600,
                SubTotal_amount: 20000
            }
        }
    }),
    CARS: [],
    SUP_TEMP: JSON.stringify({
        SUPNAME: "279992",
        SDES: "מודגל מתכת (99) בע\"מ",
        VATNUM: "558158374",
        TEMPLETE: JSON.stringify({
            technical_config: {
                supplier_config: {
                    supplier_code: "279992",
                    supplier_name: "מודגל מתכת (99) בע\"מ"
                },
                structure: [
                    {
                        has_import: false,
                        has_doc: false,
                        debit_type: "D"
                    },
                    {
                        has_import: true,
                        has_doc: true,
                        debit_type: "D"
                    },
                    {
                        has_import: false,
                        has_doc: false,
                        debit_type: "C"
                    }
                ],
                rules: {}
            },
            invoice_data: {
                PINVOICES: [
                    { SUPNAME: "279992", CODE: "ש\"ח", DEBIT: "D" },
                    { SUPNAME: "279992", CODE: "ש\"ח", DEBIT: "D" },
                    { SUPNAME: "279992", CODE: "ש\"ח", DEBIT: "C" }
                ]
            }
        })
    })
};

console.log('=== בדיקת תמיכה במספר תבניות ב-Production Invoice ===\n');

try {
    const result = processProductionInvoice(testInput);

    console.log('📊 Status:', result.status);

    if (result.status === 'success') {
        console.log('\n=== תוצאות ===');
        console.log('✓ invoice_data.PINVOICES.length:', result.invoice_data.PINVOICES.length);
        console.log('✓ metadata.templates_count:', result.metadata.templates_count);

        console.log('\n=== פירוט החשבוניות ===');
        result.invoice_data.PINVOICES.forEach((invoice, i) => {
            console.log(`  [${i}] DEBIT: ${invoice.DEBIT}, שדות: ${Object.keys(invoice).length}`);
        });

        console.log('\n=== בדיקות ===');
        const hasThreeInvoices = result.invoice_data.PINVOICES.length === 3;
        const hasValidations = result.all_validations && result.all_validations.length === 3;
        const hasLearningAnalyses = result.all_learning_analyses && result.all_learning_analyses.length === 3;

        console.log('✓ יש 3 חשבוניות:', hasThreeInvoices ? '✅' : '❌');
        console.log('✓ יש 3 validations:', hasValidations ? '✅' : '❌');
        console.log('✓ יש 3 learning analyses:', hasLearningAnalyses ? '✅' : '❌');

        if (hasThreeInvoices && hasValidations && hasLearningAnalyses) {
            console.log('\n🎉 מושלם! Production Invoice תומך במספר תבניות!');
        } else {
            console.log('\n❌ יש בעיה');
        }
    } else {
        console.log('❌ Error:', result.message);
    }
} catch (error) {
    console.error('❌ Exception:', error.message);
    console.error(error.stack);
}

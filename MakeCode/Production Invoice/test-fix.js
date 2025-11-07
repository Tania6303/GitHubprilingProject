// Test script to verify the fix
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing v1.0-production.js fix...\n');

// Read the input file
const inputFile = path.join(__dirname, 'EXEMPTS', 'input-11:11-2025-11-06-0.2223916893283866.js');
const inputContent = fs.readFileSync(inputFile, 'utf8');

// Parse the input (it's a string containing JSON)
const inputData = JSON.parse(inputContent.slice(1, -1)); // Remove leading ' and trailing '

console.log('📥 Input loaded:');
console.log('  - learned_config:', !!inputData.learned_config);
console.log('  - technical_config:', !!inputData.learned_config?.technical_config);
console.log('  - all_templates:', inputData.learned_config?.technical_config?.all_templates?.length || 0);
console.log('  - check_docs:', inputData.learned_config?.technical_config?.all_templates?.[0]?.check_docs);
console.log('  - check_import:', inputData.learned_config?.technical_config?.all_templates?.[0]?.check_import);
console.log('');

// Load and execute the production code
const productionCode = fs.readFileSync(path.join(__dirname, 'v1.0-production.js'), 'utf8');

// Create a safe execution environment
const input = inputData;
let result;

try {
    // Execute the IIFE code
    result = eval(productionCode);

    console.log('\n✅ Execution completed!');
    console.log('');
    console.log('📊 Result:');
    console.log('  - status:', result.status);

    if (result.status === 'error') {
        console.log('  - error:', result.message);
        console.log('  - stage:', result.execution_report?.stage);
        console.log('  - errors:', result.execution_report?.errors);
    } else if (result.status === 'success') {
        console.log('  - BOOKNUM:', result.invoice_data?.PINVOICES?.[0]?.BOOKNUM);
        console.log('  - IVDATE:', result.invoice_data?.PINVOICES?.[0]?.IVDATE);
        console.log('  - items:', result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM?.length || 0);
        console.log('  - template_index:', result.metadata?.template_index);
        console.log('  - template_type:', result.metadata?.template_type);
    }

    console.log('');
    console.log('📋 Execution Report:');
    console.log('  - stage:', result.execution_report?.stage);
    console.log('  - found:', result.execution_report?.found?.length || 0, 'items');
    if (result.execution_report?.found) {
        result.execution_report.found.forEach(f => console.log('    ✓', f));
    }
    console.log('  - errors:', result.execution_report?.errors?.length || 0);
    if (result.execution_report?.errors) {
        result.execution_report.errors.forEach(e => console.log('    ✗', e));
    }

    // Check if the fix worked
    console.log('');
    console.log('🔍 Fix Verification:');
    const hasError = result.status === 'error';
    const errorIsTemplateNotFound = result.message?.includes('תבנית');

    if (hasError && errorIsTemplateNotFound) {
        console.log('  ❌ FIX DID NOT WORK - Still getting template not found error');
        process.exit(1);
    } else if (result.status === 'success') {
        console.log('  ✅ FIX WORKED - Template found successfully!');
        console.log('  ✅ Template type:', result.metadata?.template_type);
        process.exit(0);
    } else {
        console.log('  ⚠️  Different error occurred:', result.message);
        process.exit(1);
    }

} catch (error) {
    console.error('❌ Execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}

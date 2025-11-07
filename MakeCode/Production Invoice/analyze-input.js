const fs = require('fs');

const data = JSON.parse(fs.readFileSync('EXEMPTS/input-11:11-2025-11-06-0.2223916893283866.js', 'utf8').slice(1, -1));

console.log('📊 Input structure:');
console.log('Keys:', Object.keys(data));
console.log('');

if (data.AZURE_RESULT) {
    const ocr = data.AZURE_RESULT.data?.fields || {};
    const unidentified = ocr.UnidentifiedNumbers || [];

    console.log('📋 UnidentifiedNumbers found:', unidentified.length);

    // חפש מספרי רכב בפורמט XXX-XX-XXX
    const vehiclePattern = /\d{3}-\d{2}-\d{3}/;
    const vehicles = unidentified.filter(item => {
        const value = typeof item === 'object' ? item.value : item;
        return vehiclePattern.test(value);
    });

    console.log('🚗 Vehicle numbers found:', vehicles.length);
    if (vehicles.length > 0) {
        console.log('Vehicles:', JSON.stringify(vehicles, null, 2));
    }

    console.log('');
    console.log('First 5 UnidentifiedNumbers:');
    console.log(JSON.stringify(unidentified.slice(0, 5), null, 2));
}

// בדוק את learned_config
if (data.learned_config) {
    const config = data.learned_config;
    console.log('');
    console.log('📝 learned_config structure:');
    console.log('Keys:', Object.keys(config));

    if (config.processing_scenario) {
        console.log('');
        console.log('processing_scenario.all_templates:');
        console.log(JSON.stringify(config.processing_scenario.all_templates, null, 2));
    }

    if (config.technical_config) {
        console.log('');
        console.log('technical_config keys:', Object.keys(config.technical_config));

        if (config.technical_config.all_templates) {
            const template = config.technical_config.all_templates[0];
            console.log('');
            console.log('First template keys:', Object.keys(template));

            if (template.extraction_rules?.vehicles) {
                console.log('');
                console.log('🚗 Vehicle extraction rules:');
                console.log(JSON.stringify(template.extraction_rules.vehicles, null, 2));
            }
        }
    }
}

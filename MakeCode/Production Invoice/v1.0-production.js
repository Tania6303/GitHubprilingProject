// ============================================================================
// קוד 3 - ייצור חשבוניות (גרסה 1.8.1 - 13.12.25)
// עדכון אחרון: 13.12.25 19:30
//
// מקבל: learned_config, docs_list, import_files, vehicles, AZURE_RESULT, AZURE_TEXT_CLEAN
//        + template_index (אופציונלי)
// מחזיר: JSON לפריוריטי (PINVOICES + תעודות/פריטים/רכבים) + דוח ביצוע + validation + field_mapping
//
// 📁 קבצי בדיקה: MakeCode/Production Invoice/EXEMPTS/
// לקיחת הקובץ העדכני: ls -lt "MakeCode/Production Invoice/EXEMPTS" | head -5
//
// ⚠️ קשור ל: MakeCode/Processing Invoice/v5.1
// אם מתקנים בעיה כאן (כמו תבנית BOOKNUM, docs_list) - לבדוק גם שם!
//
// תיקונים:
// v1.8.1: לעולם לא מחזיר שגיאה! אם אין התאמה - לוקח תבנית 0 + מדווח בפירוט
// v1.8.0: תאימות ל-v1.7: sample.BOOKNUM במקום sample.sample_booknum
// v1.7.9: תיקון - תמיכה ב-template_index כמחרוזת (Make שולח מחרוזת)
// v1.7.8: תמיכה ב-template_index מהקלט (לתמיכה במספר תבניות לספק)
// ============================================================================

// ⚠️ CRITICAL: result חייב להיות global כדי ש-Make.com יקרא אותו!
// משתמשים ב-var (לא let) כדי ליצור משתנה גלובלי אמיתי
var result;

(function() {

function removeUndefinedValues(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefinedValues(item));
    } else if (obj !== null && typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = removeUndefinedValues(value);
            }
        }
        return cleaned;
    }
    return obj;
}

function cleanInvoiceForPriority(invoice) {
    const cleaned = JSON.parse(JSON.stringify(invoice));
    if (!cleaned.PINVOICESCONT_SUBFORM) {
        cleaned.PINVOICESCONT_SUBFORM = [];
    }
    if (cleaned.PINVOICEITEMS_SUBFORM) {
        cleaned.PINVOICEITEMS_SUBFORM = cleaned.PINVOICEITEMS_SUBFORM.map(item => {
            delete item.isNewVehicle;
            delete item._learningNote;
            if (item.SPECIALVATFLAG && item.SPECIALVATFLAG !== "Y") {
                delete item.SPECIALVATFLAG;
            }
            if (item.BUDCODE === undefined) delete item.BUDCODE;
            if (item.SPECIALVATFLAG === undefined) delete item.SPECIALVATFLAG;
            if (item.TUNITNAME === undefined) delete item.TUNITNAME;
            return item;
        });
    }
    return cleaned;
}

function normalizeAzureFields(rawFields) {
    if (!rawFields || typeof rawFields !== 'object') {
        return {};
    }
    const normalized = {};
    for (const [key, field] of Object.entries(rawFields)) {
        if (!field || typeof field !== 'object') {
            normalized[key] = field;
            continue;
        }
        if (field.valueString !== undefined) {
            normalized[key] = field.valueString;
        } else if (field.valueDate !== undefined) {
            normalized[key] = field.valueDate;
        } else if (field.valueNumber !== undefined) {
            normalized[key] = field.valueNumber;
        } else if (field.valueCurrency !== undefined && field.valueCurrency !== null) {
            normalized[key] = (field.valueCurrency && field.valueCurrency.amount) || 0;
            if (key.includes('Total') || key.includes('Amount')) {
                normalized[key + '_amount'] = (field.valueCurrency && field.valueCurrency.amount) || 0;
                normalized[key + '_currency'] = (field.valueCurrency && field.valueCurrency.currencyCode) || '';
            }
        } else if (field.valueArray !== undefined && Array.isArray(field.valueArray)) {
            normalized[key] = field.valueArray.map(item => {
                if (!item) return item;
                if (item.valueObject && item.valueObject !== null) {
                    return normalizeAzureFields(item.valueObject);
                } else if (item.valueString !== undefined) {
                    return item.valueString;
                } else if (item.content !== undefined) {
                    return item.content;
                } else {
                    return item;
                }
            });
        } else if (field.valueObject !== undefined && field.valueObject !== null) {
            normalized[key] = normalizeAzureFields(field.valueObject);
        } else if (field.content !== undefined) {
            normalized[key] = field.content;
        } else {
            normalized[key] = field;
        }
    }
    return normalized;
}

function convertProductionInputToProcessingInput(productionInput) {
    // אם יש input array, אני צריך לחלץ vehicles ולבנות learned_config!
    let carsData = productionInput.CARS;
    let supTemp = productionInput.SUP_TEMP;
    let supname = productionInput.SUPNAME;
    let azureTextClean = productionInput.AZURE_TEXT_CLEAN || "";
    let existingLearnedConfig = null;

    if (productionInput.input && Array.isArray(productionInput.input)) {
        // חילוץ מה-input array
        for (const item of productionInput.input) {
            if (item.name === 'vehicles') {
                carsData = item.value;
                console.log('🔍 Found vehicles in input:', typeof carsData, carsData ? carsData.substring(0, 100) : 'empty');
            }
            if (item.name === 'supplier_template') supTemp = item.value;
            if (item.name === 'supplier_code') supname = item.value;
            if (item.name === 'AZURE_TEXT_CLEAN') azureTextClean = item.value;
            if (item.name === 'learned_config') existingLearnedConfig = item.value;
        }

        // אם יש learned_config קיים ויש בו config עם vehicleRules טוב - נשתמש בו
        const hasVehicleRules = existingLearnedConfig &&
                               existingLearnedConfig.config &&
                               existingLearnedConfig.config.rules &&
                               existingLearnedConfig.config.rules.critical_patterns &&
                               existingLearnedConfig.config.rules.critical_patterns.vehicle_rules &&
                               existingLearnedConfig.config.rules.critical_patterns.vehicle_rules.vehicle_account_mapping &&
                               Object.keys(existingLearnedConfig.config.rules.critical_patterns.vehicle_rules.vehicle_account_mapping).length > 0;

        if (hasVehicleRules) {
            console.log('✅ Using existing learned_config with vehicleRules');
            return productionInput;
        }

        // אין learned_config טוב - נבנה חדש מ-vehicles
        console.log('🔧 Building new learned_config from vehicles, carsData=' + (carsData ? 'exists' : 'null'));
    }

    let azureData;
    if (!productionInput.AZURE) {
        azureData = {};
    } else if (typeof productionInput.AZURE === 'string') {
        try {
            azureData = JSON.parse(productionInput.AZURE);
        } catch (e) {
            azureData = {};
        }
    } else {
        azureData = productionInput.AZURE || {};
    }

    // בניית learned_config מ-vehicles/CARS
    console.log('🔧 Building learned_config: supname=' + supname + ', carsData type=' + typeof carsData);
    const learnedConfig = buildLearnedConfigFromProduction(
        supname,
        carsData,
        supTemp
    );
    let documents = [];
    let fields = {};
    let content = "";
    if (azureData.analyzeResult) {
        content = azureData.analyzeResult.content || "";
        if (azureData.analyzeResult.documents && azureData.analyzeResult.documents.length > 0) {
            documents = azureData.analyzeResult.documents;
            const rawFields = documents[0].fields || {};
            fields = normalizeAzureFields(rawFields);
            fields._rawContent = content;
        }
    } else if (azureData.fields) {
        fields = azureData.fields;
        content = azureData.content || "";
        fields._rawContent = content;
    }
    return {
        input: [
            { name: "learned_config", value: learnedConfig },
            { name: "docs_list", value: { DOC_YES_NO: "N", list_of_docs: [] } },
            { name: "import_files", value: { IMPFILES: [] } },
            { name: "AZURE_RESULT", value: { data: { fields: fields, documents: documents } } },
            { name: "AZURE_TEXT_CLEAN", value: azureTextClean },
            { name: "AZURE_TEXT", value: content }
        ]
    };
}

function buildLearnedConfigFromProduction(supname, cars, supTemp) {
    const vehicleMapping = {};
    let carsArray = [];
    if (typeof cars === 'string') {
        try {
            carsArray = JSON.parse(cars);
        } catch (e) {
            carsArray = [];
        }
    } else if (Array.isArray(cars)) {
        carsArray = cars;
    }
    if (carsArray && Array.isArray(carsArray)) {
        carsArray.forEach(car => {
            if (car.CAR_NUMBER && car.ACCNAME) {
                vehicleMapping[car.CAR_NUMBER] = {
                    accname: car.ACCNAME,
                    accdes: car.ASSDES || "",
                    budcode: car.BUDCODE || "",
                    vat_pattern: { VATFLAG: "Y", SPECIALVATFLAG: "varies" },
                    date_range_pattern: "never",
                    pdaccname_pattern: "never"
                };
            }
        });
    }
    console.log('🚗 vehicleMapping:', Object.keys(vehicleMapping).length, 'רכבים');
    let supplierTemplate = null;
    let parsedTemplate = null;
    if (supTemp && typeof supTemp === 'string') {
        try {
            supplierTemplate = JSON.parse(supTemp);
        } catch (e) {
            supplierTemplate = null;
        }
    } else if (supTemp && typeof supTemp === 'object') {
        supplierTemplate = supTemp;
    }
    let parsedConfig = null;
    let templateData = null;
    if (supplierTemplate && supplierTemplate.TEMPLETE) {
        try {
            const templateStr = typeof supplierTemplate.TEMPLETE === 'string'
                ? supplierTemplate.TEMPLETE
                : JSON.stringify(supplierTemplate.TEMPLETE);
            templateData = JSON.parse(templateStr);
            if (templateData.llm_prompt && templateData.llm_prompt.all_templates) {
                const allPinvoices = templateData.llm_prompt.all_templates.map(template => {
                    return template.invoice_data?.PINVOICES?.[0] || {};
                });
                parsedTemplate = {
                    PINVOICES: allPinvoices,
                    document_types_count: allPinvoices.length
                };
            }
            if (templateData.technical_config && templateData.technical_config.all_templates) {
                parsedConfig = {
                    ...templateData.technical_config.all_templates[0],
                    supplier_config: {
                        supplier_code: templateData.technical_config.supplier_code,
                        supplier_name: templateData.technical_config.supplier_name
                    }
                };
            }
        } catch (e) {
            parsedTemplate = null;
            parsedConfig = null;
            templateData = null;
        }
    }
    const templatesCount = parsedTemplate?.PINVOICES?.length || 1;
    const config = {
        status: "success",
        supplier_id: supname || "",
        supplier_name: supplierTemplate?.SDES || parsedConfig?.supplier_config?.supplier_name || "",
        vendor_tax_id_reference: supplierTemplate?.VATNUM || parsedConfig?.supplier_config?.vendor_tax_id_reference || "",
        supplier_phone: supplierTemplate?.supplier_phone || "",
        supplier_email: supplierTemplate?.supplier_email || "",
        json_files_analyzed: 1,
        templates_detected: templatesCount,
        llm_prompt: templateData?.llm_prompt || null,
        technical_config: templateData?.technical_config || null,
        config: parsedConfig || {
            supplier_config: {
                supplier_code: supname || "",
                supplier_name: supplierTemplate?.SDES || "",
                vendor_tax_id_reference: supplierTemplate?.VATNUM || ""
            },
            structure: [{
                has_import: false,
                has_purchase_orders: false,
                has_doc: false,
                has_date_range: false,
                has_budcode: true,
                has_pdaccname: false,
                inventory_management: "not_managed_inventory",
                debit_type: "D"
            }],
            rules: {
                invoice_date_format: "DD/MM/YY",
                doc_variation: "",
                validation_data: { TOTQUANT: 1 },
                critical_patterns: {
                    vehicle_rules: {
                        partname: "car",
                        vehicle_account_mapping: vehicleMapping,
                        search_locations: [
                            { location: "fields.VehicleNumbers", priority: 1 },
                            { location: "fields.UnidentifiedNumbers", priority: 2, filter_by_label: "רכב" }
                        ],
                        default_values: {
                            accname: Object.values(vehicleMapping)[0]?.accname || "",
                            budcode: Object.values(vehicleMapping)[0]?.budcode || ""
                        },
                        output_format: { partname: "car" }
                    },
                    partname_rules: {}
                }
            },
            document_types: [{
                type: "חשבונית רגילה עם פירוט",
                accnames: Object.values(vehicleMapping).map(v => v.accname).filter((v, i, a) => a.indexOf(v) === i)
            }]
        },
        template: parsedTemplate || supplierTemplate?.template || {
            PINVOICES: [{
                SUPNAME: supname || "",
                CODE: "ש\"ח",
                DEBIT: "D",
                IVDATE: "",
                BOOKNUM: "",
                DETAILS: "",
                PINVOICEITEMS_SUBFORM: [],
                PINVOICESCONT_SUBFORM: []
            }],
            document_types_count: 1
        },
        recommended_samples: { samples: [] }
    };
    return config;
}

function processProductionInvoice(productionInput) {
    console.log('🚀 PRODUCTION INVOICE v1.6.6 IIFE (21:40 05.11.25) - ' + new Date().toISOString());
    console.log('📦 קוד: 49KB | 🔧 IIFE wrap: ✅ | 🎯 return במקום expression!');
    console.log('==========================================');
    const executionReport = {
        stage: "",
        found: [],
        not_found: [],
        warnings: [],
        errors: []
    };
    try {
        executionReport.stage = "המרת מבנה Production ל-Processing";
        const processingInput = convertProductionInputToProcessingInput(productionInput);
        executionReport.stage = "קריאה לפונקציית עיבוד";
        const result = processInvoiceComplete(processingInput);
        if (result.status === "success") {
            result.metadata = result.metadata || {};
            result.metadata.input_type = "production";
            result.metadata.filename = productionInput.FILENAME || "";
            result.metadata.cars_count = (productionInput.CARS || []).length;
        }
        return removeUndefinedValues(result);
    } catch (error) {
        executionReport.errors.push(error.message);
        const errorResult = {
            status: "error",
            error_type: error.name || "ProductionProcessingError",
            message: error.message,
            execution_report: executionReport
        };
        return removeUndefinedValues(errorResult);
    }
}

function processInvoiceComplete(input) {
    const executionReport = {
        stage: "",
        found: [],
        not_found: [],
        warnings: [],
        errors: []
    };
    try {
        let inputData = {};
        if (input.input && Array.isArray(input.input)) {
            // פורמט Make.com: { input: [{name, value}, ...] }
            input.input.forEach(item => {
                inputData[item.name] = item.value;
            });
        } else if (input.learned_config || input.AZURE_RESULT || input.vehicles) {
            // פורמט ישיר: { learned_config, AZURE_RESULT, vehicles, ... }
            inputData = input;
        }
        let learnedConfig = inputData.learned_config || {};
        if (typeof learnedConfig === 'string') {
            try {
                learnedConfig = JSON.parse(learnedConfig);
            } catch (e) {
                learnedConfig = {};
            }
        }
        if (learnedConfig.TEMPLETE && learnedConfig.SUPNAME) {
            try {
                const templateStr = typeof learnedConfig.TEMPLETE === 'string'
                    ? learnedConfig.TEMPLETE
                    : JSON.stringify(learnedConfig.TEMPLETE);
                const templateData = JSON.parse(templateStr);
                let parsedConfig = {};
                let parsedTemplate = { PINVOICES: [{}] };
                if (templateData.technical_config && templateData.technical_config.all_templates) {
                    parsedConfig = {
                        ...templateData.technical_config.all_templates[0],
                        supplier_config: {
                            supplier_code: templateData.technical_config.supplier_code,
                            supplier_name: templateData.technical_config.supplier_name
                        }
                    };
                }
                if (templateData.llm_prompt && templateData.llm_prompt.all_templates) {
                    const allPinvoices = templateData.llm_prompt.all_templates.map(template => {
                        return template.invoice_data?.PINVOICES?.[0] || {};
                    });
                    parsedTemplate = {
                        PINVOICES: allPinvoices,
                        document_types_count: allPinvoices.length
                    };
                }
                learnedConfig = {
                    status: "success",
                    supplier_id: learnedConfig.SUPNAME,
                    supplier_name: learnedConfig.SDES || "",
                    vendor_tax_id_reference: learnedConfig.VATNUM || "",
                    config: parsedConfig,
                    template: parsedTemplate
                };
            } catch (e) {
                // ignore
            }
        }
        let docsList = inputData.docs_list || { DOC_YES_NO: "N", list_of_docs: [] };
        if (typeof docsList === 'string') {
            try {
                // טיפול בפורמט "{[...]}" - הסר את הסוגריים החיצוניים
                let cleaned = docsList.trim();
                if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
                    cleaned = cleaned.slice(1, -1); // הסר { ו-}
                }
                const parsedArray = JSON.parse(cleaned);
                docsList = {
                    DOC_YES_NO: "Y",
                    list_of_docs: Array.isArray(parsedArray) ? parsedArray.map(d => JSON.stringify(d)) : []
                };
                console.log(`✅ docs_list parsed: ${docsList.list_of_docs.length} תעודות`);
            } catch (e) {
                console.log('❌ שגיאה בפרסור docs_list:', e.message);
                docsList = { DOC_YES_NO: "N", list_of_docs: [] };
            }
        }
        let importFiles = inputData.import_files || { IMPFILES: [] };
        if (typeof importFiles === 'string') {
            try {
                importFiles = JSON.parse(importFiles);
            } catch (e) {
                importFiles = { IMPFILES: [] };
            }
        }

        // Parse vehicles input and build vehicle_account_mapping
        let vehicleMapping = {};
        if (inputData.vehicles) {
            try {
                let vehiclesData = inputData.vehicles;
                if (typeof vehiclesData === 'string') {
                    // טיפול בפורמט "{[...]}" - הסר את הסוגריים החיצוניים
                    let cleaned = vehiclesData.trim();
                    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
                        cleaned = cleaned.slice(1, -1); // הסר { ו-}
                    }
                    vehiclesData = JSON.parse(cleaned);
                }
                // המרה למבנה vehicle_account_mapping: { "CAR_NUMBER": { accname, assdes, ... } }
                // אם יש duplicate - לוקח את זה עם ACCNAME הגבוה ביותר
                if (Array.isArray(vehiclesData)) {
                    vehiclesData.forEach(v => {
                        if (v.CAR_NUMBER) {
                            const existing = vehicleMapping[v.CAR_NUMBER];
                            // אם אין existing או ACCNAME הנוכחי גבוה יותר - עדכן
                            if (!existing || (v.ACCNAME && (!existing.accname || v.ACCNAME > existing.accname))) {
                                vehicleMapping[v.CAR_NUMBER] = {
                                    accname: v.ACCNAME,
                                    assdes: v.ASSDES,
                                    group: v.GROUP,
                                    vat_pattern: { VATFLAG: "Y" } // default VAT
                                };
                            }
                        }
                    });
                    console.log(`✅ vehicles parsed: ${Object.keys(vehicleMapping).length} רכבים`);
                }
            } catch (e) {
                console.log('❌ שגיאה בפרסור vehicles:', e.message);
                vehicleMapping = {};
            }
        }

        let azureResult = inputData.AZURE_RESULT || { data: { fields: {} } };
        if (typeof azureResult === 'string') {
            try {
                azureResult = JSON.parse(azureResult);
            } catch (e) {
                azureResult = { data: { fields: {} } };
            }
        }
        const azureTextClean = inputData.AZURE_TEXT_CLEAN || "";
        const azureTextRaw = inputData.AZURE_TEXT || "";
        const azureText = azureTextClean || azureTextRaw;
        if (!azureResult.data) {
            if (azureResult.analyzeResult) {
                const analyzeResult = azureResult.analyzeResult;
                const documents = analyzeResult.documents || [];
                if (documents.length > 0) {
                    const rawFields = documents[0].fields || {};
                    const normalizedFields = normalizeAzureFields(rawFields);
                    azureResult.data = {
                        fields: normalizedFields,
                        documents: documents
                    };
                } else {
                    azureResult.data = { fields: {}, documents: [] };
                }
            } else if (azureResult.apiVersion && azureResult.documents) {
                const documents = azureResult.documents || [];
                if (documents.length > 0) {
                    const rawFields = documents[0].fields || {};
                    const normalizedFields = normalizeAzureFields(rawFields);
                    azureResult.data = {
                        fields: normalizedFields,
                        documents: documents
                    };
                } else {
                    azureResult.data = { fields: {}, documents: [] };
                }
            } else {
                azureResult.data = { fields: {}, documents: [] };
            }
        }
        if (!azureResult.data.fields) {
            azureResult.data.fields = {};
        }
        executionReport.stage = "שלב 1: זיהוי סוג ותבנית";
        const hasImport = checkImportExists(importFiles);
        const hasDocs = checkDocsInOCR(azureResult.data.fields, azureText);
        const debitType = identifyDebitType(azureResult.data.fields);
        executionReport.found.push(`סוג: יבוא=${hasImport}, תעודות=${hasDocs}, חיוב/זיכוי=${debitType}`);
        const config = learnedConfig.config || learnedConfig.technical_config || {};

        // Inject vehicle_account_mapping into config if we have vehicles
        if (Object.keys(vehicleMapping).length > 0) {
            if (!config.rules) config.rules = {};
            if (!config.rules.critical_patterns) config.rules.critical_patterns = {};
            if (!config.rules.critical_patterns.vehicle_rules) {
                config.rules.critical_patterns.vehicle_rules = {
                    partname: "car",
                    vehicle_account_mapping: {},
                    search_locations: [
                        { location: "fields.VehicleNumbers", priority: 1 },
                        { location: "fields.UnidentifiedNumbers", priority: 2, filter_by_label: "רכב" }
                    ],
                    output_format: { partname: "car" },
                    default_values: { budcode: null }
                };
            }
            // Inject the mapping
            config.rules.critical_patterns.vehicle_rules.vehicle_account_mapping = vehicleMapping;
            console.log(`✅ Injected ${Object.keys(vehicleMapping).length} vehicles into config`);
        }

        // בניית allStructures - תמיכה בפורמטים שונים
        let allStructures = config.structure;

        // אם אין structure, נסה לבנות מ-processing_scenario.all_templates
        if (!allStructures && learnedConfig.processing_scenario?.all_templates) {
            console.log('🔧 בונה structure מתוך processing_scenario.all_templates');
            allStructures = learnedConfig.processing_scenario.all_templates.map(t => ({
                has_import: t.check_import || false,
                has_doc: t.check_docs || false,
                has_vehicles: t.check_vehicles || false,
                debit_type: t.debit_type || "D",
                has_budcode: true,
                inventory_management: "not_managed_inventory"
            }));
            console.log(`✅ נבנו ${allStructures.length} structures:`, JSON.stringify(allStructures));
        }

        // fallback לוגיקה ישנה - technical_config.all_templates
        if (!allStructures && config.all_templates) {
            console.log('🔧 בונה structure מתוך technical_config.all_templates');
            allStructures = config.all_templates.map(t => ({
                has_import: t.check_import || false,
                has_doc: t.check_docs || false,
                has_vehicles: t.check_vehicles || false,
                debit_type: t.debit_type || "D",
                has_budcode: true,
                inventory_management: "not_managed_inventory"
            }));
            console.log(`✅ נבנו ${allStructures.length} structures:`, JSON.stringify(allStructures));
        }

        // fallback אחרון - אם גם זה לא קיים
        if (!allStructures) {
            console.log('⚠️ משתמש ב-fallback structure');
            allStructures = [{
                has_import: false,
                has_doc: false,
                has_vehicles: false,
                debit_type: "D",
                has_budcode: true,
                inventory_management: "not_managed_inventory"
            }];
        }
        let allTemplates;
        if (learnedConfig.template?.PINVOICES) {
            allTemplates = learnedConfig.template.PINVOICES;
        } else if (learnedConfig.llm_prompt?.all_templates) {
            allTemplates = learnedConfig.llm_prompt.all_templates.map(t =>
                t.invoice_data?.PINVOICES?.[0] || {}
            );
        } else if (learnedConfig.invoice_data?.PINVOICES) {
            allTemplates = learnedConfig.invoice_data.PINVOICES;
        } else {
            allTemplates = [{
                SUPNAME: config.supplier_config?.supplier_code || "",
                CODE: "ש\"ח",
                DEBIT: "D"
            }];
        }
        // ✅ חדש! אם קיבלנו template_index בקלט - להשתמש בו ישירות
        // תמיכה גם במספר וגם במחרוזת (Make שולח מחרוזת)
        let templateIndex;
        let templateMatchStatus = "matched"; // matched / fallback / forced
        let templateMatchReason = "";

        const rawTemplateIndex = inputData.template_index;
        if (rawTemplateIndex !== undefined && rawTemplateIndex !== null && rawTemplateIndex !== '') {
            templateIndex = parseInt(rawTemplateIndex, 10);
            if (!isNaN(templateIndex) && templateIndex >= 0 && templateIndex < allStructures.length) {
                templateMatchStatus = "forced";
                templateMatchReason = "template_index סופק בקלט";
                executionReport.found.push(`תבנית: index=${templateIndex} (מקלט - template_index)`);
            } else {
                // template_index לא תקין - fallback לזיהוי אוטומטי
                templateIndex = findMatchingTemplate(allStructures, hasImport, hasDocs, debitType);
                if (templateIndex === -1) {
                    // ✅ v1.8.1: לא זורקים שגיאה! משתמשים בתבנית 0 כברירת מחדל
                    templateIndex = 0;
                    templateMatchStatus = "fallback";
                    templateMatchReason = `לא נמצאה התאמה (חיפשנו: has_import=${hasImport}, has_doc=${hasDocs}, debit_type=${debitType}). נלקחה תבנית 0 כברירת מחדל`;
                    executionReport.warnings.push(`⚠️ לא נמצאה תבנית מתאימה! משתמשים בתבנית 0`);
                    executionReport.warnings.push(`   חיפשנו: יבוא=${hasImport}, תעודות=${hasDocs}, סוג=${debitType}`);
                    executionReport.warnings.push(`   תבניות זמינות: ${allStructures.map((s, i) => `${i}: יבוא=${s.has_import}, תעודות=${s.has_doc}, סוג=${s.debit_type}`).join(' | ')}`);
                } else {
                    templateMatchStatus = "matched";
                    templateMatchReason = "זיהוי אוטומטי (template_index בקלט לא תקין)";
                    executionReport.found.push(`תבנית: נמצאה התאמה (index=${templateIndex}) (זיהוי אוטומטי - template_index לא תקין)`);
                }
            }
        } else {
            // fallback - זיהוי אוטומטי לפי מאפייני המסמך
            templateIndex = findMatchingTemplate(allStructures, hasImport, hasDocs, debitType);
            if (templateIndex === -1) {
                // ✅ v1.8.1: לא זורקים שגיאה! משתמשים בתבנית 0 כברירת מחדל
                templateIndex = 0;
                templateMatchStatus = "fallback";
                templateMatchReason = `לא נמצאה התאמה (חיפשנו: has_import=${hasImport}, has_doc=${hasDocs}, debit_type=${debitType}). נלקחה תבנית 0 כברירת מחדל`;
                executionReport.warnings.push(`⚠️ לא נמצאה תבנית מתאימה! משתמשים בתבנית 0`);
                executionReport.warnings.push(`   חיפשנו: יבוא=${hasImport}, תעודות=${hasDocs}, סוג=${debitType}`);
                executionReport.warnings.push(`   תבניות זמינות: ${allStructures.map((s, i) => `${i}: יבוא=${s.has_import}, תעודות=${s.has_doc}, סוג=${s.debit_type}`).join(' | ')}`);
            } else {
                templateMatchStatus = "matched";
                templateMatchReason = "זיהוי אוטומטי לפי מאפייני המסמך";
                executionReport.found.push(`תבנית: נמצאה התאמה (index=${templateIndex}) (זיהוי אוטומטי)`);
            }
        }

        // שמירת מידע על ההתאמה לדוח
        executionReport.template_match = {
            status: templateMatchStatus,
            template_index: templateIndex,
            reason: templateMatchReason,
            document_characteristics: {
                has_import: hasImport,
                has_doc: hasDocs,
                debit_type: debitType
            },
            available_templates: allStructures.length
        };
        const structure = allStructures[templateIndex];
        const template = allTemplates[templateIndex] || allTemplates[0];
        executionReport.stage = "שלב 2: הבנת דפוסים";
        const patterns = extractPatterns(learnedConfig.recommended_samples, docsList);
        executionReport.found.push(`דפוסים: נמצאו`);
        const vehicleRules = config.rules?.critical_patterns?.vehicle_rules || null;
        console.log('🚗 vehicleRules:', !!vehicleRules, 'mapping:', Object.keys(vehicleRules?.vehicle_account_mapping || {}).length);
        if (vehicleRules && vehicleRules.vehicle_account_mapping) {
            executionReport.found.push(`חוקי רכבים: פעילים (${Object.keys(vehicleRules.vehicle_account_mapping).length} רכבים)`);
        }
        executionReport.stage = "שלב 3: חיפוש נתונים";
        const ocrFields = azureResult.data.fields || {};
        ocrFields.AZURE_TEXT_CLEAN = azureTextClean;
        const searchResults = searchAllData(
            ocrFields,
            azureText,
            patterns,
            structure,
            importFiles,
            docsList,
            vehicleRules
        );
        Object.keys(searchResults).forEach(key => {
            if (key === 'vehicles' && searchResults.vehicles) {
                if (searchResults.vehicles.length > 0) {
                    executionReport.found.push(`רכבים: ${searchResults.vehicles.length} רכבים - ${searchResults.vehicles.join(', ')}`);
                }
            } else if (searchResults[key]) {
                const value = searchResults[key];
                if (Array.isArray(value)) {
                    executionReport.found.push(`${key}: ${value.length} פריטים`);
                } else if (typeof value === 'string' && value.length > 0) {
                    const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
                    executionReport.found.push(`${key}: "${displayValue}"`);
                } else if (value !== null) {
                    executionReport.found.push(`${key}: ${JSON.stringify(value)}`);
                }
            }
        });
        executionReport.stage = "שלב 4: בניית חשבונית";
        const invoice = buildInvoiceFromTemplate(
            template,
            structure,
            config,
            searchResults,
            learnedConfig,
            ocrFields
        );
        executionReport.stage = "שלב 5: בקרות";
        const validation = performValidation(invoice, ocrFields, config, docsList, patterns, structure, searchResults, template);
        executionReport.stage = "שלב 6: ניתוח למידה";
        const learningAnalysis = analyzeLearning(invoice, config);
        executionReport.stage = "שלב 7: ניקוי והכנה לפריוריטי";
        const cleanedInvoice = cleanInvoiceForPriority(invoice);
        const result = {
            status: "success",
            supplier_identification: {
                supplier_code: learnedConfig.supplier_id ||
                              learnedConfig.llm_prompt?.supplier_code ||
                              learnedConfig.technical_config?.supplier_code ||
                              config.supplier_config?.supplier_code || "",
                supplier_name: learnedConfig.supplier_name ||
                              learnedConfig.llm_prompt?.supplier_name ||
                              learnedConfig.technical_config?.supplier_name ||
                              config.supplier_config?.supplier_name || "",
                identification_method: "vendor_tax_id",
                confidence: "high"
            },
            invoice_data: {
                PINVOICES: [cleanedInvoice]
            },
            validation: validation,
            learning_analysis: learningAnalysis,
            execution_report: executionReport,
            metadata: {
                ocr_invoice_id: ocrFields.InvoiceId || "",
                ocr_invoice_date: ocrFields.InvoiceDate || "",
                ocr_total_amount: ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount || 0,
                ocr_subtotal: ocrFields.SubTotal || ocrFields.SubTotal_amount ||
                             (ocrFields.InvoiceTotal_amount && ocrFields.TotalTax_amount ?
                              ocrFields.InvoiceTotal_amount - ocrFields.TotalTax_amount : null),
                ocr_tax: ocrFields.TotalTax || ocrFields.TotalTax_amount || 0,
                processing_timestamp: new Date().toISOString(),
                version: "1.0-production",
                template_index: templateIndex,
                template_type: structure.has_import && structure.has_doc ? "import_with_docs" :
                              structure.has_import ? "import_only" :
                              structure.has_doc ? "docs_only" :
                              structure.has_vehicles ? "vehicles" :
                              structure.debit_type === "C" ? "credit_note" : "regular",
                has_vehicles: structure.has_vehicles || false,
                vehicle_numbers: searchResults.vehicles || [],
                vehicle_count: searchResults.vehicles ? searchResults.vehicles.length : 0,
                has_documents: structure.has_doc || false,
                document_count: searchResults.documents ? searchResults.documents.length : 0,
                has_import: structure.has_import || false
            }
        };
        return removeUndefinedValues(result);
    } catch (error) {
        executionReport.errors.push(error.message);
        const errorResult = {
            status: "error",
            error_type: error.name || "ProcessingError",
            message: error.message,
            execution_report: executionReport
        };
        return removeUndefinedValues(errorResult);
    }
}

function checkImportExists(importFiles) {
    if (!importFiles || !importFiles.IMPFILES) return false;
    if (importFiles.IMPFILES.length === 0) return false;
    return true;
}

function checkDocsInOCR(ocrFields, azureText) {
    const unidentified = ocrFields.UnidentifiedNumbers || [];
    const docPattern = /^25\d{6}$/;
    const booknumPattern = /^10\d{7}$/;  // BOOKNUM pattern (10XXXXXXX - 9 digits)
    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            if (unidentified.some(item => docPattern.test(item.value) || booknumPattern.test(item.value))) {
                return true;
            }
        } else {
            if (unidentified.some(num => docPattern.test(num) || booknumPattern.test(num))) {
                return true;
            }
        }
    }
    if (azureText) {
        if (azureText.match(/\b25\d{6}\b/g) || azureText.match(/\b10\d{7}\b/g)) {
            return true;
        }
    }
    return false;
}

function identifyDebitType(ocrFields) {
    const total = ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount || 0;
    return total >= 0 ? "D" : "C";
}

function findMatchingTemplate(structures, hasImport, hasDocs, debitType) {
    return structures.findIndex(s =>
        s.has_import === hasImport &&
        s.has_doc === hasDocs &&
        s.debit_type === debitType
    );
}

function extractPatterns(recommendedSamples, docsList) {
    const patterns = {
        booknum_pattern: null,
        ivnum_pattern: null,
        docs_pattern: null,
        docs_totquant: {}
    };
    if (recommendedSamples && recommendedSamples.samples && recommendedSamples.samples.length > 0) {
        const sample = recommendedSamples.samples[0];
        if (sample.sample_booknum) {
            patterns.booknum_pattern = {
                length: sample.sample_booknum.length,
                example: sample.sample_booknum
            };
        }
    }
    return patterns;
}

function searchAllData(ocrFields, azureText, patterns, structure, importFiles, docsList, vehicleRules) {
    // חיפוש תעודות אם נדרש
    let documents = null;
    if (structure.has_doc) {
        documents = searchDocuments(ocrFields, azureText, docsList);
        console.log(`🔍 מחפש תעודות: נמצאו ${documents?.length || 0}`);
    }

    return {
        booknum: searchBooknum(ocrFields, patterns),
        ivdate: searchIvdate(ocrFields),
        details: searchDetails(ocrFields, azureText),
        ordname: null,
        impfnum: null,
        documents: documents,
        vehicles: vehicleRules ? extractVehiclesAdvanced(ocrFields, vehicleRules) : [],
        items: ocrFields.Items || []
    };
}

function searchBooknum(ocrFields, patterns) {
    const original = ocrFields.InvoiceId || "";
    let booknum = String(original);
    booknum = booknum.replace(/^SI/i, '');
    const match = booknum.match(/^[\d\-\/]+/);
    if (match) {
        booknum = match[0];
    }
    booknum = booknum.trim();
    if (patterns.booknum_pattern) {
        const expectedLength = patterns.booknum_pattern.length;
        if (booknum.length > expectedLength) {
            booknum = booknum.slice(-expectedLength);
        }
    }
    console.log(`BOOKNUM: "${original}" → "${booknum}"`);
    return booknum;
}

function searchIvdate(ocrFields) {
    const isoDate = ocrFields.InvoiceDate;
    if (!isoDate) return "";
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

function searchDetails(ocrFields, azureText) {
    if (ocrFields.InvoiceDescription) {
        return ocrFields.InvoiceDescription;
    }
    if (azureText) {
        const lines = azureText.split('\n').filter(l => l.trim());
        if (lines.length > 2) {
            return lines[2].substring(0, 100);
        }
    }
    return "";
}

function searchDocuments(ocrFields, azureText, docsList) {
    const foundDocs = [];

    if (!docsList || !docsList.list_of_docs || docsList.list_of_docs.length === 0) {
        console.log('⚠️ docs_list ריק או לא קיים');
        return foundDocs;
    }

    let availableDocs = [];
    try {
        availableDocs = docsList.list_of_docs.flatMap(d => JSON.parse(d));
        console.log(`📋 יש ${availableDocs.length} תעודות זמינות`);
    } catch (e) {
        console.log('❌ שגיאה בפרסור docs_list:', e.message);
        return foundDocs;
    }

    const unidentified = ocrFields.UnidentifiedNumbers || [];
    console.log(`🔍 מחפש ב-${unidentified.length} UnidentifiedNumbers`);

    // חיפוש ב-UnidentifiedNumbers
    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            for (const item of unidentified) {
                const match = availableDocs.find(doc => doc.BOOKNUM === item.value);
                if (match) {
                    // בדיקה: האם כבר הוספנו תעודה עם אותו BOOKNUM?
                    const alreadyExists = foundDocs.some(d => d.BOOKNUM === match.BOOKNUM);
                    if (!alreadyExists) {
                        console.log(`✅ מצאתי תעודה: ${match.BOOKNUM} → ${match.DOCNO}`);
                        foundDocs.push({
                            DOCNO: match.DOCNO,
                            BOOKNUM: match.BOOKNUM,
                            TOTQUANT: match.TOTQUANT || null
                        });
                    } else {
                        console.log(`⏭️ דילוג: ${match.BOOKNUM} כבר קיים`);
                    }
                }
            }
        } else {
            for (const num of unidentified) {
                const match = availableDocs.find(doc => doc.BOOKNUM === num);
                if (match) {
                    // בדיקה: האם כבר הוספנו תעודה עם אותו BOOKNUM?
                    const alreadyExists = foundDocs.some(d => d.BOOKNUM === match.BOOKNUM);
                    if (!alreadyExists) {
                        console.log(`✅ מצאתי תעודה: ${match.BOOKNUM} → ${match.DOCNO}`);
                        foundDocs.push({
                            DOCNO: match.DOCNO,
                            BOOKNUM: match.BOOKNUM,
                            TOTQUANT: match.TOTQUANT || null
                        });
                    } else {
                        console.log(`⏭️ דילוג: ${match.BOOKNUM} כבר קיים`);
                    }
                }
            }
        }
    }

    // Fallback: חיפוש ב-AZURE_TEXT
    if (foundDocs.length === 0 && azureText) {
        console.log('🔍 מחפש fallback ב-AZURE_TEXT');
        for (const doc of availableDocs) {
            // ⚠️ דלג על BOOKNUM לא תקין (קצר מדי או ריק)
            // BOOKNUM תקין: 107XXXXXX, 108XXXXXX, 258XXXXXX (מינימום 7 תווים)
            if (!doc.BOOKNUM || doc.BOOKNUM.length < 7) {
                console.log(`⚠️ דילוג על תעודה עם BOOKNUM לא תקין: DOCNO=${doc.DOCNO}, BOOKNUM="${doc.BOOKNUM || 'null'}"`);
                continue;
            }

            const pattern = new RegExp('\\b' + doc.BOOKNUM + '\\b');
            if (pattern.test(azureText)) {
                // בדיקה: האם כבר הוספנו תעודה עם אותו BOOKNUM?
                const alreadyExists = foundDocs.some(d => d.BOOKNUM === doc.BOOKNUM);
                if (!alreadyExists) {
                    console.log(`✅ מצאתי תעודה בטקסט: ${doc.BOOKNUM} → ${doc.DOCNO}`);
                    foundDocs.push({
                        DOCNO: doc.DOCNO,
                        BOOKNUM: doc.BOOKNUM,
                        TOTQUANT: doc.TOTQUANT || null
                    });
                } else {
                    console.log(`⏭️ דילוג: ${doc.BOOKNUM} כבר קיים`);
                }
            }
        }
    }

    console.log(`📊 סה"כ תעודות שנמצאו: ${foundDocs.length}`);
    return foundDocs;
}

function extractVehiclesAdvanced(ocrFields, vehicleRules) {
    console.log('🔍 extractVehiclesAdvanced: vehicleRules=' + !!vehicleRules + ', mapping=' + Object.keys(vehicleRules?.vehicle_account_mapping || {}).length);
    if (!vehicleRules || !vehicleRules.vehicle_account_mapping) {
        return [];
    }
    const foundVehicles = [];
    const vehiclePattern = /\d{3}-\d{2}-\d{3}/g;
    const searchLocations = vehicleRules.search_locations || [
        { location: "fields.UnidentifiedNumbers", priority: 1, filter_by_label: "רכב" }
    ];
    const sortedLocations = [...searchLocations].sort((a, b) => a.priority - b.priority);
    for (const location of sortedLocations) {
        if (location.location === "fields.VehicleNumbers") {
            if (ocrFields.VehicleNumbers && Array.isArray(ocrFields.VehicleNumbers)) {
                ocrFields.VehicleNumbers.forEach(vNum => {
                    if (!foundVehicles.includes(vNum)) {
                        foundVehicles.push(vNum);
                    }
                });
            }
        }
        else if (location.location === "fields.UnidentifiedNumbers") {
            const unidentified = ocrFields.UnidentifiedNumbers || [];
            unidentified.forEach(item => {
                const value = typeof item === 'object' ? item.value : item;
                const label = typeof item === 'object' ? (item.label || '') : '';
                const context = typeof item === 'object' ? (item.context || '') : '';
                const isValidVehicleNumber = /\d{3}-\d{2}-\d{3}/.test(value);
                const looksLikeCardNumber = context.includes('כרטיס') || label.includes('כרטיס');
                if (location.filter_by_label) {
                    if (label && label.includes(location.filter_by_label)) {
                        if (isValidVehicleNumber && !looksLikeCardNumber && !foundVehicles.includes(value)) {
                            foundVehicles.push(value);
                        }
                    }
                } else {
                    if (isValidVehicleNumber && !looksLikeCardNumber && !foundVehicles.includes(value)) {
                        foundVehicles.push(value);
                    }
                }
            });
        }
    }
    console.log(`🚗 foundVehicles from OCR: ${foundVehicles.length}`);
    if (foundVehicles.length === 0) {
        let textToSearch = ocrFields.AZURE_TEXT_CLEAN || ocrFields._rawContent || '';
        console.log(`📝 Searching in text: ${textToSearch.length} chars, has 419-29-702: ${textToSearch.includes('419-29-702')}`);
        if (textToSearch) {
            console.log(`🔍 חיפוש רכבים בטקסט (${ocrFields.AZURE_TEXT_CLEAN ? 'CLEAN' : 'RAW'})`);
            const contentMatches = textToSearch.match(vehiclePattern);
            if (contentMatches) {
                console.log(`🚗 נמצאו ${contentMatches.length} מספרי רכב: ${[...new Set(contentMatches)].join(', ')}`);
                contentMatches.forEach(match => {
                    const matchIndex = textToSearch.indexOf(match);
                    const contextStart = Math.max(0, matchIndex - 50);
                    const contextEnd = Math.min(textToSearch.length, matchIndex + match.length + 50);
                    const context = textToSearch.substring(contextStart, contextEnd).toLowerCase();
                    const isCard = context.includes('כרטיס') || context.includes('אשראי');
                    const isTaxId = context.includes('ח.פ') || context.includes('עוסק מורשה');
                    const isVehicle = context.includes('רכב') || context.includes('רישוי') ||
                                     context.includes('משאית') || context.includes('vehicle');
                    if (!isCard && !isTaxId && (isVehicle || vehicleRules.vehicle_account_mapping[match])) {
                        if (!foundVehicles.includes(match)) {
                            console.log(`✅ רכב מאושר: ${match}`);
                            foundVehicles.push(match);
                        }
                    } else {
                        console.log(`❌ נדחה ${match} (card:${isCard}, tax:${isTaxId}, vehicle:${isVehicle})`);
                    }
                });
            }
        }
    }
    return [...new Set(foundVehicles)];
}

function buildInvoiceFromTemplate(template, structure, config, searchResults, learnedConfig, ocrFields) {
    const supplierCode = template.SUPNAME ||
                        config.supplier_config?.supplier_code ||
                        learnedConfig.supplier_id ||
                        learnedConfig.llm_prompt?.supplier_code ||
                        learnedConfig.technical_config?.supplier_code ||
                        "";
    const invoice = {
        SUPNAME: supplierCode,
        CODE: template.CODE || "ש\"ח",
        DEBIT: structure.debit_type || "D",
        IVDATE: searchResults.ivdate,
        BOOKNUM: searchResults.booknum
    };
    // DETAILS - יוגדר מאוחר יותר לפי שורה 1 של PDES (אם יש פריטים)
    // אם זה לא רכבים ויש details מ-OCR
    if (searchResults.details && searchResults.details.trim() && !searchResults.vehicles) {
        const isGeneric = ['עבודה', 'work', 'labor'].some(term => searchResults.details.trim() === term);
        if (!isGeneric) {
            invoice.DETAILS = searchResults.details;
        }
    }

    // תעודות (אם נמצאו)
    if (searchResults.documents && searchResults.documents.length > 0) {
        console.log(`📄 מוסיף ${searchResults.documents.length} תעודות`);
        if (searchResults.documents.length === 1) {
            // תעודה יחידה - שדות רגילים
            const doc = searchResults.documents[0];
            invoice.DOCNO = doc.DOCNO;
            // BOOKNUM נשאר של החשבונית, לא משנים!
            console.log(`✅ תעודה יחידה: DOCNO=${doc.DOCNO}, doc BOOKNUM=${doc.BOOKNUM}`);
        } else {
            // מספר תעודות - תת-טופס
            invoice.PIVDOC_SUBFORM = searchResults.documents.map(d => ({
                DOCNO: d.DOCNO,
                BOOKNUM: d.BOOKNUM
            }));
            console.log(`✅ ${searchResults.documents.length} תעודות ב-PIVDOC_SUBFORM`);
        }
    }

    // פריטים - רק אם זו לא תבנית תעודות!
    // אם has_doc=true → לעולם לא צריך פריטים (גם אם לא נמצאו תעודות)
    const needItems = !structure.has_doc;
    console.log(`🔧 needItems=${needItems} (has_doc=${structure.has_doc}, found docs=${searchResults.documents?.length || 0})`);

    if (needItems) {
        const vehicleRules = config.rules?.critical_patterns?.vehicle_rules;
        if (searchResults.vehicles && searchResults.vehicles.length > 0 && vehicleRules) {
            invoice.PINVOICEITEMS_SUBFORM = createVehicleItems(
                searchResults.vehicles,
                searchResults.items,
                vehicleRules,
                ocrFields
            );
        } else if (searchResults.items && searchResults.items.length > 0) {
            invoice.PINVOICEITEMS_SUBFORM = createItemsFromOCR(
                searchResults.items,
                template,
                ocrFields
            );
        } else if (template.PINVOICEITEMS_SUBFORM) {
            invoice.PINVOICEITEMS_SUBFORM = JSON.parse(JSON.stringify(template.PINVOICEITEMS_SUBFORM));
        }
    }

    // DETAILS - לפי PDES של שורה 1 (אם יש פריטים)
    if (invoice.PINVOICEITEMS_SUBFORM && invoice.PINVOICEITEMS_SUBFORM.length > 0) {
        invoice.DETAILS = invoice.PINVOICEITEMS_SUBFORM[0].PDES || null;
        console.log(`✅ DETAILS set from first item PDES: ${invoice.DETAILS}`);
    }

    if (template.PINVOICESCONT_SUBFORM) {
        invoice.PINVOICESCONT_SUBFORM = template.PINVOICESCONT_SUBFORM;
    }
    return invoice;
}

function extractShortDescription(ocrFields, vehicleNum) {
    if (ocrFields.Items && ocrFields.Items.length > 0) {
        const item = ocrFields.Items.find(i =>
            i.Description && (
                i.Description.includes(vehicleNum) ||
                i.Description.includes('טיפול') ||
                i.Description.includes('עבודה')
            )
        );
        if (item && item.Description) {
            const desc = item.Description.trim();
            const servicePattern = /טיפול\s+[\d,]+\s*ק[״"]?מ/i;
            const match = desc.match(servicePattern);
            if (match) {
                let serviceDesc = match[0];
                serviceDesc = serviceDesc
                    .replace(/,/g, '')
                    .replace(/קמ/g, 'ק"מ')
                    .replace(/ק״מ/g, 'ק"מ');
                return serviceDesc;
            }
            const words = desc.split(/\s+/);
            let shortDesc = words.slice(0, 4).join(' ');
            if (shortDesc.length > 50) {
                shortDesc = shortDesc.substring(0, 47) + '...';
            }
            return shortDesc;
        }
    }
    return 'טיפול';
}

function createItemsFromOCR(ocrItems, template, ocrFields) {
    if (!ocrItems || ocrItems.length === 0) return [];
    const items = [];
    const templateItem = template.PINVOICEITEMS_SUBFORM?.[0] || {};
    ocrItems.forEach((ocrItem, index) => {
        let price = 0;
        if (ocrItem.UnitPrice) {
            price = ocrItem.UnitPrice;
        } else if (ocrItem.Amount && ocrItem.Quantity) {
            price = ocrItem.Amount / (ocrItem.Quantity || 1);
        } else if (ocrItem.Amount) {
            price = ocrItem.Amount;
        }
        const item = {
            PARTNAME: templateItem.PARTNAME || "item",
            TUNITNAME: ocrItem.Unit || templateItem.TUNITNAME || "יח'",
            VATFLAG: templateItem.VATFLAG || "Y",
            ACCNAME: templateItem.ACCNAME || "",
            SPECIALVATFLAG: templateItem.SPECIALVATFLAG || "Y",
            PDES: ocrItem.Description || templateItem.PDES || "",
            TQUANT: ocrItem.Quantity || 1,
            PRICE: price
        };
        if (templateItem.BUDCODE) {
            item.BUDCODE = templateItem.BUDCODE;
        }
        items.push(item);
    });
    const calculatedTotal = items.reduce((sum, item) => sum + (item.TQUANT * item.PRICE), 0);
    let ocrSubtotal = ocrFields.SubTotal || ocrFields.SubTotal_amount || 0;
    if (!ocrSubtotal &&
        (ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount) &&
        (ocrFields.TotalTax || ocrFields.TotalTax_amount)) {
        const invoiceTotal = ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount;
        const totalTax = ocrFields.TotalTax || ocrFields.TotalTax_amount;
        ocrSubtotal = invoiceTotal - totalTax;
    }
    if (calculatedTotal > 0 && ocrSubtotal > 0) {
        const difference = Math.abs(calculatedTotal - ocrSubtotal);
        const percentDiff = (difference / ocrSubtotal) * 100;
        if (percentDiff > 5) {
            console.log(`⚠️ הפרש סכומים: ${difference.toFixed(2)} (${percentDiff.toFixed(1)}%)`);
        } else {
            console.log(`✅ סכום תואם: OCR=${ocrSubtotal}, חישוב=${calculatedTotal.toFixed(2)}`);
        }
    }
    console.log(`נוצרו ${items.length} פריטים מ-OCR`);
    return items;
}

function createVehicleItems(vehicles, ocrItems, vehicleRules, ocrFields) {
    if (!vehicles || vehicles.length === 0) return [];
    const vehicleItems = [];

    // Calculate SubTotal (before VAT)
    let subtotal = ocrFields.SubTotal_amount || ocrFields.SubTotal || 0;
    if (!subtotal && ocrFields.InvoiceTotal_amount && ocrFields.TotalTax_amount) {
        subtotal = ocrFields.InvoiceTotal_amount - ocrFields.TotalTax_amount;
        console.log(`📊 Calculated SubTotal: ${ocrFields.InvoiceTotal_amount} - ${ocrFields.TotalTax_amount} = ${subtotal}`);
    }

    const pricePerVehicle = vehicles.length > 0 ? subtotal / vehicles.length : subtotal;

    vehicles.forEach(vehicleNum => {
        const mapping = vehicleRules.vehicle_account_mapping?.[vehicleNum];

        // Build PDES from real product descriptions (not "עבודה")
        let pdesWithVehicle = vehicleNum;

        // Get product descriptions from Items, excluding generic work descriptions
        if (ocrItems && ocrItems.length > 0) {
            const productDescriptions = [];
            const excludeTerms = ['עבודה', 'work', 'labor'];

            // Sort by amount (highest first) and take meaningful descriptions
            const sortedItems = [...ocrItems].sort((a, b) => {
                const amountA = parseFloat(a.Amount_amount || a.Amount || 0);
                const amountB = parseFloat(b.Amount_amount || b.Amount || 0);
                return amountB - amountA;
            });

            for (const item of sortedItems) {
                const desc = item.Description_content || item.Description || '';
                const isGeneric = excludeTerms.some(term => desc.trim() === term);

                if (desc && !isGeneric && productDescriptions.length < 3) {
                    productDescriptions.push(desc.trim());
                }
            }

            if (productDescriptions.length > 0) {
                pdesWithVehicle = productDescriptions.join('+ ');
                console.log(`🚗 רכב ${vehicleNum}: PDES = "${pdesWithVehicle}"`);
            }
        }

        let actualMapping = mapping;
        if (Array.isArray(mapping) && mapping.length > 0) {
            console.log(`🚗 רכב ${vehicleNum}: ${mapping.length} bundles, לוקח ראשון`);
            actualMapping = mapping[0];
        }

        const item = {
            PARTNAME: vehicleRules.output_format?.partname || "car",
            PDES: pdesWithVehicle,
            TQUANT: 1,
            TUNITNAME: "יח'",
            PRICE: pricePerVehicle,
            VATFLAG: actualMapping?.vat_pattern?.VATFLAG || "Y",
            ACCNAME: actualMapping?.accname || ""
        };

        if (actualMapping?.budcode) {
            item.BUDCODE = actualMapping.budcode;
        } else if (vehicleRules.default_values?.budcode) {
            item.BUDCODE = vehicleRules.default_values.budcode;
        }
        if (actualMapping?.vat_pattern?.SPECIALVATFLAG === "Y") {
            item.SPECIALVATFLAG = "Y";
        }
        if (!actualMapping) {
            item._learningNote = "רכב חדש - נדרש מיפוי";
            console.log(`⚠️ רכב ${vehicleNum} לא במיפוי - ACCNAME ריק`);
        }
        vehicleItems.push(item);
    });
    console.log(`נוצרו ${vehicleItems.length} פריטי רכב`);
    return vehicleItems;
}

function performValidation(invoice, ocrFields, config, docsList, patterns, structure, searchResults, template) {
    const warnings = [];
    const checks = {
        required_fields_check: "passed",
        invoice_structure_check: "passed",
        amount_validation: "not_checked"
    };

    // Build field mapping - shows source and value for each field
    const fieldMapping = {
        SUPNAME: { source: "Template", field: "supplier_code", value: invoice.SUPNAME },
        CODE: { source: "Template", value: invoice.CODE },
        DEBIT: { source: structure.debit_type === "C" ? "Calculated (Credit)" : "Template", value: invoice.DEBIT },
        IVDATE: { source: "OCR", field: "InvoiceDate", value: invoice.IVDATE, ocr_value: ocrFields.InvoiceDate },
        BOOKNUM: { source: "OCR", field: "InvoiceId", value: invoice.BOOKNUM, ocr_value: ocrFields.InvoiceId },
        DETAILS: {
            source: invoice.PINVOICEITEMS_SUBFORM && invoice.PINVOICEITEMS_SUBFORM.length > 0
                ? "First Item PDES"
                : (searchResults.details ? "OCR" : "Template"),
            value: invoice.DETAILS
        }
    };

    if (structure.has_doc && searchResults.documents && searchResults.documents.length > 0) {
        fieldMapping.DOCNO = { source: "Documents Search", value: invoice.DOCNO, count: searchResults.documents.length };
    }

    if (structure.has_vehicles && searchResults.vehicles && searchResults.vehicles.length > 0) {
        fieldMapping.PINVOICEITEMS_SUBFORM = {
            source: "Vehicle Items",
            vehicle_numbers: searchResults.vehicles,
            count: searchResults.vehicles.length,
            items: invoice.PINVOICEITEMS_SUBFORM?.map(item => ({
                PDES: item.PDES,
                ACCNAME: item.ACCNAME,
                PRICE: item.PRICE
            }))
        };
    } else if (invoice.PINVOICEITEMS_SUBFORM && invoice.PINVOICEITEMS_SUBFORM.length > 0) {
        fieldMapping.PINVOICEITEMS_SUBFORM = {
            source: "OCR Items",
            count: invoice.PINVOICEITEMS_SUBFORM.length
        };
    }

    checks.field_mapping = fieldMapping;
    const requiredFields = ["SUPNAME", "CODE", "DEBIT", "IVDATE", "BOOKNUM"];
    const missingFields = requiredFields.filter(f => !invoice[f]);
    if (missingFields.length > 0) {
        warnings.push(`שדות חובה חסרים: ${missingFields.join(', ')}`);
        checks.required_fields_check = "failed";
    }
    if (invoice.PINVOICEITEMS_SUBFORM && invoice.PINVOICEITEMS_SUBFORM.length > 0) {
        const calculatedTotal = invoice.PINVOICEITEMS_SUBFORM.reduce((sum, item) => {
            return sum + (item.TQUANT || 0) * (item.PRICE || 0);
        }, 0);
        let ocrSubtotal = ocrFields.SubTotal || ocrFields.SubTotal_amount || 0;
        if (!ocrSubtotal &&
            (ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount) &&
            (ocrFields.TotalTax || ocrFields.TotalTax_amount)) {
            const invoiceTotal = ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount;
            const totalTax = ocrFields.TotalTax || ocrFields.TotalTax_amount;
            ocrSubtotal = invoiceTotal - totalTax;
        }
        if (calculatedTotal > 0 && ocrSubtotal > 0) {
            const difference = Math.abs(calculatedTotal - ocrSubtotal);
            const percentDiff = (difference / ocrSubtotal) * 100;
            if (percentDiff > 5) {
                warnings.push(`⚠️ הפרש סכומים: ${calculatedTotal.toFixed(2)} vs ${ocrSubtotal.toFixed(2)} (${percentDiff.toFixed(1)}%)`);
                checks.amount_validation = "warning";
            } else {
                warnings.push(`✅ סכום תקין: ${calculatedTotal.toFixed(2)} ש"ח (${percentDiff.toFixed(1)}% הפרש)`);
                checks.amount_validation = "passed";
            }
        } else {
            warnings.push(`ℹ️ לא ניתן לבדוק סכומים`);
            checks.amount_validation = "not_applicable";
        }
    } else {
        const itemsInOCR = ocrFields.Items ? ocrFields.Items.length : 0;
        if (itemsInOCR > 0) {
            warnings.push(`ℹ️ OCR זיהה ${itemsInOCR} פריטים אבל לא נוצרו`);
            checks.amount_validation = "no_items";
        }
    }
    return {
        all_valid: warnings.length === 0 || warnings.every(w => w.startsWith('✅') || w.startsWith('ℹ️')),
        checks: checks,
        warnings: warnings
    };
}

function analyzeLearning(invoice, config) {
    const newPatterns = {
        new_partnames: [],
        new_vehicles: [],
        unknown_accounts: []
    };
    const instructions = [];
    if (invoice.PINVOICEITEMS_SUBFORM) {
        invoice.PINVOICEITEMS_SUBFORM.forEach(item => {
            if (item._learningNote) {
                const vehicleMatch = item.PDES.match(/\d{3}-\d{2}-\d{3}/);
                if (vehicleMatch) {
                    const vehiclePattern = {
                        vehicle_number: vehicleMatch[0],
                        suggested_accname: item.ACCNAME || "",
                        suggested_vatflag: item.VATFLAG || "Y"
                    };
                    if (item.BUDCODE !== undefined) {
                        vehiclePattern.suggested_budcode = item.BUDCODE;
                    }
                    newPatterns.new_vehicles.push(vehiclePattern);
                }
            }
        });
    }
    const learningRequired = newPatterns.new_vehicles.length > 0;
    return {
        learning_required: learningRequired,
        new_patterns: newPatterns,
        learning_instructions: instructions,
        recommendation: learningRequired ? "שלח לקוד 3 ללמידה" : "אין צורך בלמידה"
    };
}

// Main execution - Make.com runs this automatically
result = { status: "error", message: "No input provided" };

if (typeof input !== 'undefined') {
    console.log("v1.7.1: input type =", typeof input, "isArray =", Array.isArray(input));
    // אם input הוא array, ניקח את הפריט הראשון
    let inputData = Array.isArray(input) ? input[0] : input;
    // אם inputData הוא array, ניקח את הפריט הראשון שלו
    if (Array.isArray(inputData)) {
        console.log("🔍 inputData is array, taking inputData[0]");
        inputData = inputData[0];
    }
    // אם inputData ריק או אין לו keys, ננסה input ישירות
    if (!inputData || (typeof inputData === 'object' && Object.keys(inputData).length === 0)) {
        console.log("🔍 inputData empty, using input directly");
        inputData = input;
    }
    console.log("🔍 inputData keys:", typeof inputData === 'object' ? Object.keys(inputData).slice(0, 10).join(', ') : 'not object');
    console.log("🔍 inputData.input exists?", !!inputData.input);
    console.log("🔍 inputData.AZURE exists?", !!inputData.AZURE);
    console.log("🔍 inputData.SUPNAME exists?", !!inputData.SUPNAME);
    // **תמיד** נקרא ל-processProductionInvoice - זה יעביר ל-processInvoiceComplete אם צריך
    if (inputData.AZURE || inputData.SUPNAME || (inputData.input && Array.isArray(inputData.input))) {
        console.log("✅ Calling processProductionInvoice");
        result = processProductionInvoice(inputData);
    } else {
        const processInput = {
            learned_config: input.learned_config || {},
            docs_list: input.docs_list || { DOC_YES_NO: "N", list_of_docs: [] },
            import_files: input.import_files || { IMPFILES: [] },
            vehicles: input.vehicles || "{}",
            AZURE_RESULT: input.AZURE_RESULT || { data: { fields: {} } },
            AZURE_TEXT_CLEAN: input.AZURE_TEXT_CLEAN || "",
            AZURE_TEXT: input.AZURE_TEXT || "",
            template_index: input.template_index  // ✅ חדש! העברת template_index
        };
        result = processInvoiceComplete({ input: [
            { name: "learned_config", value: processInput.learned_config },
            { name: "docs_list", value: processInput.docs_list },
            { name: "import_files", value: processInput.import_files },
            { name: "vehicles", value: processInput.vehicles },
            { name: "AZURE_RESULT", value: processInput.AZURE_RESULT },
            { name: "AZURE_TEXT_CLEAN", value: processInput.AZURE_TEXT_CLEAN },
            { name: "AZURE_TEXT", value: processInput.AZURE_TEXT },
            { name: "template_index", value: processInput.template_index }  // ✅ חדש!
        ]});
    }
    console.log(JSON.stringify(result, null, 2));
    console.log("v1.7.1: items =", result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM?.length || 0);
    console.log("v1.7.1: BOOKNUM =", result.invoice_data?.PINVOICES?.[0]?.BOOKNUM);
    console.log("v1.7.1: DOCNO =", result.invoice_data?.PINVOICES?.[0]?.DOCNO);
    console.log("==========================================");
}

})();  // End of IIFE

// ⚠️ CRITICAL: return מחוץ ל-IIFE - Make.com עוטף את הכל בפונקציה!
return result;

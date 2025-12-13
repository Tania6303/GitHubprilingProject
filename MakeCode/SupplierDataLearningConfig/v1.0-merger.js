// SupplierDataLearningConfig - גרסה 1.0
// תאריך: 13 דצמבר 2025
// מטרה: איחוד פלט SupplierDataLearning (Code 1) עם תוצאות Aggregator (Azure/Docs/Imfp)
// פלט: config אחד מאוחד לספק עם כל המידע לכל תבנית

// ============================================================================
// פונקציה ראשית - איחוד הנתונים
// ============================================================================

function mergeSupplierData(supplierConfig, aggregatedData) {
    // בדיקת תקינות קלטים
    if (!supplierConfig) {
        return {
            status: 'error',
            message: 'Missing supplier_config input'
        };
    }

    if (!aggregatedData || !aggregatedData.array) {
        return {
            status: 'error',
            message: 'Missing or invalid aggregated_data input (expected object with array property)'
        };
    }

    // חילוץ הנתונים
    const config = supplierConfig.result || supplierConfig;
    const aggregatedArray = aggregatedData.array || [];

    // בדיקה שיש templates
    if (!config.templates || !Array.isArray(config.templates)) {
        return {
            status: 'error',
            message: 'supplier_config does not contain templates array'
        };
    }

    // יצירת מפה של תוצאות Aggregator לפי template_index
    const aggregatedMap = new Map();
    aggregatedArray.forEach(item => {
        if (item.template_index !== undefined && item.template_index !== null) {
            // תמיכה גם במספר וגם במחרוזת
            const index = parseInt(item.template_index, 10);
            if (!isNaN(index)) {
                aggregatedMap.set(index, item);
            }
        }
    });

    // איחוד הנתונים - לכל template הוספת הנתונים מה-Aggregator
    const mergedTemplates = config.templates.map(template => {
        const templateIndex = template.template_index;
        const aggregatedItem = aggregatedMap.get(templateIndex);

        // העתקת התבנית המקורית
        const mergedTemplate = { ...template };

        if (aggregatedItem) {
            // נמצא נתונים מה-Aggregator - הוספה לתבנית
            mergedTemplate.docs = aggregatedItem.docs || null;
            mergedTemplate.imfp = aggregatedItem.imfp || null;
            mergedTemplate.azuretext = aggregatedItem.azuretext || null;
            mergedTemplate.AZURE_RESULT = aggregatedItem.AZURE_RESULT || null;
            mergedTemplate.scan_status = 'scanned';
        } else {
            // לא נמצא - התבנית לא נסרקה
            mergedTemplate.docs = null;
            mergedTemplate.imfp = null;
            mergedTemplate.azuretext = null;
            mergedTemplate.AZURE_RESULT = null;
            mergedTemplate.scan_status = 'not_scanned';
        }

        return mergedTemplate;
    });

    // סטטיסטיקות
    const scannedCount = mergedTemplates.filter(t => t.scan_status === 'scanned').length;
    const notScannedCount = mergedTemplates.filter(t => t.scan_status === 'not_scanned').length;

    // בניית הפלט המאוחד
    const mergedResult = {
        status: 'success',

        // === מידע ספק (מועתק מ-Code 1) ===
        supplier_id: config.supplier_id,
        supplier_name: config.supplier_name,
        vendor_tax_id_reference: config.vendor_tax_id_reference,
        supplier_phone: config.supplier_phone,
        supplier_email: config.supplier_email,

        // === סטטיסטיקות ===
        json_files_analyzed: config.json_files_analyzed,
        templates_detected: config.templates_detected,
        templates_scanned: scannedCount,
        templates_not_scanned: notScannedCount,

        // === הגדרות כלליות לספק ===
        supplier_config: config.supplier_config,
        rules: config.rules,
        validation: config.validation,
        critical_patterns: config.critical_patterns,

        // === מערך התבניות המאוחד ===
        templates: mergedTemplates,

        // === מטא-דאטה על האיחוד ===
        merge_metadata: {
            merge_timestamp: new Date().toISOString(),
            source_templates_count: config.templates.length,
            aggregated_items_count: aggregatedArray.length,
            matched_count: scannedCount,
            unmatched_template_indexes: mergedTemplates
                .filter(t => t.scan_status === 'not_scanned')
                .map(t => t.template_index)
        }
    };

    return mergedResult;
}

// ============================================================================
// קוד הרצה למייק
// ============================================================================

// קלט 1: פלט מ-SupplierDataLearning (Code 1 v1.4)
let supplierConfig;
try {
    let rawSupplierConfig = input.supplier_config;

    // טיפול ב-Buffer
    if (rawSupplierConfig && typeof rawSupplierConfig === 'object' &&
        rawSupplierConfig.type === 'Buffer' && Array.isArray(rawSupplierConfig.data)) {
        const uint8Array = new Uint8Array(rawSupplierConfig.data);
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(uint8Array);
        supplierConfig = JSON.parse(text);
    }
    // טיפול במחרוזת JSON
    else if (typeof rawSupplierConfig === 'string') {
        supplierConfig = JSON.parse(rawSupplierConfig);
    }
    // כבר אובייקט
    else {
        supplierConfig = rawSupplierConfig;
    }

    // אם זה מערך, לקחת את האיבר הראשון
    if (Array.isArray(supplierConfig)) {
        supplierConfig = supplierConfig[0];
    }

} catch (e) {
    return {
        status: 'error',
        message: 'Failed to parse supplier_config: ' + e.message,
        error_stack: e.stack
    };
}

// קלט 2: פלט מה-Aggregator
let aggregatedData;
try {
    let rawAggregatedData = input.aggregated_data;

    // טיפול ב-Buffer
    if (rawAggregatedData && typeof rawAggregatedData === 'object' &&
        rawAggregatedData.type === 'Buffer' && Array.isArray(rawAggregatedData.data)) {
        const uint8Array = new Uint8Array(rawAggregatedData.data);
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(uint8Array);
        aggregatedData = JSON.parse(text);
    }
    // טיפול במחרוזת JSON
    else if (typeof rawAggregatedData === 'string') {
        aggregatedData = JSON.parse(rawAggregatedData);
    }
    // כבר אובייקט
    else {
        aggregatedData = rawAggregatedData;
    }

    // אם זה מערך, לקחת את האיבר הראשון (Aggregator מחזיר [{array: [...]}])
    if (Array.isArray(aggregatedData)) {
        aggregatedData = aggregatedData[0];
    }

} catch (e) {
    return {
        status: 'error',
        message: 'Failed to parse aggregated_data: ' + e.message,
        error_stack: e.stack
    };
}

// הרצת האיחוד
const result = mergeSupplierData(supplierConfig, aggregatedData);

return result;

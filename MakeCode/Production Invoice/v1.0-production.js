// ============================================================================
// קוד Production Invoice - עיבוד חשבוניות (גרסה 1.5 - 05.11.25.23:00)
// מקבל: מבנה חדש עם AZURE, CARS, SUPNAME + AZURE_TEXT_CLEAN
// מחזיר: JavaScript object + פריטים מ-OCR + תיקוף סכומים
//
// 📁 קבצי בדיקה: MakeCode/Production Invoice/EXEMPTS/
// לקיחת הקובץ העדכני: ls -lt "MakeCode/Production Invoice/EXEMPTS" | head -5
//
// ✨ גרסה 1.5 v23:00 - חיפוש רכבים מטקסט נקי + ACCNAME ריק:
// - 🚗 חיפוש רכבים ב-AZURE_TEXT_CLEAN אם OCR לא זיהה
// - 🔍 בדיקת הקשר (רכב/רישוי vs כרטיס/ח.פ) למניעת false positives
// - 🚨 ACCNAME ריק אם רכב לא נמצא ב-CARS (לא default 66979)
// - ⚠️ אזהרה בקונסול אם רכב נמצא אבל לא במיפוי
// - 📊 תיקון בדיקת סכומים: השוואה מול SubTotal (לפני מע"מ)
//
// ✨ גרסה 1.4 v21:30 - דוחות משופרים + בדיקת סכומים:
// - 📊 execution_report.found מציג ערכים בפועל (לא "נמצא")
// - ✅ validation.warnings מציג בדיקת סכומים: חישוב vs OCR
// - ⚠️ אזהרה אם הפרש >5% בין סכום מחושב לסכום OCR
// - ℹ️ מידע על כמות פריטים ב-OCR שלא נוצרו
//
// ✨ גרסה 1.3 v20:00 - הוספת מספר רכב ל-PDES + תמיכה ב-2 bundles:
// - 🚗 PDES כולל מספר רכב: "419-29-702 עבודות רכב"
// - תמיכה במקרה של 2 bundles לרכב (ליסינג + אחזקה) - לוקח bundle ראשון
// - לוג: "רכב XXX: נמצאו 2 bundles, לוקח bundle ראשון"
//
// ✨ גרסה 1.2 v19:30 - תמיכה ב-Azure OCR ישירות:
// - תמיכה ב-AZURE_RESULT ישירות מ-Azure OCR (בלי analyzeResult wrapper)
// - זיהוי אוטומטי: apiVersion + documents = Azure v3.0 ישירות
// - לוגים מפורטים: "Converting direct Azure v3.0 format"
//
// ✨ גרסה 1.1 v18:50 - תמיכה בטקסט מנורמל:
// - תמיכה ב-AZURE_TEXT_CLEAN (טקסט אחרי Text Standardization)
// - עדיפות לטקסט נקי על פני גולמי לחיפושים ו-regex
// - backward compatible - עובד עם/בלי AZURE_TEXT_CLEAN
// - לוג DEBUG מציין מקור הטקסט (CLEAN/RAW)
//
// ✨ גרסה 1.0 v16:30 - תיקונים קריטיים:
// - יצירת פריטים מ-OCR Items (לא רק רכבים!)
// - תיקוף סכום כולל מול OCR (אזהרה אם הפרש >5%)
// - תמיכה ב-AZURE כ-JSON string (parse אוטומטי)
// - תמיכה ב-CARS (מיפוי רכבים מוכן)
// - טיפול בשדות חסרים (learned_config, docs_list, import_files)
// - שימוש ב-SUPNAME ו-SUP_TEMP
// ============================================================================

// ============================================================================
// פונקציית עזר - הסרת undefined values רקורסיבית
// ============================================================================

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

// ============================================================================
// פונקציית עזר - ניקוי invoice לפני שליחה ל-Priority
// ============================================================================

function cleanInvoiceForPriority(invoice) {
    const cleaned = JSON.parse(JSON.stringify(invoice));

    // וודא ש-PINVOICESCONT_SUBFORM תמיד קיים
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

            // הסר שדות undefined - Make.com לא מקבל undefined values
            if (item.BUDCODE === undefined) {
                delete item.BUDCODE;
            }
            if (item.SPECIALVATFLAG === undefined) {
                delete item.SPECIALVATFLAG;
            }
            if (item.TUNITNAME === undefined) {
                delete item.TUNITNAME;
            }

            return item;
        });
    }

    return cleaned;
}

// ============================================================================
// פונקציה - נרמול שדות Azure v3.0 לפורמט פשוט
// ============================================================================

function normalizeAzureFields(rawFields) {
    // בדיקת בטיחות - אם rawFields הוא null או undefined
    if (!rawFields || typeof rawFields !== 'object') {
        return {};
    }

    const normalized = {};

    for (const [key, field] of Object.entries(rawFields)) {
        if (!field || typeof field !== 'object') {
            normalized[key] = field;
            continue;
        }

        // חילוץ הערך לפי הסוג
        if (field.valueString !== undefined) {
            normalized[key] = field.valueString;
        } else if (field.valueDate !== undefined) {
            normalized[key] = field.valueDate;
        } else if (field.valueNumber !== undefined) {
            normalized[key] = field.valueNumber;
        } else if (field.valueCurrency !== undefined && field.valueCurrency !== null) {
            normalized[key] = (field.valueCurrency && field.valueCurrency.amount) || 0;
            // שמירה גם של הסכום עם קוד מטבע כשדה נפרד
            if (key.includes('Total') || key.includes('Amount')) {
                normalized[key + '_amount'] = (field.valueCurrency && field.valueCurrency.amount) || 0;
                normalized[key + '_currency'] = (field.valueCurrency && field.valueCurrency.currencyCode) || '';
            }
        } else if (field.valueArray !== undefined && Array.isArray(field.valueArray)) {
            // עיבוד מערכים (Items, UnidentifiedNumbers וכו')
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
            // fallback ל-content
            normalized[key] = field.content;
        } else {
            // fallback לשדה המקורי
            normalized[key] = field;
        }
    }

    return normalized;
}

// ============================================================================
// פונקציה - המרת מבנה חדש למבנה ישן (wrapper)
// ============================================================================

function convertProductionInputToProcessingInput(productionInput) {
    // אם זה כבר במבנה הישן, החזר כמו שזה
    if (productionInput.input && Array.isArray(productionInput.input)) {
        return productionInput;
    }

    // parse את AZURE אם זה string
    let azureData;
    if (!productionInput.AZURE) {
        // אם AZURE חסר לגמרי
        azureData = {};
    } else if (typeof productionInput.AZURE === 'string') {
        try {
            azureData = JSON.parse(productionInput.AZURE);
        } catch (e) {
            console.error('Error parsing AZURE JSON:', e.message);
            azureData = {};
        }
    } else {
        azureData = productionInput.AZURE || {};
    }

    // בניית learned_config מתוך CARS ו-SUP_TEMP
    const learnedConfig = buildLearnedConfigFromProduction(
        productionInput.SUPNAME,
        productionInput.CARS,
        productionInput.SUP_TEMP
    );

    // חילוץ documents מתוך analyzeResult
    let documents = [];
    let fields = {};
    let content = "";

    if (azureData.analyzeResult) {
        content = azureData.analyzeResult.content || "";
        if (azureData.analyzeResult.documents && azureData.analyzeResult.documents.length > 0) {
            documents = azureData.analyzeResult.documents;
            const rawFields = documents[0].fields || {};

            // המרת שדות Azure v3.0 לפורמט פשוט
            fields = normalizeAzureFields(rawFields);

            // שמירת content גם כחלק מ-fields כדי שניתן יהיה לחפש בו
            fields._rawContent = content;
        }
    } else if (azureData.fields) {
        // מבנה ישן
        fields = azureData.fields;
        content = azureData.content || "";
        fields._rawContent = content;
    }

    // בניית מבנה ישן
    return {
        input: [
            {
                name: "learned_config",
                value: learnedConfig
            },
            {
                name: "docs_list",
                value: {
                    DOC_YES_NO: "N",
                    list_of_docs: []
                }
            },
            {
                name: "import_files",
                value: {
                    IMPFILES: []
                }
            },
            {
                name: "AZURE_RESULT",
                value: {
                    data: {
                        fields: fields,
                        documents: documents
                    }
                }
            },
            {
                name: "AZURE_TEXT_CLEAN",
                value: productionInput.AZURE_TEXT_CLEAN || ""
            },
            {
                name: "AZURE_TEXT",
                value: content
            }
        ]
    };
}

// ============================================================================
// פונקציה - בניית learned_config מתוך נתוני Production
// ============================================================================

function buildLearnedConfigFromProduction(supname, cars, supTemp) {
    // מיפוי רכבים מתוך CARS
    const vehicleMapping = {};

    // parse CARS אם זה string
    let carsArray = [];
    if (typeof cars === 'string') {
        try {
            carsArray = JSON.parse(cars);
        } catch (e) {
            console.error('Error parsing CARS JSON:', e.message);
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
                    vat_pattern: {
                        VATFLAG: "Y",
                        SPECIALVATFLAG: "varies"
                    },
                    date_range_pattern: "never",
                    pdaccname_pattern: "never"
                };
            }
        });
    }

    // parse SUP_TEMP אם קיים
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

    // parse TEMPLETE (שגיאת כתיב מכוונת - זה השם בפועל)
    let parsedConfig = null;
    let templateData = null;  // ✨ שמירת templateData המקורי!
    if (supplierTemplate && supplierTemplate.TEMPLETE) {
        try {
            const templateStr = typeof supplierTemplate.TEMPLETE === 'string'
                ? supplierTemplate.TEMPLETE
                : JSON.stringify(supplierTemplate.TEMPLETE);
            templateData = JSON.parse(templateStr);  // ✨ שמירה למשתנה חיצוני

            // ✨ חלץ את כל ה-PINVOICES ואת ה-technical_config
            // ✨ תיקון: invoice_data עבר לתוך llm_prompt.all_templates
            if (templateData.llm_prompt && templateData.llm_prompt.all_templates) {
                // חלץ את כל ה-PINVOICES מכל התבניות
                const allPinvoices = templateData.llm_prompt.all_templates.map(template => {
                    return template.invoice_data?.PINVOICES?.[0] || {};
                });

                parsedTemplate = {
                    PINVOICES: allPinvoices,
                    document_types_count: allPinvoices.length
                };
            }

            // חלץ גם את ה-technical_config אם קיים
            // ✨ תיקון: technical_config.all_templates
            if (templateData.technical_config && templateData.technical_config.all_templates) {
                // קח את הקונפיג הראשון (או מרג'ת כולם - תלוי בלוגיקה)
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
            templateData = null;  // ✨ נקה גם את templateData במקרה של שגיאה
        }
    }

    // בניית config - ✨ תמיכה במספר תבניות!
    const templatesCount = parsedTemplate?.PINVOICES?.length || 1;

    const config = {
        status: "success",
        supplier_id: supname || "",
        supplier_name: supplierTemplate?.SDES || parsedConfig?.supplier_config?.supplier_name || "",
        vendor_tax_id_reference: supplierTemplate?.VATNUM || parsedConfig?.supplier_config?.vendor_tax_id_reference || "",
        supplier_phone: supplierTemplate?.supplier_phone || "",
        supplier_email: supplierTemplate?.supplier_email || "",
        json_files_analyzed: 1,
        templates_detected: templatesCount,  // ✨ מספר התבניות שנמצאו
        // ✨ שמירת המבנה המקורי מ-Processing Invoice!
        llm_prompt: templateData?.llm_prompt || null,
        technical_config: templateData?.technical_config || null,
        config: parsedConfig || {
            supplier_config: {
                supplier_code: supname || "",
                supplier_name: supplierTemplate?.SDES || "",
                vendor_tax_id_reference: supplierTemplate?.VATNUM || ""
            },
            structure: [
                {
                    has_import: false,
                    has_purchase_orders: false,
                    has_doc: false,
                    has_date_range: false,
                    has_budcode: true,
                    has_pdaccname: false,
                    inventory_management: "not_managed_inventory",
                    debit_type: "D"
                }
            ],
            rules: {
                invoice_date_format: "DD/MM/YY",
                doc_variation: "",
                validation_data: {
                    TOTQUANT: 1
                },
                critical_patterns: {
                    vehicle_rules: {
                        partname: "car",
                        vehicle_account_mapping: vehicleMapping,
                        default_values: {
                            accname: Object.values(vehicleMapping)[0]?.accname || "",
                            budcode: Object.values(vehicleMapping)[0]?.budcode || ""
                        },
                        output_format: {
                            partname: "car"
                        }
                    },
                    partname_rules: {}
                }
            },
            document_types: [
                {
                    type: "חשבונית רגילה עם פירוט",
                    accnames: Object.values(vehicleMapping).map(v => v.accname).filter((v, i, a) => a.indexOf(v) === i)
                }
            ]
        },
        template: parsedTemplate || supplierTemplate?.template || {
            PINVOICES: [
                {
                    SUPNAME: supname || "",
                    CODE: "ש\"ח",
                    DEBIT: "D",
                    IVDATE: "",
                    BOOKNUM: "",
                    DETAILS: "",
                    PINVOICEITEMS_SUBFORM: [],
                    PINVOICESCONT_SUBFORM: []
                }
            ],
            document_types_count: 1
        },
        recommended_samples: {
            samples: []
        }
    };

    return config;
}

// ============================================================================
// פונקציה ראשית - עיבוד חשבונית Production
// ============================================================================

function processProductionInvoice(productionInput) {
    const executionReport = {
        stage: "",
        found: [],
        not_found: [],
        warnings: [],
        errors: []
    };

    try {
        executionReport.stage = "המרת מבנה Production ל-Processing";

        // המרה למבנה הישן
        const processingInput = convertProductionInputToProcessingInput(productionInput);

        // שימוש בפונקציה הקיימת
        executionReport.stage = "קריאה לפונקציית עיבוד";
        const result = processInvoiceComplete(processingInput);

        // הוספת מידע על המקור
        if (result.status === "success") {
            result.metadata = result.metadata || {};
            result.metadata.input_type = "production";
            result.metadata.filename = productionInput.FILENAME || "";
            result.metadata.cars_count = (productionInput.CARS || []).length;
        }

        // הסר כל ערכי undefined מהתוצאה
        return removeUndefinedValues(result);

    } catch (error) {
        executionReport.errors.push(error.message);

        const errorResult = {
            status: "error",
            error_type: error.name || "ProductionProcessingError",
            message: error.message,
            execution_report: executionReport
        };

        // הסר כל ערכי undefined גם בשגיאות
        return removeUndefinedValues(errorResult);
    }
}

// ============================================================================
// הכללה של כל הפונקציות מהקוד המקורי (v4.1-1147lines.js)
// ============================================================================

function processInvoiceComplete(input) {
    const executionReport = {
        stage: "",
        found: [],
        not_found: [],
        warnings: [],
        errors: []
    };

    try {
        // DEBUG: לוג את מה שמגיע
        console.log("DEBUG: input structure:", JSON.stringify(input).substring(0, 200));

        // חילוץ נתונים מהמבנה
        const inputData = {};
        if (input.input && Array.isArray(input.input)) {
            input.input.forEach(item => {
                inputData[item.name] = item.value;
            });
        }

        console.log("DEBUG: inputData keys:", Object.keys(inputData));

        // בדיקה: האם learned_config הוא SUP_TEMP (יש TEMPLETE)?
        let learnedConfig = inputData.learned_config || {};
        if (typeof learnedConfig === 'string') {
            try {
                learnedConfig = JSON.parse(learnedConfig);
            } catch (e) {
                console.log("DEBUG: Failed to parse learned_config");
                learnedConfig = {};
            }
        }

        // אם יש TEMPLETE - זה SUP_TEMP, לא learned_config מלא
        if (learnedConfig.TEMPLETE && learnedConfig.SUPNAME) {
            console.log("DEBUG: learned_config is SUP_TEMP, converting...");
            // parse TEMPLETE
            try {
                const templateStr = typeof learnedConfig.TEMPLETE === 'string'
                    ? learnedConfig.TEMPLETE
                    : JSON.stringify(learnedConfig.TEMPLETE);
                const templateData = JSON.parse(templateStr);

                console.log("DEBUG: TEMPLETE parsed, has technical_config?", !!templateData.technical_config);

                // ✨ תיקון: חלץ מהמבנה החדש
                let parsedConfig = {};
                let parsedTemplate = { PINVOICES: [{}] };

                // חלץ technical_config
                if (templateData.technical_config && templateData.technical_config.all_templates) {
                    parsedConfig = {
                        ...templateData.technical_config.all_templates[0],
                        supplier_config: {
                            supplier_code: templateData.technical_config.supplier_code,
                            supplier_name: templateData.technical_config.supplier_name
                        }
                    };
                }

                // חלץ invoice_data מכל התבניות
                if (templateData.llm_prompt && templateData.llm_prompt.all_templates) {
                    const allPinvoices = templateData.llm_prompt.all_templates.map(template => {
                        return template.invoice_data?.PINVOICES?.[0] || {};
                    });
                    parsedTemplate = {
                        PINVOICES: allPinvoices,
                        document_types_count: allPinvoices.length
                    };
                }

                // בניית learned_config
                learnedConfig = {
                    status: "success",
                    supplier_id: learnedConfig.SUPNAME,
                    supplier_name: learnedConfig.SDES || "",
                    vendor_tax_id_reference: learnedConfig.VATNUM || "",
                    config: parsedConfig,
                    template: parsedTemplate
                };
            } catch (e) {
                console.log("DEBUG: Failed to parse TEMPLETE:", e.message);
            }
        }

        // Parse docs_list אם זה string
        let docsList = inputData.docs_list || { DOC_YES_NO: "N", list_of_docs: [] };
        if (typeof docsList === 'string') {
            try {
                docsList = JSON.parse(docsList);
            } catch (e) {
                docsList = { DOC_YES_NO: "N", list_of_docs: [] };
            }
        }

        // Parse import_files אם זה string
        let importFiles = inputData.import_files || { IMPFILES: [] };
        if (typeof importFiles === 'string') {
            try {
                importFiles = JSON.parse(importFiles);
            } catch (e) {
                importFiles = { IMPFILES: [] };
            }
        }

        // Parse AZURE_RESULT אם זה string - זו הבעיה המרכזית!
        let azureResult = inputData.AZURE_RESULT || { data: { fields: {} } };
        if (typeof azureResult === 'string') {
            console.log("DEBUG: AZURE_RESULT is string, parsing...");
            try {
                azureResult = JSON.parse(azureResult);
            } catch (e) {
                console.log("DEBUG: Failed to parse AZURE_RESULT");
                azureResult = { data: { fields: {} } };
            }
        }

        // ✨ חדש: תמיכה בטקסט מנורמל (AZURE_TEXT_CLEAN)
        // אם יש טקסט נקי מ-Text Standardization - השתמש בו
        // אחרת - השתמש בטקסט הגולמי
        const azureTextClean = inputData.AZURE_TEXT_CLEAN || "";
        const azureTextRaw = inputData.AZURE_TEXT || "";
        const azureText = azureTextClean || azureTextRaw;

        console.log("DEBUG: azureText source:", azureTextClean ? "CLEAN" : "RAW", "length:", azureText.length);
        console.log("DEBUG: azureResult type:", typeof azureResult, "has data?", !!azureResult.data);

        // וידוא שיש data.fields - תמיכה ב-Azure v3.0 format (analyzeResult)
        if (!azureResult.data) {
            // בדוק אם יש analyzeResult (Azure v3.0 wrapped)
            if (azureResult.analyzeResult) {
                console.log("DEBUG: Converting wrapped analyzeResult to data.fields format");
                const analyzeResult = azureResult.analyzeResult;
                const documents = analyzeResult.documents || [];

                if (documents.length > 0) {
                    // המר שדות Azure v3.0 לפורמט פשוט
                    const rawFields = documents[0].fields || {};
                    const normalizedFields = normalizeAzureFields(rawFields);

                    azureResult.data = {
                        fields: normalizedFields,
                        documents: documents
                    };
                } else {
                    // אם אין documents, צור data ריק
                    console.log("DEBUG: No documents in analyzeResult, creating empty data");
                    azureResult.data = { fields: {}, documents: [] };
                }
            } else if (azureResult.apiVersion && azureResult.documents) {
                // Azure v3.0 ישירות (בלי wrapper של analyzeResult)
                console.log("DEBUG: Converting direct Azure v3.0 format to data.fields");
                const documents = azureResult.documents || [];

                if (documents.length > 0) {
                    // המר שדות Azure v3.0 לפורמט פשוט
                    const rawFields = documents[0].fields || {};
                    const normalizedFields = normalizeAzureFields(rawFields);

                    azureResult.data = {
                        fields: normalizedFields,
                        documents: documents
                    };
                    console.log("DEBUG: Converted direct Azure format, fields count:", Object.keys(normalizedFields).length);
                } else {
                    // אם אין documents, צור data ריק
                    console.log("DEBUG: No documents in direct Azure format, creating empty data");
                    azureResult.data = { fields: {}, documents: [] };
                }
            } else {
                console.log("DEBUG: Unknown format - creating empty azureResult.data");
                azureResult.data = { fields: {}, documents: [] };
            }
        }
        if (!azureResult.data.fields) {
            console.log("DEBUG: Creating azureResult.data.fields");
            azureResult.data.fields = {};
        }

        console.log("DEBUG: azureResult.data.fields type:", typeof azureResult.data.fields);

        executionReport.stage = "שלב 1: זיהוי סוג ותבנית";

        const hasImport = checkImportExists(importFiles);
        const hasDocs = checkDocsInOCR(azureResult.data.fields, azureText);
        const debitType = identifyDebitType(azureResult.data.fields);

        executionReport.found.push(`סוג: יבוא=${hasImport}, תעודות=${hasDocs}, חיוב/זיכוי=${debitType}`);

        // תמיכה בשני מבנים: config/template או technical_config/invoice_data
        const config = learnedConfig.config || learnedConfig.technical_config || {};

        // קריאת כל המבנים והתבניות
        const allStructures = config.structure || [{
            has_import: false,
            has_doc: false,
            debit_type: "D",
            has_budcode: true,
            inventory_management: "not_managed_inventory"
        }];

        // תמיכה במבנים שונים של template
        let allTemplates;
        if (learnedConfig.template?.PINVOICES) {
            // מבנה ישן - template.PINVOICES
            allTemplates = learnedConfig.template.PINVOICES;
        } else if (learnedConfig.llm_prompt?.all_templates) {
            // ✨ מבנה חדש v4.2 - llm_prompt.all_templates[].invoice_data.PINVOICES[0]
            allTemplates = learnedConfig.llm_prompt.all_templates.map(t =>
                t.invoice_data?.PINVOICES?.[0] || {}
            );
        } else if (learnedConfig.invoice_data?.PINVOICES) {
            // מבנה ביניים - invoice_data.PINVOICES
            allTemplates = learnedConfig.invoice_data.PINVOICES;
        } else {
            // fallback - תבנית ריקה
            allTemplates = [{
                SUPNAME: config.supplier_config?.supplier_code || "",
                CODE: "ש\"ח",
                DEBIT: "D"
            }];
        }

        // ✨ תיקון! מציאת התבנית המתאימה במקום עיבוד כל התבניות
        const templateIndex = findMatchingTemplate(allStructures, hasImport, hasDocs, debitType);

        if (templateIndex === -1) {
            executionReport.errors.push("לא נמצאה תבנית מתאימה!");
            throw new Error("לא נמצאה תבנית מתאימה");
        }

        const structure = allStructures[templateIndex];
        const template = allTemplates[templateIndex] || allTemplates[0];

        executionReport.found.push(`תבנית: נמצאה התאמה (index=${templateIndex})`);

        executionReport.stage = "שלב 2: הבנת דפוסים";

        const patterns = extractPatterns(learnedConfig.recommended_samples, docsList);
        executionReport.found.push(`דפוסים: נמצאו`);

        const vehicleRules = config.rules?.critical_patterns?.vehicle_rules || null;
        if (vehicleRules && vehicleRules.vehicle_account_mapping) {
            executionReport.found.push(`חוקי רכבים: פעילים (${Object.keys(vehicleRules.vehicle_account_mapping).length} רכבים)`);
        }

        executionReport.stage = "שלב 3: חיפוש נתונים";

        const ocrFields = azureResult.data.fields || {};

        // חיפוש נתונים לפי התבנית שנבחרה
        const searchResults = searchAllData(
            ocrFields,
            azureText,
            patterns,
            structure,
            importFiles,
            docsList,
            vehicleRules
        );

        // הדפסת תוצאות החיפוש
        Object.keys(searchResults).forEach(key => {
            if (key === 'vehicles' && searchResults.vehicles) {
                if (searchResults.vehicles.length > 0) {
                    executionReport.found.push(`רכבים: ${searchResults.vehicles.length} רכבים - ${searchResults.vehicles.join(', ')}`);
                }
            } else if (searchResults[key]) {
                // הצג ערך בפועל במקום "נמצא"
                const value = searchResults[key];
                if (Array.isArray(value)) {
                    // אם זה array (כמו items)
                    executionReport.found.push(`${key}: ${value.length} פריטים`);
                } else if (typeof value === 'string' && value.length > 0) {
                    // אם זה string
                    const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
                    executionReport.found.push(`${key}: "${displayValue}"`);
                } else if (value !== null) {
                    // כל ערך אחר
                    executionReport.found.push(`${key}: ${JSON.stringify(value)}`);
                }
            }
        });

        executionReport.stage = "שלב 4: בניית חשבונית";

        // בניית חשבונית לתבנית שנבחרה
        const invoice = buildInvoiceFromTemplate(
            template,
            structure,
            config,
            searchResults,
            learnedConfig,
            ocrFields
        );

        executionReport.stage = "שלב 5: בקרות";

        // בקרות
        const validation = performValidation(invoice, ocrFields, config, docsList, patterns);

        executionReport.stage = "שלב 6: ניתוח למידה";

        // ניתוח למידה
        const learningAnalysis = analyzeLearning(invoice, config);

        executionReport.stage = "שלב 7: ניקוי והכנה לפריוריטי";

        // ניקוי
        const cleanedInvoice = cleanInvoiceForPriority(invoice);

        const result = {
            status: "success",
            supplier_identification: {
                // ✨ תמיכה במבנה חדש: חפש גם ב-llm_prompt ו-technical_config
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
                PINVOICES: [cleanedInvoice]  // ✨ תיקון! רק החשבונית התואמת
            },
            validation: validation,
            learning_analysis: learningAnalysis,
            execution_report: executionReport,
            metadata: {
                ocr_invoice_id: ocrFields.InvoiceId || "",
                ocr_invoice_date: ocrFields.InvoiceDate || "",
                ocr_total_amount: ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount || 0,
                processing_timestamp: new Date().toISOString(),
                version: "1.0-production",
                template_index: templateIndex,  // ✨ התבנית שנבחרה
                template_type: structure.has_import && structure.has_doc ? "import_with_docs" :
                              structure.has_import ? "import_only" :
                              structure.has_doc ? "docs_only" :
                              structure.debit_type === "C" ? "credit_note" : "regular"
            }
        };

        // הסר כל ערכי undefined מהתוצאה לפני החזרה
        return removeUndefinedValues(result);

    } catch (error) {
        executionReport.errors.push(error.message);

        const errorResult = {
            status: "error",
            error_type: error.name || "ProcessingError",
            message: error.message,
            execution_report: executionReport
        };

        // הסר כל ערכי undefined גם בשגיאות
        return removeUndefinedValues(errorResult);
    }
}

// ============================================================================
// פונקציות עזר מהקוד המקורי
// ============================================================================

function checkImportExists(importFiles) {
    if (!importFiles || !importFiles.IMPFILES) return false;
    if (importFiles.IMPFILES.length === 0) return false;
    return true;
}

function checkDocsInOCR(ocrFields, azureText) {
    const unidentified = ocrFields.UnidentifiedNumbers || [];
    const docPattern = /^25\d{6}$/;          // DOCNO pattern
    const booknumPattern = /^108\d{6}$/;     // BOOKNUM pattern

    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            // בדיקה של שני הדפוסים - DOCNO או BOOKNUM
            if (unidentified.some(item => docPattern.test(item.value) || booknumPattern.test(item.value))) {
                return true;
            }
        } else {
            // בדיקה של שני הדפוסים - DOCNO או BOOKNUM
            if (unidentified.some(num => docPattern.test(num) || booknumPattern.test(num))) {
                return true;
            }
        }
    }

    // בדיקה גם ב-AZURE_TEXT - שני הדפוסים עם word boundaries
    if (azureText) {
        if (azureText.match(/\b25\d{6}\b/g) || azureText.match(/\b108\d{6}\b/g)) {
            return true;
        }
    }

    return false;
}

function identifyDebitType(ocrFields) {
    const total = ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount || 0;
    return total >= 0 ? "D" : "C";
}

// ✨ חדש! מציאת תבנית מתאימה לפי מאפייני החשבונית
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
    return {
        booknum: searchBooknum(ocrFields, patterns),
        ivdate: searchIvdate(ocrFields),
        details: searchDetails(ocrFields, azureText),
        ordname: null,
        impfnum: null,
        documents: null,
        vehicles: vehicleRules ? extractVehiclesAdvanced(ocrFields, vehicleRules) : [],
        items: ocrFields.Items || []
    };
}

function searchBooknum(ocrFields, patterns) {
    const original = ocrFields.InvoiceId || "";
    let booknum = String(original);

    // שלב 1: הסר prefix כמו "SI"
    booknum = booknum.replace(/^SI/i, '');

    // שלב 2: הסר suffix לא-מספרי (כמו " Ns", " ns", וכו')
    // חלץ את המספרים מהתחילה, אפשר מספרים וסימנים מיוחדים
    const match = booknum.match(/^[\d\-\/]+/);
    if (match) {
        booknum = match[0];
    }

    // שלב 3: trim רווחים
    booknum = booknum.trim();

    if (patterns.booknum_pattern) {
        const expectedLength = patterns.booknum_pattern.length;
        if (booknum.length > expectedLength) {
            booknum = booknum.slice(-expectedLength);
        }
    }

    console.log(`DEBUG-BOOKNUM: "${original}" → "${booknum}"`);
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

function extractVehiclesAdvanced(ocrFields, vehicleRules) {
    if (!vehicleRules || !vehicleRules.vehicle_account_mapping) return [];

    const foundVehicles = [];
    const vehiclePattern = /\d{3}-\d{2}-\d{3}/g;
    const searchLocations = vehicleRules.search_locations || [
        {
            location: "fields.UnidentifiedNumbers",
            priority: 1,
            filter_by_label: "רכב"
        }
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

    // 🚗 אם לא נמצאו רכבים - חפש בטקסט הגולמי (AZURE_TEXT_CLEAN או content)
    if (foundVehicles.length === 0) {
        // קודם נסה AZURE_TEXT_CLEAN (טקסט מנורמל)
        let textToSearch = ocrFields.AZURE_TEXT_CLEAN || ocrFields._rawContent || '';

        if (textToSearch) {
            console.log(`🔍 לא נמצאו רכבים ב-OCR - מחפש בטקסט גולמי (${ocrFields.AZURE_TEXT_CLEAN ? 'CLEAN' : 'RAW'})`);

            const contentMatches = textToSearch.match(vehiclePattern);
            if (contentMatches) {
                console.log(`🚗 נמצאו ${contentMatches.length} מספרי רכב בטקסט: ${[...new Set(contentMatches)].join(', ')}`);

                contentMatches.forEach(match => {
                    // חפש בהקשר של הרכב - האם זה באמת רכב?
                    const matchIndex = textToSearch.indexOf(match);
                    const contextStart = Math.max(0, matchIndex - 50);
                    const contextEnd = Math.min(textToSearch.length, matchIndex + match.length + 50);
                    const context = textToSearch.substring(contextStart, contextEnd).toLowerCase();

                    // דחה אם זה כרטיס או מספר זיהוי אחר
                    const isCard = context.includes('כרטיס') || context.includes('אשראי');
                    const isTaxId = context.includes('ח.פ') || context.includes('עוסק מורשה');

                    // קבל אם יש מילת מפתח של רכב
                    const isVehicle = context.includes('רכב') || context.includes('רישוי') ||
                                     context.includes('משאית') || context.includes('vehicle');

                    if (!isCard && !isTaxId && (isVehicle || vehicleRules.vehicle_account_mapping[match])) {
                        if (!foundVehicles.includes(match)) {
                            console.log(`✅ רכב מאושר: ${match}`);
                            foundVehicles.push(match);
                        }
                    } else {
                        console.log(`❌ נדחה ${match} - לא רכב (isCard:${isCard}, isTaxId:${isTaxId}, isVehicle:${isVehicle})`);
                    }
                });
            }
        }
    }

    return [...new Set(foundVehicles)];
}

function buildInvoiceFromTemplate(template, structure, config, searchResults, learnedConfig, ocrFields) {
    // ✨ חילוץ supplier_code מכל המקורות האפשריים
    const supplierCode = template.SUPNAME ||
                        config.supplier_config?.supplier_code ||
                        learnedConfig.supplier_id ||
                        learnedConfig.llm_prompt?.supplier_code ||
                        learnedConfig.technical_config?.supplier_code ||
                        "";

    const invoice = {
        SUPNAME: supplierCode,  // ✨ תיקון!
        CODE: template.CODE || "ש\"ח",
        DEBIT: structure.debit_type || "D",
        IVDATE: searchResults.ivdate,
        BOOKNUM: searchResults.booknum
    };

    // DETAILS - יצירה חכמה לפי רכבים
    if (searchResults.vehicles && searchResults.vehicles.length > 0) {
        const vehicleNum = searchResults.vehicles[0];
        const shortDesc = extractShortDescription(ocrFields, vehicleNum);

        let currentMileage = '';
        const unidentified = ocrFields.UnidentifiedNumbers || [];

        if (unidentified.length > 0) {
            const mileageItem = unidentified.find(item => {
                if (typeof item === 'object') {
                    const label = item.label || '';
                    const value = item.value || '';
                    if (label.includes('ק') || label.includes('קמ') || label.includes('מ')) {
                        return /^\d{5,6}$/.test(value);
                    }
                }
                return false;
            });

            if (mileageItem && typeof mileageItem === 'object') {
                currentMileage = mileageItem.value;
            }
        }

        if (!currentMileage && ocrFields.CustomerId && /^\d{5,6}$/.test(ocrFields.CustomerId)) {
            currentMileage = ocrFields.CustomerId;
        }

        invoice.DETAILS = currentMileage ? `${shortDesc}-${currentMileage}` : shortDesc;
    } else if (searchResults.details) {
        invoice.DETAILS = searchResults.details;
    }

    // פריטים
    const needItems = true;

    if (needItems) {
        const vehicleRules = config.rules?.critical_patterns?.vehicle_rules;

        if (searchResults.vehicles && searchResults.vehicles.length > 0 && vehicleRules) {
            // 1️⃣ יצירת פריטים מרכבים + OCR
            invoice.PINVOICEITEMS_SUBFORM = createVehicleItems(
                searchResults.vehicles,
                searchResults.items,
                vehicleRules,
                ocrFields
            );
        } else if (searchResults.items && searchResults.items.length > 0) {
            // 2️⃣ יצירת פריטים מ-OCR Items (בלי רכבים)
            invoice.PINVOICEITEMS_SUBFORM = createItemsFromOCR(
                searchResults.items,
                template,
                ocrFields
            );
        } else if (template.PINVOICEITEMS_SUBFORM) {
            // 3️⃣ fallback - העתק מהתבנית רק אם אין OCR כלל
            invoice.PINVOICEITEMS_SUBFORM = JSON.parse(JSON.stringify(template.PINVOICEITEMS_SUBFORM));
        }
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

    // שדות קבועים מהתבנית (אם יש פריט ראשון בתבנית)
    const templateItem = template.PINVOICEITEMS_SUBFORM?.[0] || {};

    ocrItems.forEach((ocrItem, index) => {
        // חישוב מחיר - נסה UnitPrice, ואם לא קיים - חלק Amount ב-Quantity
        let price = 0;
        if (ocrItem.UnitPrice) {
            price = ocrItem.UnitPrice;
        } else if (ocrItem.Amount && ocrItem.Quantity) {
            price = ocrItem.Amount / (ocrItem.Quantity || 1);
        } else if (ocrItem.Amount) {
            price = ocrItem.Amount;
        }

        const item = {
            // שדות קבועים מהתבנית
            PARTNAME: templateItem.PARTNAME || "item",
            TUNITNAME: ocrItem.Unit || templateItem.TUNITNAME || "יח'",
            VATFLAG: templateItem.VATFLAG || "Y",
            ACCNAME: templateItem.ACCNAME || "",
            SPECIALVATFLAG: templateItem.SPECIALVATFLAG || "Y",

            // שדות דינמיים מ-OCR
            PDES: ocrItem.Description || templateItem.PDES || "",
            TQUANT: ocrItem.Quantity || 1,
            PRICE: price
        };

        // BUDCODE אם קיים בתבנית
        if (templateItem.BUDCODE) {
            item.BUDCODE = templateItem.BUDCODE;
        }

        items.push(item);
    });

    // בדיקת סכום כולל מול OCR - תיקון: השווה מול SubTotal (לפני מע"מ)
    const calculatedTotal = items.reduce((sum, item) => sum + (item.TQUANT * item.PRICE), 0);

    // חישוב SubTotal מ-OCR
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

        if (percentDiff > 5) {  // הפרש של יותר מ-5%
            console.log(`⚠️  WARNING: הפרש סכומים! OCR SubTotal=${ocrSubtotal}, חישוב=${calculatedTotal.toFixed(2)}, הפרש=${difference.toFixed(2)} (${percentDiff.toFixed(1)}%)`);
        } else {
            console.log(`✅ סכום תואם: OCR SubTotal=${ocrSubtotal}, חישוב=${calculatedTotal.toFixed(2)}`);
        }
    }

    console.log(`DEBUG-createItemsFromOCR: נוצרו ${items.length} פריטים מ-OCR`);
    return items;
}

function createVehicleItems(vehicles, ocrItems, vehicleRules, ocrFields) {
    if (!vehicles || vehicles.length === 0) return [];

    const vehicleItems = [];
    const totalPrice = ocrFields.SubTotal_amount || ocrFields.InvoiceTotal_amount || 0;
    const pricePerVehicle = vehicles.length > 0 ? totalPrice / vehicles.length : totalPrice;

    vehicles.forEach(vehicleNum => {
        const mapping = vehicleRules.vehicle_account_mapping?.[vehicleNum];

        const relatedItem = ocrItems.find(item =>
            (item.VehicleNumber && item.VehicleNumber === vehicleNum) ||
            (item.Description && item.Description.includes(vehicleNum))
        );

        const shortDesc = extractShortDescription(ocrFields, vehicleNum);

        // 🚗 הוסף מספר רכב לתיאור - קריטי לזיהוי בפריוריטי!
        const pdesWithVehicle = `${vehicleNum} ${shortDesc}`;

        // אם mapping הוא array (2 bundles) - קח את הראשון
        let actualMapping = mapping;
        if (Array.isArray(mapping) && mapping.length > 0) {
            console.log(`🚗 רכב ${vehicleNum}: נמצאו ${mapping.length} bundles, לוקח bundle ראשון`);
            actualMapping = mapping[0];
        }

        const item = {
            PARTNAME: vehicleRules.output_format?.partname || "car",
            PDES: pdesWithVehicle,
            TQUANT: relatedItem?.Quantity || 1,
            TUNITNAME: relatedItem?.Unit || "יח'",
            PRICE: pricePerVehicle,
            VATFLAG: actualMapping?.vat_pattern?.VATFLAG || "Y",
            // 🚨 קריטי: אם רכב לא נמצא ב-CARS - ACCNAME יישאר ריק! (לא default)
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
            console.log(`⚠️  רכב ${vehicleNum} לא נמצא ב-CARS mapping - ACCNAME ריק!`);
        }

        vehicleItems.push(item);
    });

    console.log(`DEBUG-createVehicleItems: נוצרו ${vehicleItems.length} פריטי רכב`);
    return vehicleItems;
}

function performValidation(invoice, ocrFields, config, docsList, patterns) {
    const warnings = [];
    const checks = {
        required_fields_check: "passed",
        invoice_structure_check: "passed",
        amount_validation: "not_checked"
    };

    // בדיקת שדות חובה
    const requiredFields = ["SUPNAME", "CODE", "DEBIT", "IVDATE", "BOOKNUM"];
    const missingFields = requiredFields.filter(f => !invoice[f]);

    if (missingFields.length > 0) {
        warnings.push(`שדות חובה חסרים: ${missingFields.join(', ')}`);
        checks.required_fields_check = "failed";
    }

    // ✨ בדיקת סכומים - אם יש פריטים
    if (invoice.PINVOICEITEMS_SUBFORM && invoice.PINVOICEITEMS_SUBFORM.length > 0) {
        const calculatedTotal = invoice.PINVOICEITEMS_SUBFORM.reduce((sum, item) => {
            return sum + (item.TQUANT || 0) * (item.PRICE || 0);
        }, 0);

        // ⚠️ תיקון קריטי: חישוב הפריטים הוא לפני מע"מ!
        // קודם נסה SubTotal (לפני מע"מ)
        let ocrSubtotal = ocrFields.SubTotal || ocrFields.SubTotal_amount || 0;

        // אם אין SubTotal אבל יש InvoiceTotal + TotalTax - חשב SubTotal
        if (!ocrSubtotal &&
            (ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount) &&
            (ocrFields.TotalTax || ocrFields.TotalTax_amount)) {
            const invoiceTotal = ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount;
            const totalTax = ocrFields.TotalTax || ocrFields.TotalTax_amount;
            ocrSubtotal = invoiceTotal - totalTax;
            console.log(`DEBUG-validation: חישוב SubTotal מ-InvoiceTotal: ${invoiceTotal} - ${totalTax} = ${ocrSubtotal}`);
        }

        if (calculatedTotal > 0 && ocrSubtotal > 0) {
            const difference = Math.abs(calculatedTotal - ocrSubtotal);
            const percentDiff = (difference / ocrSubtotal) * 100;

            if (percentDiff > 5) {
                warnings.push(`⚠️ הפרש סכומים: חישוב=${calculatedTotal.toFixed(2)} ש"ח, OCR SubTotal=${ocrSubtotal.toFixed(2)} ש"ח, הפרש=${percentDiff.toFixed(1)}%`);
                checks.amount_validation = "warning";
            } else {
                warnings.push(`✅ סכום תקין: ${calculatedTotal.toFixed(2)} ש"ח (הפרש ${percentDiff.toFixed(1)}% מ-OCR SubTotal)`);
                checks.amount_validation = "passed";
            }
        } else {
            warnings.push(`ℹ️ לא ניתן לבדוק סכומים: חישוב=${calculatedTotal.toFixed(2)}, OCR SubTotal=${ocrSubtotal}`);
            checks.amount_validation = "not_applicable";
        }
    } else {
        // אם אין פריטים - בדיקת כמויות
        const itemsInOCR = ocrFields.Items ? ocrFields.Items.length : 0;
        if (itemsInOCR > 0) {
            warnings.push(`ℹ️ OCR זיהה ${itemsInOCR} פריטים אבל לא נוצרו פריטים בחשבונית`);
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

                    // הוסף suggested_budcode רק אם קיים
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

// ============================================================================
// Exports - אפשר ייבוא כמודול
// ============================================================================

module.exports = {
    processProductionInvoice,
    processInvoiceComplete
};

// ============================================================================
// נקודת כניסה - רק אם מריצים ישירות (לא כמודול)
// ============================================================================

// ✨ גישה פשוטה כמו ב-Processing Invoice - return ישיר
if (typeof input !== 'undefined') {
    // DEBUG: לוג את סוג input
    console.log("DEBUG-v20:00: typeof input =", typeof input, "isArray =", Array.isArray(input));

    // קריאת INPUT - תמיכה בשני המבנים
    const inputData = input[0] || input;

    console.log("DEBUG-v20:00: inputData keys =", Object.keys(inputData));

    let result;

    if (inputData.AZURE && inputData.SUPNAME) {
        // מבנה חדש - Production Invoice
        result = processProductionInvoice(inputData);
    } else if (inputData.input && Array.isArray(inputData.input)) {
        // מבנה Processing Invoice עם input array
        result = processInvoiceComplete(inputData);
    } else {
        // מבנה ישן - Processing Invoice (fallback)
        const processInput = {
            learned_config: input.learned_config || {},
            docs_list: input.docs_list || { DOC_YES_NO: "N", list_of_docs: [] },
            import_files: input.import_files || { IMPFILES: [] },
            AZURE_RESULT: input.AZURE_RESULT || { data: { fields: {} } },
            AZURE_TEXT_CLEAN: input.AZURE_TEXT_CLEAN || "",
            AZURE_TEXT: input.AZURE_TEXT || ""
        };
        result = processInvoiceComplete({ input: [
            { name: "learned_config", value: processInput.learned_config },
            { name: "docs_list", value: processInput.docs_list },
            { name: "import_files", value: processInput.import_files },
            { name: "AZURE_RESULT", value: processInput.AZURE_RESULT },
            { name: "AZURE_TEXT_CLEAN", value: processInput.AZURE_TEXT_CLEAN },
            { name: "AZURE_TEXT", value: processInput.AZURE_TEXT }
        ]});
    }

    console.log(JSON.stringify(result, null, 2));
    console.log("DEBUG-v20:00: returning object, has items?", !!result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM);
    console.log("DEBUG-v20:00: items count =", result.invoice_data?.PINVOICES?.[0]?.PINVOICEITEMS_SUBFORM?.length || 0);
    console.log("DEBUG-v20:00: BOOKNUM =", result.invoice_data?.PINVOICES?.[0]?.BOOKNUM);

    // ✨ return object - כמו Processing Invoice!
    return result;
}

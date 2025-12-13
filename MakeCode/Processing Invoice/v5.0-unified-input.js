// ============================================================================
// קוד 2 - עיבוד חשבוניות (גרסה 5.0 - 13.12.25)
//
// ✨ שינוי מבנה קלט: מקבל קלט מאוחד מ-SupplierDataLearningConfig
// במקום קלטים נפרדים (learned_config, docs_list, import_files, AZURE_RESULT)
//
// מחזיר: JSON לפריוריטי + דוח ביצוע + הגדרות frontend
//
// 📁 קבצי בדיקה: MakeCode/Processing Invoice/EXEMPTS/
// ============================================================================

// ============================================================================
// פונקציית עזר - המרת קלט מ-Make למבנה הצפוי
// ============================================================================

function normalizeInput(rawInput) {
    console.log(`🔄 normalizeInput v5.0 - rawInput type: ${typeof rawInput}, isArray: ${Array.isArray(rawInput)}`);

    // ✅ חדש! אם הקלט הוא מחרוזת JSON - לפרסר אותה
    if (typeof rawInput === 'string') {
        console.log(`  📝 Input is string, parsing JSON...`);
        try {
            rawInput = JSON.parse(rawInput);
            console.log(`  ✅ Successfully parsed JSON string`);
        } catch (e) {
            console.log(`  ❌ Failed to parse JSON string: ${e.message}`);
            return rawInput;
        }
    }

    console.log(`🔄 rawInput keys: ${rawInput ? Object.keys(rawInput).slice(0, 10).join(', ') : 'null'}`);

    // אם הקלט הוא מערך עם תוצאה (פורמט Make)
    if (Array.isArray(rawInput)) {
        console.log(`  📦 Input is array, length=${rawInput.length}`);
        if (rawInput[0] && rawInput[0].result) {
            console.log(`  ✅ Found result in array[0]`);
            return rawInput[0].result;
        }
        if (rawInput[0] && rawInput[0].status) {
            console.log(`  ✅ Found status in array[0], returning as-is`);
            return rawInput[0];
        }
        console.log(`  📦 Array without result/status, taking first element`);
        return rawInput[0];
    }

    // אם יש result בתוך הקלט (פורמט Make עם logs)
    if (rawInput.result) {
        console.log(`  ✅ Found result property`);
        return rawInput.result;
    }

    // אם יש status ו-templates - זה הקלט הנכון
    if (rawInput.status && rawInput.templates) {
        console.log(`  ✅ Input has status and templates - correct format`);
        return rawInput;
    }

    // נסה למצוא את המבנה הנכון עמוק יותר
    if (rawInput.merged_config) {
        console.log(`  ✅ Found merged_config property`);
        return rawInput.merged_config;
    }

    // אחרת - הקלט כמו שהוא
    console.log(`  ⚠️ Input structure unknown, returning as-is`);
    console.log(`  ⚠️ Has templates: ${!!rawInput.templates}, Has status: ${!!rawInput.status}`);
    return rawInput;
}

// ============================================================================
// פונקציית עזר - ניקוי invoice לפני שליחה ל-Priority
// ============================================================================

function cleanInvoiceForPriority(invoice) {
    const cleaned = JSON.parse(JSON.stringify(invoice));

    if (cleaned.PINVOICEITEMS_SUBFORM) {
        cleaned.PINVOICEITEMS_SUBFORM = cleaned.PINVOICEITEMS_SUBFORM.map(item => {
            delete item.isNewVehicle;
            delete item._learningNote;

            if (item.SPECIALVATFLAG && item.SPECIALVATFLAG !== "Y") {
                delete item.SPECIALVATFLAG;
            }

            return item;
        });
    }

    return cleaned;
}

// ============================================================================
// פונקציה ראשית - עיבוד הקלט המאוחד
// ============================================================================

function processUnifiedConfig(mergedConfig) {
    const executionReport = {
        stage: "",
        found: [],
        not_found: [],
        warnings: [],
        errors: [],
        templates_processed: []
    };

    try {
        // ============================================================================
        // שלב 1: אימות מבנה הקלט
        // ============================================================================

        executionReport.stage = "שלב 1: אימות מבנה";

        if (!mergedConfig || mergedConfig.status !== 'success') {
            throw new Error('קלט לא תקין - status לא success');
        }

        if (!mergedConfig.templates || !Array.isArray(mergedConfig.templates)) {
            throw new Error('קלט לא תקין - אין מערך templates');
        }

        const scannedTemplates = mergedConfig.templates.filter(t => t.scan_status === 'scanned');
        const notScannedTemplates = mergedConfig.templates.filter(t => t.scan_status !== 'scanned');

        executionReport.found.push(`סה"כ תבניות: ${mergedConfig.templates.length}`);
        executionReport.found.push(`תבניות נסרקו: ${scannedTemplates.length}`);

        if (notScannedTemplates.length > 0) {
            executionReport.warnings.push(`תבניות לא נסרקו: ${notScannedTemplates.map(t => t.template_index).join(', ')}`);
        }

        // ============================================================================
        // שלב 2: עיבוד כל תבנית שנסרקה
        // ============================================================================

        executionReport.stage = "שלב 2: עיבוד תבניות";

        const allResults = [];

        for (const template of scannedTemplates) {
            console.log(`\n🔄 מעבד תבנית ${template.template_index}...`);

            const templateResult = processTemplate(template, mergedConfig, executionReport);
            allResults.push(templateResult);

            executionReport.templates_processed.push({
                template_index: template.template_index,
                document_type: template.document_type?.type || 'לא ידוע',
                status: templateResult.status
            });
        }

        // ============================================================================
        // שלב 3: בניית פלט מאוחד
        // ============================================================================

        executionReport.stage = "שלב 3: בניית פלט";

        const supplierCode = mergedConfig.supplier_id;
        const supplierName = mergedConfig.supplier_name;

        // בניית all_templates עבור llm_prompt
        const llmTemplates = allResults.map(r => {
            const { supplier_code, supplier_name, ...rest } = r.llm_prompt || {};
            return {
                ...rest,
                invoice_data: r.invoice_data
            };
        });

        // בניית all_templates עבור technical_config
        const technicalTemplates = allResults.map(r => {
            const { supplier_code, supplier_name, ...rest } = r.technical_config || {};
            return rest;
        });

        // בניית all_templates עבור processing_scenario
        const processingScenarios = allResults.map(r => r.processing_scenario || {});

        return {
            status: "success",

            // 1. הנחיות ל-LLM
            llm_prompt: {
                supplier_code: supplierCode,
                supplier_name: supplierName,
                all_templates: llmTemplates
            },

            // 2. קונפיג טכני
            technical_config: {
                supplier_code: supplierCode,
                supplier_name: supplierName,
                all_templates: technicalTemplates
            },

            // 3. סצנריו עיבוד
            processing_scenario: {
                supplier_code: supplierCode,
                supplier_name: supplierName,
                all_templates: processingScenarios
            },

            // 4. דוח ביצוע
            execution_report: executionReport
        };

    } catch (error) {
        return {
            status: "error",
            error_type: error.name || "ProcessingError",
            message: error.message,
            execution_report: executionReport
        };
    }
}

// ============================================================================
// עיבוד תבנית בודדת
// ============================================================================

function processTemplate(template, mergedConfig, executionReport) {
    console.log(`\n📋 processTemplate - template_index: ${template.template_index}`);
    console.log(`   scan_status: ${template.scan_status}`);
    console.log(`   has AZURE_RESULT: ${!!template.AZURE_RESULT}`);
    console.log(`   has docs: ${!!template.docs}`);

    const structure = template.structure || {};
    const templateData = template.template || {};
    const docs = template.docs;
    const imfp = template.imfp;
    const azureResult = template.AZURE_RESULT;
    const azureText = template.azuretext || "";

    // בדיקת תקינות AZURE_RESULT
    if (!azureResult) {
        console.log(`   ⚠️ AZURE_RESULT is null/undefined for template ${template.template_index}`);
        executionReport.warnings.push(`תבנית ${template.template_index}: אין תוצאת Azure`);
    }

    // בדיקות בסיסיות
    const hasImport = structure.has_import || false;
    const hasDocs = checkDocsExist(docs);
    const debitType = structure.debit_type || "D";

    executionReport.found.push(`תבנית ${template.template_index}: יבוא=${hasImport}, תעודות=${hasDocs}, חיוב/זיכוי=${debitType}`);

    // חילוץ דפוסים מ-OCR - עם הגנות
    let ocrFields = {};
    if (azureResult && azureResult.data && azureResult.data.fields) {
        ocrFields = azureResult.data.fields;
    } else if (azureResult && azureResult.fields) {
        ocrFields = azureResult.fields;
    }
    console.log(`   ocrFields keys: ${Object.keys(ocrFields).slice(0, 5).join(', ')}`);

    const documentPatterns = detectDocumentPatterns(ocrFields, azureText);

    // חוקי רכבים
    const vehicleRules = mergedConfig.critical_patterns?.vehicle_rules || null;

    // חיפוש נתונים
    const searchResults = searchAllData(
        ocrFields,
        azureText,
        template.sample,
        structure,
        imfp,
        docs,
        vehicleRules
    );

    // בניית חשבונית
    const invoice = buildInvoiceFromTemplate(
        templateData,
        structure,
        mergedConfig,
        searchResults,
        ocrFields,
        docs
    );

    const cleanedInvoice = cleanInvoiceForPriority(invoice);

    // יצירת LLM prompt
    const llmPrompt = generateLLMPrompt(
        mergedConfig,
        ocrFields,
        searchResults,
        template.template_index,
        structure,
        documentPatterns,
        vehicleRules
    );

    // יצירת technical config
    const technicalConfig = generateTechnicalConfig(
        mergedConfig,
        ocrFields,
        searchResults,
        template.template_index,
        structure,
        documentPatterns,
        vehicleRules
    );

    // יצירת processing scenario
    const processingScenario = generateProcessingScenario(structure, vehicleRules);

    return {
        status: "success",
        template_index: template.template_index,
        invoice_data: { PINVOICES: [cleanedInvoice] },
        llm_prompt: llmPrompt,
        technical_config: technicalConfig,
        processing_scenario: processingScenario
    };
}

// ============================================================================
// פונקציות עזר - בדיקות
// ============================================================================

function checkDocsExist(docs) {
    if (!docs) return false;

    if (docs.DOC_YES_NO === "Y") {
        return docs.list_of_docs && docs.list_of_docs.length > 0;
    }

    if (docs.list_of_docs && Array.isArray(docs.list_of_docs)) {
        return docs.list_of_docs.length > 0 && docs.list_of_docs[0] !== "";
    }

    return false;
}

function detectDocumentPatterns(ocrFields, azureText) {
    const detected = {
        booknum_found: [],
        docno_found: [],
        booknum_pattern: null,
        docno_pattern: null,
        guidance: ""
    };

    const unidentified = ocrFields.UnidentifiedNumbers || [];

    if (unidentified.length > 0) {
        const values = typeof unidentified[0] === 'object'
            ? unidentified.map(item => item.value).filter(v => v)
            : unidentified;

        values.forEach(val => {
            if (/^10\d{7}$/.test(val)) {
                detected.booknum_found.push(val);
            }
            if (/^25\d{6}$/.test(val)) {
                detected.docno_found.push(val);
            }
        });
    }

    if (detected.booknum_found.length === 0 && azureText) {
        const booknumMatches = azureText.match(/\b10\d{7}\b/g);
        if (booknumMatches) {
            detected.booknum_found = [...new Set(booknumMatches)];
        }
    }

    if (detected.docno_found.length === 0 && azureText) {
        const docnoMatches = azureText.match(/\b25\d{6}\b/g);
        if (docnoMatches) {
            detected.docno_found = [...new Set(docnoMatches)];
        }
    }

    if (detected.booknum_found.length > 0) {
        const firstBooknum = detected.booknum_found[0];
        const prefix = firstBooknum.substring(0, 3);
        detected.booknum_pattern = `\\b(${prefix}\\d{6})\\b`;
        detected.guidance = `🔍 זוהתה תבנית BOOKNUM: ${prefix}XXXXXX (${detected.booknum_found.length} דוגמאות)`;
    }

    if (detected.docno_found.length > 0) {
        detected.docno_pattern = `\\b(25\\d{6})\\b`;
    }

    return detected;
}

// ============================================================================
// חיפוש נתונים
// ============================================================================

function searchAllData(ocrFields, azureText, sample, structure, imfp, docs, vehicleRules) {
    return {
        booknum: searchBooknum(ocrFields, sample),
        ivdate: searchIvdate(ocrFields),
        details: searchDetails(ocrFields, azureText),
        ordname: structure.has_purchase_orders || structure.has_import ? searchOrdname(ocrFields) : null,
        impfnum: structure.has_import ? searchImpfnum(ocrFields, imfp) : null,
        documents: structure.has_doc ? searchDocuments(ocrFields, azureText, docs) : null,
        vehicles: vehicleRules ? extractVehicles(ocrFields, vehicleRules, azureText) : [],
        items: ocrFields.Items || []
    };
}

function searchBooknum(ocrFields, sample) {
    let booknum = ocrFields.InvoiceId || "";
    booknum = String(booknum).replace(/^SI/i, '');

    if (sample && sample.sample_booknum) {
        const expectedLength = sample.sample_booknum.length;
        if (booknum.length > expectedLength) {
            booknum = booknum.slice(-expectedLength);
        }
    }

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

function searchOrdname(ocrFields) {
    const unidentified = ocrFields.UnidentifiedNumbers || [];
    const ordPattern = /^\d{10}$/;

    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            const orderItem = unidentified.find(item =>
                item.label && (
                    item.label.includes('הזמנה') ||
                    item.label.toLowerCase().includes('order')
                ) && ordPattern.test(item.value)
            );

            if (orderItem) return orderItem.value;

            const anyOrder = unidentified.find(item => ordPattern.test(item.value));
            return anyOrder ? anyOrder.value : "";
        } else {
            const match = unidentified.find(num => ordPattern.test(num));
            return match || "";
        }
    }

    return "";
}

function searchImpfnum(ocrFields, imfp) {
    const unidentified = ocrFields.UnidentifiedNumbers || [];
    const impPattern = /^\d{2}c\d{5}$/;

    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            const importItem = unidentified.find(item =>
                impPattern.test(item.value)
            );
            if (importItem) return importItem.value;
        } else {
            const match = unidentified.find(num => impPattern.test(num));
            if (match) return match;
        }
    }

    // Fallback: חפש ב-imfp
    if (imfp && imfp.IMPFILES && imfp.IMPFILES.length > 0) {
        try {
            const parsed = JSON.parse('[' + imfp.IMPFILES[0] + ']');
            if (parsed.length > 0 && parsed[0].IMPFNUM) {
                return parsed[0].IMPFNUM;
            }
        } catch (e) {}
    }

    return "";
}

function searchDocuments(ocrFields, azureText, docs) {
    const foundDocs = [];

    if (!docs || !docs.list_of_docs || docs.list_of_docs.length === 0) {
        return foundDocs;
    }

    let availableDocs = [];
    try {
        availableDocs = docs.list_of_docs.flatMap(d => {
            if (typeof d === 'string') return JSON.parse(d);
            return d;
        });
    } catch (e) {
        return foundDocs;
    }

    const unidentified = ocrFields.UnidentifiedNumbers || [];

    if (unidentified.length > 0) {
        const values = typeof unidentified[0] === 'object'
            ? unidentified.map(item => item.value).filter(v => v)
            : unidentified;

        for (const val of values) {
            const match = availableDocs.find(doc => doc.BOOKNUM === val);
            if (match) {
                foundDocs.push({
                    DOCNO: match.DOCNO,
                    BOOKNUM: match.BOOKNUM,
                    TOTQUANT: match.TOTQUANT || null
                });
            }
        }
    }

    // Fallback: חפש ב-azureText
    if (foundDocs.length === 0 && azureText) {
        for (const doc of availableDocs) {
            const pattern = new RegExp('\\b' + doc.BOOKNUM + '\\b');
            if (pattern.test(azureText)) {
                foundDocs.push({
                    DOCNO: doc.DOCNO,
                    BOOKNUM: doc.BOOKNUM,
                    TOTQUANT: doc.TOTQUANT || null
                });
            }
        }
    }

    return foundDocs;
}

function extractVehicles(ocrFields, vehicleRules, azureText) {
    if (!vehicleRules || !vehicleRules.vehicle_account_mapping) return [];

    const foundVehicles = [];
    const vehiclePattern = /\d{3}-\d{2}-\d{3}/;
    const unidentified = ocrFields.UnidentifiedNumbers || [];

    unidentified.forEach(item => {
        const value = typeof item === 'object' ? item.value : item;
        const label = typeof item === 'object' ? (item.label || '') : '';
        const context = typeof item === 'object' ? (item.context || '') : '';

        const isValidVehicleNumber = vehiclePattern.test(value);
        const looksLikeCardNumber = context.includes('כרטיס') || label.includes('כרטיס');

        if (isValidVehicleNumber && !looksLikeCardNumber && !foundVehicles.includes(value)) {
            foundVehicles.push(value);
        }
    });

    // Fallback: חפש ב-azureText
    if (foundVehicles.length === 0 && azureText) {
        const matches = azureText.match(/\d{3}-\d{2}-\d{3}/g) || [];
        matches.forEach(match => {
            if (!foundVehicles.includes(match)) {
                const contextStart = Math.max(0, azureText.indexOf(match) - 20);
                const contextEnd = Math.min(azureText.length, azureText.indexOf(match) + match.length + 20);
                const context = azureText.substring(contextStart, contextEnd);

                if (!context.includes('כרטיס')) {
                    foundVehicles.push(match);
                }
            }
        });
    }

    return [...new Set(foundVehicles)];
}

// ============================================================================
// בניית חשבונית
// ============================================================================

function buildInvoiceFromTemplate(templateData, structure, mergedConfig, searchResults, ocrFields, docs) {
    const invoice = {
        SUPNAME: mergedConfig.supplier_id,
        CODE: templateData.CODE || "ש\"ח",
        DEBIT: structure.debit_type,
        IVDATE: searchResults.ivdate,
        BOOKNUM: searchResults.booknum
    };

    if (searchResults.ordname) {
        invoice.ORDNAME = searchResults.ordname;
    }

    if (searchResults.impfnum) {
        invoice.IMPFNUM = searchResults.impfnum;
    }

    if (searchResults.details) {
        invoice.DETAILS = searchResults.details;
    }

    // תעודות
    if (structure.has_doc && searchResults.documents && searchResults.documents.length > 0) {
        if (searchResults.documents.length === 1) {
            invoice.DOCNO = searchResults.documents[0].DOCNO;
        } else {
            invoice.PIVDOC_SUBFORM = searchResults.documents.map(d => ({
                DOCNO: d.DOCNO,
                BOOKNUM: d.BOOKNUM
            }));
        }
    }

    // פריטים
    if (!structure.has_doc || !searchResults.documents || searchResults.documents.length === 0) {
        const vehicleRules = mergedConfig.critical_patterns?.vehicle_rules;

        if (searchResults.vehicles && searchResults.vehicles.length > 0 && vehicleRules) {
            invoice.PINVOICEITEMS_SUBFORM = createVehicleItems(
                searchResults.vehicles,
                searchResults.items,
                vehicleRules,
                ocrFields
            );
        } else if (searchResults.items && searchResults.items.length > 0) {
            invoice.PINVOICEITEMS_SUBFORM = buildItems(
                searchResults.items,
                templateData
            );
        }
    }

    if (templateData.PINVOICESCONT_SUBFORM) {
        invoice.PINVOICESCONT_SUBFORM = templateData.PINVOICESCONT_SUBFORM;
    }

    return invoice;
}

function createVehicleItems(vehicles, ocrItems, vehicleRules, ocrFields) {
    const vehicleItems = [];

    const totalPrice = ocrFields.TotalTax_amount
        ? (ocrFields.InvoiceTotal_amount || 0) - ocrFields.TotalTax_amount
        : (ocrFields.SubTotal_amount || ocrFields.InvoiceTotal_amount || 0);
    const pricePerVehicle = vehicles.length > 0 ? totalPrice / vehicles.length : totalPrice;

    vehicles.forEach(vehicleNum => {
        const mapping = vehicleRules.vehicle_account_mapping?.[vehicleNum];

        const item = {
            PARTNAME: "car",
            PDES: extractShortDescription(ocrFields, vehicleNum),
            TQUANT: 1,
            TUNITNAME: "יח'",
            PRICE: pricePerVehicle,
            VATFLAG: mapping?.vat_pattern?.VATFLAG || "Y",
            ACCNAME: mapping?.accname || ""
        };

        if (mapping?.vat_pattern?.SPECIALVATFLAG === "Y") {
            item.SPECIALVATFLAG = "Y";
        }

        vehicleItems.push(item);
    });

    return vehicleItems;
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
                return match[0].replace(/,/g, '').replace(/קמ/g, 'ק"מ').replace(/ק״מ/g, 'ק"מ');
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

function buildItems(ocrItems, templateData) {
    const templateItem = templateData.PINVOICEITEMS_SUBFORM?.[0] || {};

    return ocrItems.map(ocrItem => {
        const item = {
            PARTNAME: templateItem.PARTNAME || "",
            TUNITNAME: templateItem.TUNITNAME || "יח'",
            VATFLAG: templateItem.VATFLAG || "Y",
            ACCNAME: templateItem.ACCNAME || "",
            PDES: ocrItem.Description || "",
            TQUANT: ocrItem.Quantity || 1,
            PRICE: ocrItem.UnitPrice || ocrItem.UnitPrice_amount || 0
        };

        if (templateItem.SPECIALVATFLAG === "Y") {
            item.SPECIALVATFLAG = "Y";
        }

        return item;
    });
}

// ============================================================================
// יצירת פלטים
// ============================================================================

function generateLLMPrompt(mergedConfig, ocrFields, searchResults, templateIndex, structure, documentPatterns, vehicleRules) {
    const fieldInstructions = {};

    fieldInstructions.booknum = {
        field_name: "BOOKNUM",
        description: "מספר חשבונית",
        how_to_find: "חפש בשדה InvoiceId ב-OCR",
        example: searchResults.booknum || ""
    };

    fieldInstructions.ivdate = {
        field_name: "IVDATE",
        description: "תאריך חשבונית",
        how_to_find: "קח את InvoiceDate והמר ל-DD/MM/YY",
        example: searchResults.ivdate || ""
    };

    fieldInstructions.price = {
        field_name: "PRICE",
        description: "מחיר לפני מע\"מ",
        how_to_calculate: "InvoiceTotal_amount - TotalTax_amount"
    };

    if (vehicleRules && vehicleRules.vehicle_account_mapping) {
        fieldInstructions.vehicles = {
            field_name: "VEHICLES",
            description: "מספרי רכבים",
            pattern: "\\d{3}-\\d{2}-\\d{3}",
            example: searchResults.vehicles?.join(', ') || ""
        };
    }

    let documentType = determineDocumentType(structure, vehicleRules);

    const processingSteps = buildProcessingSteps(structure, vehicleRules, documentPatterns);

    return {
        template_index: templateIndex,
        document_type: documentType,
        instructions: {
            overview: `חשבונית מספק ${mergedConfig.supplier_name}`,
            processing_steps: processingSteps,
            fields: fieldInstructions
        }
    };
}

function generateTechnicalConfig(mergedConfig, ocrFields, searchResults, templateIndex, structure, documentPatterns, vehicleRules) {
    const extractionRules = {};

    extractionRules.booknum = {
        source: "ocrFields.InvoiceId",
        transformations: [
            { action: "remove_prefix", pattern: "^SI" },
            { action: "take_last_n_chars", count: 7 }
        ],
        example: searchResults.booknum || ""
    };

    extractionRules.ivdate = {
        source: "ocrFields.InvoiceDate",
        format: "DD/MM/YY",
        example: searchResults.ivdate || ""
    };

    extractionRules.price = {
        calculation: {
            formula: "InvoiceTotal_amount - TotalTax_amount"
        }
    };

    if (vehicleRules && vehicleRules.vehicle_account_mapping) {
        extractionRules.vehicles = {
            pattern: "\\d{3}-\\d{2}-\\d{3}",
            example: searchResults.vehicles || []
        };
    }

    if (structure.has_doc) {
        extractionRules.documents = {
            booknum_pattern: documentPatterns?.booknum_pattern || "\\b10\\d{7}\\b",
            docno_pattern: "\\b25\\d{6}\\b",
            example: searchResults.documents || []
        };
    }

    const documentTypeKey = determineDocumentTypeKey(structure, vehicleRules);

    return {
        template_index: templateIndex,
        version: "5.0",
        document_type: documentTypeKey,
        extraction_rules: extractionRules,
        validation_rules: {
            required_fields: ["SUPNAME", "CODE", "DEBIT", "IVDATE", "BOOKNUM"]
        }
    };
}

function generateProcessingScenario(structure, vehicleRules) {
    const hasVehicles = vehicleRules &&
        vehicleRules.vehicle_account_mapping &&
        Object.keys(vehicleRules.vehicle_account_mapping).length > 0;

    return {
        document_type: determineDocumentTypeKey(structure, vehicleRules),
        check_docs: structure.has_doc || false,
        check_import: structure.has_import || false,
        check_vehicles: hasVehicles || false
    };
}

function determineDocumentType(structure, vehicleRules) {
    if (structure.has_import && structure.has_doc) {
        return "חשבונית עם תיק יבוא עם תעודות";
    } else if (structure.has_import) {
        return "חשבונית יבוא";
    } else if (structure.has_doc) {
        return "חשבונית עם תעודות";
    } else if (structure.debit_type === "C") {
        return "זיכוי רגיל עם פירוט";
    } else if (vehicleRules && Object.keys(vehicleRules.vehicle_account_mapping || {}).length > 0) {
        return "חשבונית שירותי רכב ומוסך";
    }
    return "חשבונית רגילה עם פירוט";
}

function determineDocumentTypeKey(structure, vehicleRules) {
    if (structure.has_import && structure.has_doc) {
        return "import_with_docs_invoice";
    } else if (structure.has_import) {
        return "import_invoice";
    } else if (structure.has_doc) {
        return "docs_invoice";
    } else if (structure.debit_type === "C") {
        return "credit_note";
    } else if (vehicleRules && Object.keys(vehicleRules.vehicle_account_mapping || {}).length > 0) {
        return "vehicle_service_invoice";
    }
    return "regular_invoice";
}

function buildProcessingSteps(structure, vehicleRules, documentPatterns) {
    const steps = [];
    steps.push("1. זהה את מספר החשבונית (BOOKNUM) מתוך InvoiceId");
    steps.push("2. חלץ תאריך חשבונית (IVDATE) מתוך InvoiceDate");

    if (structure.has_import) {
        steps.push(`${steps.length + 1}. זהה מספר יבוא (IMPFNUM)`);
    }

    if (structure.has_doc) {
        let docsGuidance = "זהה תעודות (DOCNO/BOOKNUM)";
        if (documentPatterns && documentPatterns.booknum_found.length > 0) {
            const prefix = documentPatterns.booknum_found[0].substring(0, 3);
            docsGuidance += ` - פורמט ${prefix}XXXXXX`;
        }
        steps.push(`${steps.length + 1}. ${docsGuidance}`);
    }

    if (vehicleRules && Object.keys(vehicleRules.vehicle_account_mapping || {}).length > 0) {
        steps.push(`${steps.length + 1}. חלץ מספרי רכבים (פורמט XXX-XX-XXX)`);
        steps.push(`${steps.length + 1}. מפה כל רכב לחשבון הנכון`);
    }

    steps.push(`${steps.length + 1}. חשב מחיר: InvoiceTotal - TotalTax`);

    return steps;
}

// ============================================================================
// נקודת כניסה
// ============================================================================

if (typeof input !== 'undefined') {
    const normalizedInput = normalizeInput(input);
    const result = processUnifiedConfig(normalizedInput);
    console.log(JSON.stringify(result));
    return result;
}

module.exports = {
    processUnifiedConfig,
    normalizeInput
};

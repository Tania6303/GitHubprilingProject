// ============================================================================
// קוד 2 - עיבוד חשבוניות (גרסה 5.3)
// עדכון אחרון: 17.12.25 16:00
//
// ✨ שינוי מבנה קלט: מקבל קלט מאוחד מ-SupplierDataLearningConfig
// במקום קלטים נפרדים (learned_config, docs_list, import_files, AZURE_RESULT)
//
// תיקונים v5.3:
// - 16:00 העברת sample_from_history כמו שהוא מהקלט (ללא סינון שדות)
// - 16:00 הוספת sample_from_history גם ל-technical_config
// - 15:30 שיפור generateTechnicalConfig - הוספת extraction_rules חדשים + structure_flags
// - 15:30 שיפור generateProcessingScenario - הוספת check_sdinumit, extract_line_items, account_selection_required
// - 15:30 עדכון version ל-5.3 בכל הפלטים
//
// תיקונים v5.2:
// - 14:00 שיפור generateLLMPrompt - הוספת שדות details, pdes, accname, sdinumit, fncpatname
// - 14:00 תיקון searchDetails - סינון טלפון/פקס/כתובת
// - 14:00 תיקון buildItems - חילוץ PDES ו-PRICE מהתבנית או azureText
// - 14:00 הוספת searchSdinumit - חיפוש מספר הקצאה
// - 14:00 הוספת PINVOICESCONT_SUBFORM עם FNCPATNAME ו-SDINUMIT
// - 14:00 הוספת לוגיקת בחירת ACCNAME כשיש מספר חשבונות
//
// תיקונים קודמים:
// - 18:00 תאימות ל-v1.7: sample.BOOKNUM במקום sample.sample_booknum
// - 16:00 תמיכה בעטיפת learned_config מ-Make
// - 15:30 תמיכה בקלט כמחרוזת JSON (JSON.parse)
// - 15:00 הגנות על AZURE_RESULT null
// - 14:30 לוגים מפורטים לזיהוי מבנה קלט
//
// מחזיר: JSON לפריוריטי + דוח ביצוע + הגדרות frontend
//
// 📁 קבצי בדיקה: MakeCode/Processing Invoice/EXEMPTS/
// ============================================================================

// ============================================================================
// פונקציית עזר - המרת קלט מ-Make למבנה הצפוי
// ============================================================================

function normalizeInput(rawInput) {
    console.log(`🔄 normalizeInput v5.1 18:00 - rawInput type: ${typeof rawInput}, isArray: ${Array.isArray(rawInput)}`);

    // ✅ אם הקלט הוא מחרוזת JSON - לפרסר אותה
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

    // ✅ חדש! אם יש learned_config - זה עטיפה מ-Make
    if (rawInput.learned_config) {
        console.log(`  📦 Found learned_config wrapper, extracting...`);
        let learnedConfig = rawInput.learned_config;

        // אם learned_config הוא מחרוזת - לפרסר
        if (typeof learnedConfig === 'string') {
            console.log(`  📝 learned_config is string, parsing...`);
            try {
                learnedConfig = JSON.parse(learnedConfig);
                console.log(`  ✅ Successfully parsed learned_config`);
            } catch (e) {
                console.log(`  ❌ Failed to parse learned_config: ${e.message}`);
                return rawInput;
            }
        }

        // אם יש logs ו-result בתוך - לחלץ את result
        if (learnedConfig.result) {
            console.log(`  ✅ Found result inside learned_config`);
            return learnedConfig.result;
        }

        // אם יש status ו-templates ישירות - זה הקלט הנכון
        if (learnedConfig.status && learnedConfig.templates) {
            console.log(`  ✅ learned_config has status and templates`);
            return learnedConfig;
        }

        return learnedConfig;
    }

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
        vehicleRules,
        templateData  // v5.2: העברת נתוני תבנית לחילוץ DETAILS
    );

    // בניית חשבונית
    const invoice = buildInvoiceFromTemplate(
        templateData,
        structure,
        mergedConfig,
        searchResults,
        ocrFields,
        docs,
        azureText  // v5.2: העברת azureText לחילוץ פריטים
    );

    const cleanedInvoice = cleanInvoiceForPriority(invoice);

    // v5.2: חילוץ document_type מ-templateData
    const documentType = templateData?.document_type || {};

    // יצירת LLM prompt
    const llmPrompt = generateLLMPrompt(
        mergedConfig,
        ocrFields,
        searchResults,
        template.template_index,
        structure,
        documentPatterns,
        vehicleRules,
        template  // v5.2: העברת התבנית המלאה לחילוץ מידע נוסף
    );

    // יצירת technical config - v5.3: הוספת documentType, templateData ו-sample
    const technicalConfig = generateTechnicalConfig(
        mergedConfig,
        ocrFields,
        searchResults,
        template.template_index,
        structure,
        documentPatterns,
        vehicleRules,
        documentType,
        templateData,
        template.sample  // v5.3: העברת sample כמו שהוא
    );

    // יצירת processing scenario - v5.2: הוספת documentType
    const processingScenario = generateProcessingScenario(structure, vehicleRules, documentType);

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

function searchAllData(ocrFields, azureText, sample, structure, imfp, docs, vehicleRules, templateData) {
    return {
        booknum: searchBooknum(ocrFields, sample),
        ivdate: searchIvdate(ocrFields),
        details: searchDetails(ocrFields, azureText, templateData),
        ordname: structure.has_purchase_orders || structure.has_import ? searchOrdname(ocrFields) : null,
        impfnum: structure.has_import ? searchImpfnum(ocrFields, imfp) : null,
        documents: structure.has_doc ? searchDocuments(ocrFields, azureText, docs) : null,
        vehicles: vehicleRules ? extractVehicles(ocrFields, vehicleRules, azureText) : [],
        items: ocrFields.Items || [],
        sdinumit: searchSdinumit(azureText),
        // מידע נוסף לשימוש ב-LLM prompt
        subtotal: ocrFields.SubTotal_amount || null,
        total_tax: ocrFields.TotalTax_amount || null,
        invoice_total: ocrFields.InvoiceTotal_amount || null
    };
}

function searchBooknum(ocrFields, sample) {
    let booknum = ocrFields.InvoiceId || "";
    booknum = String(booknum).replace(/^SI/i, '');

    // v1.7: sample הוא אובייקט מלא עם BOOKNUM (לא sample_booknum)
    if (sample && sample.BOOKNUM) {
        const expectedLength = String(sample.BOOKNUM).length;
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

function searchDetails(ocrFields, azureText, templateData) {
    // 1. קודם כל - נסה לקחת מתבנית הלמידה
    if (templateData && templateData.DETAILS) {
        return templateData.DETAILS;
    }

    // 2. אם יש InvoiceDescription מה-OCR
    if (ocrFields.InvoiceDescription) {
        return ocrFields.InvoiceDescription;
    }

    // 3. חפש בטקסט - אבל סנן שורות לא רלוונטיות
    if (azureText) {
        const excludePatterns = [
            /טלפון|פקס|פקסימיליה/i,
            /ת\.ד\.|תא דואר/i,
            /עוסק מורשה/i,
            /כתובת|רחוב|רח'/i,
            /^\d+[-\/]\d+[-\/]\d+$/,  // תאריכים
            /^\d{5,}$/,               // מספרים ארוכים בלבד
            /מסמך ממוחשב/i,
            /לכבוד:/i,
            /מקור|העתק/i
        ];

        const lines = azureText.split('\n').filter(l => {
            const trimmed = l.trim();
            if (!trimmed || trimmed.length < 3) return false;

            // בדוק אם השורה מכילה תבניות לא רצויות
            for (const pattern of excludePatterns) {
                if (pattern.test(trimmed)) return false;
            }
            return true;
        });

        // חפש שורות שמתארות שירות/מוצר
        const serviceKeywords = /ריטיינר|דוח|ייעוץ|שירות|עבודה|תלושי|הנה"ח|ביקורת|רבעון|שנתי/i;
        const serviceLine = lines.find(l => serviceKeywords.test(l));
        if (serviceLine) {
            return serviceLine.substring(0, 100);
        }

        // אם לא נמצא - קח שורה ראשונה תקינה (אחרי הסינון)
        if (lines.length > 0) {
            return lines[0].substring(0, 100);
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

// ============================================================================
// חיפוש מספר הקצאה - רק אם יש את המילה "הקצאה" במפורש!
// ============================================================================

function searchSdinumit(azureText) {
    if (!azureText) return "";

    // חיפוש קשיח: רק המילה "הקצאה" + מספר (בדרך כלל 9 ספרות)
    const patterns = [
        /מספר\s+הקצאה[:\s]*(\d{9})/i,
        /הקצאה\s+מס[׳']?[:\s]*(\d{9})/i,
        /הקצאה[:\s]+(\d{9})/i
    ];

    for (const pattern of patterns) {
        const match = azureText.match(pattern);
        if (match) {
            console.log(`   ✅ נמצא מספר הקצאה: ${match[1]}`);
            return match[1];
        }
    }

    // לא נמצא - זה תקין (ייתכן מתחת לסף או מסמך ישן)
    return "";
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

function buildInvoiceFromTemplate(templateData, structure, mergedConfig, searchResults, ocrFields, docs, azureText) {
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
        } else {
            // v5.2: העברת פרמטרים נוספים ל-buildItems
            invoice.PINVOICEITEMS_SUBFORM = buildItems(
                searchResults.items,
                templateData,
                ocrFields,
                azureText,
                searchResults
            );
        }
    }

    // v5.2: בניית PINVOICESCONT_SUBFORM עם FNCPATNAME ו-SDINUMIT
    const contSubform = {};

    // FNCPATNAME מהתבנית (סוג תנועה)
    if (templateData.PINVOICESCONT_SUBFORM && templateData.PINVOICESCONT_SUBFORM[0]) {
        const templateCont = templateData.PINVOICESCONT_SUBFORM[0];
        if (templateCont.FNCPATNAME) {
            contSubform.FNCPATNAME = templateCont.FNCPATNAME;
        }
    }

    // SDINUMIT - מספר הקצאה (אם נמצא)
    if (searchResults.sdinumit) {
        contSubform.SDINUMIT = searchResults.sdinumit;
    }

    // הוסף את ה-subform רק אם יש בו תוכן
    if (Object.keys(contSubform).length > 0) {
        invoice.PINVOICESCONT_SUBFORM = [contSubform];
    } else if (templateData.PINVOICESCONT_SUBFORM) {
        // אם אין תוכן חדש אבל יש בתבנית - השתמש בתבנית
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

function buildItems(ocrItems, templateData, ocrFields, azureText, searchResults) {
    const templateItems = templateData.PINVOICEITEMS_SUBFORM || [];
    const templateItem = templateItems[0] || {};

    // בדוק אם OCR Items מכיל פריטי חשבונית אמיתיים (יש Description)
    const hasValidOcrItems = ocrItems && ocrItems.length > 0 &&
        ocrItems.some(item => item.Description && !item.Description.includes('העברה'));

    if (hasValidOcrItems) {
        // שימוש ב-OCR Items
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

    // OCR Items לא תקין - בנה פריטים מהתבנית או מהנתונים
    const subtotal = searchResults?.subtotal ||
        (ocrFields.InvoiceTotal_amount && ocrFields.TotalTax_amount
            ? ocrFields.InvoiceTotal_amount - ocrFields.TotalTax_amount
            : ocrFields.SubTotal_amount || 0);

    // אם יש פריטים בתבנית - השתמש בהם כבסיס
    if (templateItems.length > 0) {
        // אם פריט אחד בתבנית - השתמש במחיר מה-OCR
        if (templateItems.length === 1) {
            const pdes = searchResults?.details || templateItem.PDES || "";
            return [{
                PARTNAME: templateItem.PARTNAME || "",
                PDES: pdes,
                TQUANT: templateItem.TQUANT || 1,
                TUNITNAME: templateItem.TUNITNAME || "יח'",
                PRICE: subtotal,
                VATFLAG: templateItem.VATFLAG || "Y",
                ACCNAME: templateItem.ACCNAME || "",
                ...(templateItem.SPECIALVATFLAG === "Y" ? { SPECIALVATFLAG: "Y" } : {})
            }];
        }

        // אם מספר פריטים - שמור את המבנה מהתבנית
        return templateItems.map(ti => ({
            PARTNAME: ti.PARTNAME || "",
            PDES: ti.PDES || "",
            TQUANT: ti.TQUANT || 1,
            TUNITNAME: ti.TUNITNAME || "יח'",
            PRICE: ti.PRICE || 0,
            VATFLAG: ti.VATFLAG || "Y",
            ACCNAME: ti.ACCNAME || "",
            ...(ti.SPECIALVATFLAG === "Y" ? { SPECIALVATFLAG: "Y" } : {})
        }));
    }

    // אין תבנית - צור פריט בודד עם המחיר מה-OCR
    const pdes = searchResults?.details || "";
    return [{
        PARTNAME: "",
        PDES: pdes,
        TQUANT: 1,
        TUNITNAME: "יח'",
        PRICE: subtotal,
        VATFLAG: "Y",
        ACCNAME: ""
    }];
}

// ============================================================================
// יצירת פלטים
// ============================================================================

function generateLLMPrompt(mergedConfig, ocrFields, searchResults, templateIndex, structure, documentPatterns, vehicleRules, template) {
    const fieldInstructions = {};

    // שדות בסיסיים - תמיד
    fieldInstructions.booknum = {
        field_name: "BOOKNUM",
        description: "מספר חשבונית ספק",
        how_to_find: "חפש בשדה InvoiceId ב-OCR",
        example: searchResults.booknum || ""
    };

    fieldInstructions.ivdate = {
        field_name: "IVDATE",
        description: "תאריך חשבונית",
        how_to_find: "קח את InvoiceDate והמר ל-DD/MM/YY",
        example: searchResults.ivdate || ""
    };

    // v5.2: שדה DETAILS
    fieldInstructions.details = {
        field_name: "DETAILS",
        description: "תיאור כללי של החשבונית בכותרת",
        importance: "גבוהה - מסכם את מהות החשבונית",
        how_to_find: "חפש תיאור השירות העיקרי בטקסט",
        do_NOT_use: ["טלפון", "פקס", "כתובת", "מספר עוסק מורשה"],
        example: searchResults.details || ""
    };

    // v5.2: שדה PRICE עם חישוב
    fieldInstructions.price = {
        field_name: "PRICE",
        location: "PINVOICEITEMS_SUBFORM",
        description: "מחיר לפני מע\"מ",
        how_to_calculate: "SubTotal_amount או (InvoiceTotal_amount - TotalTax_amount)",
        example: searchResults.subtotal || ""
    };

    // v5.2: שדה PDES - קריטי לחשבונית עם פירוט
    if (!structure.has_doc) {
        fieldInstructions.pdes = {
            field_name: "PDES",
            location: "PINVOICEITEMS_SUBFORM",
            description: "תיאור הפריט/שירות בשורת הפירוט",
            importance: "קריטי! זה מזהה את סוג ההוצאה",
            max_length: 48,
            how_to_find: "חפש בטקסט שורות המתארות שירותים",
            example: searchResults.details || ""
        };
    }

    // v5.2: שדה ACCNAME - עם לוגיקת בחירה
    const documentTypeInfo = template?.document_type || {};
    const availableAccounts = documentTypeInfo.accnames || [];
    const partNameRules = mergedConfig.critical_patterns?.partname_rules || {};

    if (availableAccounts.length > 0 || Object.keys(partNameRules).length > 0) {
        fieldInstructions.accname = {
            field_name: "ACCNAME",
            location: "PINVOICEITEMS_SUBFORM",
            description: "חשבון הנהלת חשבונות לסיווג ההוצאה",
            importance: "קריטי! קובע איך ההוצאה מסווגת",
            available_accounts: availableAccounts
        };

        // הוסף דוגמאות מההיסטוריה אם יש
        if (Object.keys(partNameRules).length > 0) {
            const examples = [];
            for (const [partname, rules] of Object.entries(partNameRules)) {
                if (rules.accnames && rules.sample_description) {
                    rules.accnames.forEach(acc => {
                        examples.push({
                            partname: partname,
                            description: rules.sample_description,
                            accname: acc
                        });
                    });
                }
            }
            if (examples.length > 0) {
                fieldInstructions.accname.examples_from_history = examples;
                fieldInstructions.accname.selection_guide = "בחר חשבון לפי סוג ההוצאה/שירות בהתאם לדוגמאות ההיסטוריות";
            }
        }

        // אם יש מספר חשבונות - הדגש שצריך לבחור
        if (availableAccounts.length > 1) {
            fieldInstructions.accname.note = `יש ${availableAccounts.length} חשבונות אפשריים - בחר לפי סוג ההוצאה`;
        }
    }

    // v5.2: שדה SDINUMIT - מספר הקצאה
    fieldInstructions.sdinumit = {
        field_name: "SDINUMIT",
        location: "PINVOICESCONT_SUBFORM",
        description: "מספר הקצאה מרשות המיסים",
        importance: "קריטי לחשבוניות מעל סף! ללא מספר זה לא ניתן לנכות מע\"מ",
        format: "9 ספרות",
        rule: "רק אם מופיעה המילה 'הקצאה' במפורש!",
        search_keywords: ["מספר הקצאה", "הקצאה מס'"],
        NOT_valid: ["תעודת רישום", "מספר אסמכתא"],
        example: searchResults.sdinumit || null
    };

    // v5.2: שדה FNCPATNAME - סוג תנועה
    const templateCont = template?.template?.PINVOICESCONT_SUBFORM?.[0];
    if (templateCont && templateCont.FNCPATNAME) {
        fieldInstructions.fncpatname = {
            field_name: "FNCPATNAME",
            location: "PINVOICESCONT_SUBFORM",
            description: "סוג תנועה",
            value: templateCont.FNCPATNAME,
            source: "קבוע מהתבנית הנלמדת"
        };
    }

    // רכבים - אם רלוונטי
    if (vehicleRules && vehicleRules.vehicle_account_mapping && Object.keys(vehicleRules.vehicle_account_mapping).length > 0) {
        fieldInstructions.vehicles = {
            field_name: "VEHICLES",
            description: "מספרי רכבים",
            pattern: "\\d{3}-\\d{2}-\\d{3}",
            mapping: "כל רכב ממופה לחשבון הנה\"ח שלו",
            example: searchResults.vehicles?.join(', ') || ""
        };
    }

    let documentType = determineDocumentType(structure, vehicleRules);
    const processingSteps = buildProcessingSteps(structure, vehicleRules, documentPatterns);

    // v5.2: הוספת מידע על סוג המסמך
    const documentTypeInfoOutput = {
        type: documentType,
        type_key: determineDocumentTypeKey(structure, vehicleRules),
        structure_flags: {
            has_import: structure.has_import || false,
            has_doc: structure.has_doc || false,
            has_purchase_orders: structure.has_purchase_orders || false,
            has_date_range: structure.has_date_range || false,
            has_budcode: structure.has_budcode || false,
            has_pdaccname: structure.has_pdaccname || false,
            inventory_management: structure.inventory_management || "unknown",
            debit_type: structure.debit_type || "D"
        }
    };

    // v5.3: העברת ה-sample כמו שהוא מהקלט
    const sampleFromHistory = template?.sample || null;

    return {
        template_index: templateIndex,
        document_type: documentType,
        document_type_info: documentTypeInfoOutput,
        instructions: {
            overview: `חשבונית מספק ${mergedConfig.supplier_name}`,
            processing_steps: processingSteps,
            fields: fieldInstructions
        },
        sample_from_history: sampleFromHistory,
        ocr_extracted: {
            subtotal: searchResults.subtotal,
            total_tax: searchResults.total_tax,
            invoice_total: searchResults.invoice_total
        }
    };
}

function generateTechnicalConfig(mergedConfig, ocrFields, searchResults, templateIndex, structure, documentPatterns, vehicleRules, documentType, templateData, sample) {
    const extractionRules = {};

    // v5.2: booknum
    extractionRules.booknum = {
        source: "ocrFields.InvoiceId",
        transformations: [
            { action: "remove_prefix", pattern: "^SI" },
            { action: "take_last_n_chars", count: 7 }
        ],
        example: searchResults.booknum || ""
    };

    // v5.2: ivdate
    extractionRules.ivdate = {
        source: "ocrFields.InvoiceDate",
        format: "DD/MM/YY",
        example: searchResults.ivdate || ""
    };

    // v5.2: details - תיאור כללי
    extractionRules.details = {
        source: "azureText",
        method: "find_service_description",
        exclude: ["טלפון", "פקס", "כתובת", "עוסק מורשה"],
        example: searchResults.details || ""
    };

    // v5.2: price
    extractionRules.price = {
        primary: "ocrFields.SubTotal_amount",
        fallback: "ocrFields.InvoiceTotal_amount - ocrFields.TotalTax_amount",
        example: searchResults.subtotal || null
    };

    // v5.2: sdinumit - מספר הקצאה
    extractionRules.sdinumit = {
        source: "azureText",
        required_keyword: "הקצאה",
        pattern: "הקצאה[:\\s]*(\\d{9})",
        example: searchResults.sdinumit || null
    };

    // v5.2: accname - חשבון הנה"ח
    const accnames = documentType?.accnames || [];
    const partnameRules = mergedConfig.supplier_config?.critical_patterns?.partname_rules || {};

    extractionRules.accname = {
        available_accounts: accnames,
        selection_method: accnames.length > 1 ? "by_service_type" : "single_account",
        partname_rules: Object.keys(partnameRules).length > 0 ? partnameRules : null
    };

    // v5.2: fncpatname - סוג תנועה
    const sample = templateData?.sample || {};
    extractionRules.fncpatname = {
        source: "template.sample",
        value: sample.FNCPATNAME || null,
        note: "קבוע מהתבנית הנלמדת"
    };

    // רכבים
    if (vehicleRules && vehicleRules.vehicle_account_mapping) {
        extractionRules.vehicles = {
            pattern: "\\d{3}-\\d{2}-\\d{3}",
            example: searchResults.vehicles || []
        };
    }

    // תעודות
    if (structure.has_doc) {
        extractionRules.documents = {
            booknum_pattern: documentPatterns?.booknum_pattern || "\\b10\\d{7}\\b",
            docno_pattern: "\\b25\\d{6}\\b",
            example: searchResults.documents || []
        };
    }

    // v5.2: פריטים - כשאין תעודות
    if (!structure.has_doc && !structure.has_import) {
        extractionRules.pdes = {
            source: "azureText or ocrFields.Items",
            max_length: 48,
            importance: "critical",
            note: "תיאור הפריט/שירות - קריטי לזיהוי סוג ההוצאה"
        };
    }

    const documentTypeKey = determineDocumentTypeKey(structure, vehicleRules);

    return {
        template_index: templateIndex,
        version: "5.3",
        document_type: documentTypeKey,
        extraction_rules: extractionRules,
        structure_flags: {
            has_import: structure.has_import || false,
            has_doc: structure.has_doc || false,
            has_purchase_orders: structure.has_purchase_orders || false,
            has_date_range: structure.has_date_range || false,
            has_budcode: structure.has_budcode || false,
            has_pdaccname: structure.has_pdaccname || false,
            inventory_management: structure.inventory_management || "not_managed_inventory",
            debit_type: structure.debit_type || "D"
        },
        validation_rules: {
            required_fields: ["SUPNAME", "CODE", "DEBIT", "IVDATE", "BOOKNUM"]
        },
        // v5.3: העברת ה-sample כמו שהוא
        sample_from_history: sample || null
    };
}

function generateProcessingScenario(structure, vehicleRules, documentType) {
    const hasVehicles = vehicleRules &&
        vehicleRules.vehicle_account_mapping &&
        Object.keys(vehicleRules.vehicle_account_mapping).length > 0;

    const accnames = documentType?.accnames || [];
    const hasDocs = structure.has_doc || false;
    const hasImport = structure.has_import || false;

    return {
        document_type: determineDocumentTypeKey(structure, vehicleRules),
        // v5.2: בדיקות בסיסיות
        check_docs: hasDocs,
        check_import: hasImport,
        check_vehicles: hasVehicles || false,
        // v5.2: בדיקות חדשות
        check_sdinumit: true,  // תמיד לבדוק מספר הקצאה
        extract_line_items: !hasDocs && !hasImport,  // רק בחשבונית רגילה
        account_selection_required: accnames.length > 1,  // כשיש יותר מחשבון אחד
        // v5.2: מידע נוסף
        debit_type: structure.debit_type || "D",
        inventory_management: structure.inventory_management || "not_managed_inventory"
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
    steps.push("2. חלץ תאריך חשבונית (IVDATE) מתוך InvoiceDate - המר לפורמט DD/MM/YY");

    // v5.2: תיאור - תמיד
    steps.push(`${steps.length + 1}. חלץ תיאור כללי (DETAILS) - תיאור השירות העיקרי (לא טלפון/כתובת!)`);

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
    } else {
        // v5.2: לחשבונית עם פירוט - הוסף שלבי פריטים
        steps.push(`${steps.length + 1}. לכל פריט: חלץ PDES (תיאור), TQUANT (כמות), PRICE (מחיר לפני מע"מ)`);
        steps.push(`${steps.length + 1}. לכל פריט: בחר ACCNAME מתוך החשבונות הזמינים לפי סוג ההוצאה`);
    }

    if (vehicleRules && Object.keys(vehicleRules.vehicle_account_mapping || {}).length > 0) {
        steps.push(`${steps.length + 1}. חלץ מספרי רכבים (פורמט XXX-XX-XXX)`);
        steps.push(`${steps.length + 1}. מפה כל רכב לחשבון הנכון`);
    }

    // v5.2: מספר הקצאה - תמיד
    steps.push(`${steps.length + 1}. בדוק אם יש מספר הקצאה (רק אם מופיעה המילה 'הקצאה'!) - אם כן, רשום ב-SDINUMIT`);

    steps.push(`${steps.length + 1}. חשב מחיר: SubTotal_amount או (InvoiceTotal - TotalTax)`);

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

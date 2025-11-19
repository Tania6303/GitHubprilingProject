// ============================================================================
// קוד 2 - עיבוד חשבוניות (גרסה 4.8 - 19.11.25.15:45)
// מקבל: OCR + הגדרות + תעודות + יבוא
// מחזיר: JSON לפריוריטי + דוח ביצוע + זיהוי רכבים משופר
//
// 📁 קבצי בדיקה: MakeCode/Processing Invoice/EXEMPTS/
// לקיחת הקובץ העדכני: ls -lt "MakeCode/Processing Invoice/EXEMPTS" | head -5
//
// ✨ חדש בגרסה 4.4:
// - 🎯 זיהוי דינמי של תבניות תעודות: מזהה אוטומטית תבנית BOOKNUM (107/108XXXXXX) מה-OCR
// - 📚 הסברה משופרת ל-LLM: הנחיות מותאמות אישית עם דוגמאות קונקרטיות מה-OCR
// - 🔍 לוג מפורט: "✨ זוהתה תבנית BOOKNUM: 108XXXXXX (3 דוגמאות: 108187003, 108187002...)"
//
// ✨ חדש בגרסה 4.3:
// - fallback לחיפוש רכבים ב-AZURE_TEXT (כש-Azure לא מזהה אוטומטית)
// - לוגים מפורטים: "⚠️ לא נמצאו רכבים במקומות המובנים - מחפש ב-AZURE_TEXT..."
// - מונע זיהוי מספרי כרטיס כרכבים (בדיקת context)
//
// ✨ חדש בגרסה 4.2:
// - תיקון חישוב מחיר: InvoiceTotal - TotalTax = סה"כ לפני מע"מ (עבודות + חלקים)
//
// ✨ חדש בגרסה 4.1:
// - פונקציית cleanInvoiceForPriority() - מנקה שדות למידה לפני שליחה
// - זיהוי רכבים משופר - מונע זיהוי כרטיס כרכב
//
// ✨ חדש בגרסה 4.0:
// - חילוץ רכבים מתקדם לפי vehicle_processing_rules.search_locations
// - תמיכה ב-VehicleNumbers (שדה חדש מ-Azure v3.0)
// - תמיכה ב-Items[].VehicleNumber (קישור ישיר)
// - יצירת פריטי רכבים אוטומטית
// - מיפוי לחשבונות לפי vehicle_account_mapping
//
// ✨ מגרסה 3.0:
// - תמיכה במבנה החדש של UnidentifiedNumbers (מערך אובייקטים)
// - ניצול התוויות (label) וההקשר (context) לזיהוי חכם יותר
// ============================================================================

// ============================================================================
// פונקציית עזר - המרת קלט מ-Make למבנה הצפוי
// ============================================================================

function normalizeInput(rawInput) {
    // אם הקלט כבר במבנה הנכון - החזר אותו
    if (rawInput.learned_config && rawInput.AZURE_RESULT) {
        return rawInput;
    }

    // אם הקלט במבנה מערך עם name/value (מ-Make)
    if (Array.isArray(rawInput) && rawInput[0] && rawInput[0].input) {
        const inputArray = rawInput[0].input;
        const normalized = {};

        inputArray.forEach(item => {
            if (item.name === 'learned_config') {
                normalized.learned_config = item.value;
            } else if (item.name === 'docs_list') {
                // המר מערך ישיר למבנה הצפוי
                if (Array.isArray(item.value)) {
                    normalized.docs_list = {
                        DOC_YES_NO: item.value.length > 0 && item.value[0] !== "" ? "Y" : "N",
                        list_of_docs: item.value.filter(v => v !== "")
                    };
                } else {
                    normalized.docs_list = item.value;
                }
            } else if (item.name === 'import_files') {
                // המר מערך ישיר למבנה הצפוי
                if (Array.isArray(item.value)) {
                    normalized.import_files = {
                        IMPFILES: item.value.filter(v => v !== "")
                    };
                } else {
                    normalized.import_files = item.value;
                }
            } else if (item.name === 'AZURE_RESULT') {
                normalized.AZURE_RESULT = item.value;
            } else if (item.name === 'AZURE_TEXT') {
                normalized.AZURE_TEXT = item.value;
            }
        });

        // אם אין AZURE_TEXT, נסה לחלץ מ-AZURE_RESULT
        if (!normalized.AZURE_TEXT && normalized.AZURE_RESULT) {
            normalized.AZURE_TEXT = "";
        }

        return normalized;
    }

    // מקרה לא מוכר - החזר כמו שזה
    return rawInput;
}

// ============================================================================
// פונקציית עזר - ניקוי invoice לפני שליחה ל-Priority
// ============================================================================

function cleanInvoiceForPriority(invoice) {
    // יצירת עותק עמוק כדי לא לשנות את המקור
    const cleaned = JSON.parse(JSON.stringify(invoice));

    // ניקוי שדות שלא צריכים מהפריטים
    if (cleaned.PINVOICEITEMS_SUBFORM) {
        cleaned.PINVOICEITEMS_SUBFORM = cleaned.PINVOICEITEMS_SUBFORM.map(item => {
            // מחיקת שדות למידה
            delete item.isNewVehicle;
            delete item._learningNote;

            // מחיקת SPECIALVATFLAG אם זה לא "Y"
            if (item.SPECIALVATFLAG && item.SPECIALVATFLAG !== "Y") {
                delete item.SPECIALVATFLAG;
            }

            return item;
        });
    }

    return cleaned;
}

// ============================================================================
// פונקציה ראשית
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
        // ============================================================================
        // שלב 1: זיהוי סוג חשבונית ותבנית
        // ============================================================================

        executionReport.stage = "שלב 1: זיהוי סוג ותבנית";

        // א. בדיקת יבוא
        const hasImport = checkImportExists(input.import_files);

        // ב. בדיקת תעודות - רק לפי docs_list (האם יש תעודות במערכת)
        const hasDocs = checkDocsExist(input.docs_list);

        // ✨ חדש! זיהוי תבניות תעודות מה-OCR
        const documentPatterns = detectDocumentPatterns(
            input.AZURE_RESULT.data.fields,
            input.AZURE_TEXT
        );
        if (documentPatterns.guidance) {
            executionReport.found.push(documentPatterns.guidance);
        }

        // ג. זיהוי חיוב/זיכוי
        const debitType = identifyDebitType(input.AZURE_RESULT.data.fields);

        executionReport.found.push(`סוג: יבוא=${hasImport}, תעודות=${hasDocs}, חיוב/זיכוי=${debitType}`);

        // ד. חיפוש תבנית מתאימה
        const config = input.learned_config.config;
        const templateIndex = findMatchingTemplate(config.structure, hasImport, hasDocs, debitType);

        if (templateIndex === -1) {
            executionReport.errors.push("לא נמצאה תבנית מתאימה!");
            throw new Error("לא נמצאה תבנית מתאימה");
        }

        const structure = config.structure[templateIndex];
        const template = input.learned_config.template.PINVOICES[templateIndex];

        executionReport.found.push(`תבנית: index=${templateIndex}`);

        // ============================================================================
        // שלב 2: הכנה - הבנת דפוסים
        // ============================================================================

        executionReport.stage = "שלב 2: הבנת דפוסים";

        const patterns = extractPatterns(
            input.learned_config.recommended_samples,
            input.docs_list
        );

        executionReport.found.push(`דפוסים: BOOKNUM=${JSON.stringify(patterns.booknum_pattern)}, תעודות=${JSON.stringify(patterns.docs_pattern)}`);

        // ✨ חדש! קריאת חוקי רכבים
        const vehicleRules = config.rules?.critical_patterns?.vehicle_rules || null;
        if (vehicleRules && vehicleRules.enabled) {
            executionReport.found.push(`חוקי רכבים: פעילים (${Object.keys(vehicleRules.vehicle_account_mapping || {}).length} רכבים ממופים)`);
        }

        // ============================================================================
        // שלב 3: חיפוש וזיהוי נתונים
        // ============================================================================

        executionReport.stage = "שלב 3: חיפוש נתונים";

        const ocrFields = input.AZURE_RESULT.data.fields;
        const searchResults = searchAllData(
            ocrFields,
            input.AZURE_TEXT,
            patterns,
            structure,
            input.import_files,
            input.docs_list,
            vehicleRules  // ✨ חדש!
        );

        // תיעוד מה נמצא
        Object.keys(searchResults).forEach(key => {
            if (key === 'documents' && searchResults.documents) {
                if (searchResults.documents.length > 0) {
                    const docsInfo = searchResults.documents.map(d =>
                        `${d.BOOKNUM} (DOCNO: ${d.DOCNO || 'ריק'})`
                    ).join(', ');
                    executionReport.found.push(`תעודות: ${searchResults.documents.length} - ${docsInfo}`);
                } else {
                    executionReport.not_found.push('תעודות');
                }
            } else if (key === 'vehicles' && searchResults.vehicles) {
                if (searchResults.vehicles.length > 0) {
                    executionReport.found.push(`רכבים: ${searchResults.vehicles.length} - ${searchResults.vehicles.join(', ')}`);
                } else {
                    executionReport.not_found.push('רכבים');
                }
            } else if (searchResults[key]) {
                executionReport.found.push(`${key}: ${JSON.stringify(searchResults[key]).substring(0, 50)}`);
            } else {
                executionReport.not_found.push(key);
            }
        });

        // ✨ חדש! טיפול בשגיאות לתעודות חסרות
        if (structure.has_doc) {
            const foundDocsCount = searchResults.documents ? searchResults.documents.length : 0;
            const ocrUnidentified = ocrFields.UnidentifiedNumbers || [];

            // ספור כמה BOOKNUM נמצאו ב-OCR
            const booknumPattern = /^10\d{7}$/;
            let expectedDocsCount = 0;

            if (typeof ocrUnidentified[0] === 'object' && ocrUnidentified[0].value) {
                expectedDocsCount = ocrUnidentified.filter(item =>
                    booknumPattern.test(item.value)
                ).length;
            } else {
                expectedDocsCount = ocrUnidentified.filter(num =>
                    booknumPattern.test(num)
                ).length;
            }

            // טיפול בשגיאות
            if (foundDocsCount === 0) {
                // אף תעודה לא נמצאה
                if (expectedDocsCount > 0) {
                    executionReport.errors.push(
                        `תבנית דורשת תעודות. נמצאו ${expectedDocsCount} BOOKNUM ב-OCR אך לא נמצאה התאמה ב-docs_list`
                    );
                } else {
                    executionReport.errors.push(
                        'תבנית דורשת תעודות אך לא נמצאו BOOKNUM ב-OCR'
                    );
                }
            } else if (expectedDocsCount > 0 && foundDocsCount < expectedDocsCount) {
                // נמצאו תעודות חלקיות
                executionReport.warnings.push(
                    `נמצאו רק ${foundDocsCount} מתוך ${expectedDocsCount} תעודות מה-OCR. חסרות ${expectedDocsCount - foundDocsCount} תעודות`
                );
            }
        }

        // ============================================================================
        // שלב 4: בניית JSON
        // ============================================================================

        executionReport.stage = "שלב 4: בניית חשבונית";

        const invoice = buildInvoiceFromTemplate(
            template,
            structure,
            config,
            searchResults,
            input.learned_config,
            ocrFields,  // ✨ חדש! מעביר גם את ocrFields
            input.docs_list  // ✨ חדש! מעביר גם את docs_list
        );

        // ============================================================================
        // שלב 5: בקרות
        // ============================================================================

        executionReport.stage = "שלב 5: בקרות";

        const validation = performValidation(
            invoice,
            ocrFields,
            config,
            input.docs_list,
            patterns
        );

        // ============================================================================
        // שלב 6: ניתוח למידה
        // ============================================================================

        executionReport.stage = "שלב 6: ניתוח למידה";

        const learningAnalysis = analyzeLearning(invoice, config);

        // ============================================================================
        // שלב 7: ניקוי והחזרת תוצאה
        // ============================================================================

        // ניקוי שדות שלא צריכים (למידה בלבד, לא ל-Priority)
        const cleanedInvoice = cleanInvoiceForPriority(invoice);

        // ============================================================================
        // שלב 8: יצירת פלטים נוספים - לכל תבנית אפשרית!
        // ============================================================================

        // פלט 1: חשבוניות לכל התבניות
        const allInvoices = [];
        for (let i = 0; i < config.structure.length; i++) {
            const templateStructure = config.structure[i];
            const templateData = input.learned_config.template.PINVOICES[i];

            const tempInvoice = buildInvoiceFromTemplate(
                templateData,
                templateStructure,
                config,
                searchResults,
                input.learned_config,
                ocrFields,
                input.docs_list
            );

            const cleanedTempInvoice = cleanInvoiceForPriority(tempInvoice);
            allInvoices.push(cleanedTempInvoice);
        }

        // פלט 2: הנחיות ל-LLM - לכל תבנית
        const allLlmPrompts = [];
        const allTechnicalConfigs = [];

        for (let i = 0; i < config.structure.length; i++) {
            const templateStructure = config.structure[i];

            allLlmPrompts.push(generateLLMPrompt(
                config,
                ocrFields,
                searchResults,
                executionReport,
                i,
                templateStructure,
                documentPatterns  // ✨ חדש! העברת תבניות תעודות
            ));

            allTechnicalConfigs.push(generateTechnicalConfig(
                config,
                ocrFields,
                searchResults,
                executionReport,
                i,
                templateStructure,
                documentPatterns  // ✨ חדש! העברת תבניות תעודות
            ));
        }

        // פלט 2: הנחיות לתבנית שנבחרה (לנוחות)
        const selectedLlmPrompt = allLlmPrompts[templateIndex];
        const selectedTechnicalConfig = allTechnicalConfigs[templateIndex];

        // פלט 3: סצנריו עיבוד - מה MAKE צריך לשלוף מהמערכת - לכל תבנית!
        const hasVehicles = vehicleRules &&
                           vehicleRules.vehicle_account_mapping &&
                           Object.keys(vehicleRules.vehicle_account_mapping).length > 0;

        const allProcessingScenarios = [];
        for (let i = 0; i < config.structure.length; i++) {
            const templateStructure = config.structure[i];

            // ✨ קביעת document_type לפי התבנית
            let documentTypeKey = "regular_invoice";
            if (templateStructure.has_import && templateStructure.has_doc) {
                documentTypeKey = "import_with_docs_invoice";
            } else if (templateStructure.has_import) {
                documentTypeKey = "import_invoice";
            } else if (templateStructure.has_doc) {
                documentTypeKey = "docs_invoice";
            } else if (templateStructure.debit_type === "C") {
                documentTypeKey = "credit_note";
            } else if (hasVehicles) {
                documentTypeKey = "vehicle_service_invoice";
            }

            allProcessingScenarios.push({
                document_type: documentTypeKey,  // ✨ הוספה!
                check_docs: templateStructure.has_doc || false,
                check_import: templateStructure.has_import || false,
                check_vehicles: hasVehicles || false
            });
        }

        const selectedProcessingScenario = allProcessingScenarios[templateIndex];

        // ✨ מבנה חדש: supplier_code/name ברמה עליונה, הכל האחר תחת all_templates
        const supplierCode = config.supplier_config.supplier_code;
        const supplierName = config.supplier_config.supplier_name;

        // בניית all_templates עבור llm_prompt - עם invoice_data!
        const llmTemplates = allLlmPrompts.map((prompt, idx) => {
            const { supplier_code, supplier_name, ...rest } = prompt;
            return {
                ...rest,
                invoice_data: {
                    PINVOICES: [allInvoices[idx]]
                }
            };
        });

        // בניית all_templates עבור technical_config
        const technicalTemplates = allTechnicalConfigs.map(cfg => {
            const { supplier_code, supplier_name, ...rest } = cfg;
            return rest;
        });

        return {
            status: "success",

            // 1. הנחיות ל-LLM - supplier_code/name ברמה עליונה, הכל האחר תחת all_templates
            llm_prompt: {
                supplier_code: supplierCode,
                supplier_name: supplierName,
                all_templates: llmTemplates
            },

            // 2. קונפיג טכני - supplier_code/name ברמה עליונה, הכל האחר תחת all_templates
            technical_config: {
                supplier_code: supplierCode,
                supplier_name: supplierName,
                all_templates: technicalTemplates
            },

            // 3. סצנריו עיבוד - supplier_code/name ברמה עליונה, הכל האחר תחת all_templates
            processing_scenario: {
                supplier_code: supplierCode,
                supplier_name: supplierName,
                all_templates: allProcessingScenarios
            }
        };

    } catch (error) {
        return {
            status: "error",
            error_type: error.name || "ProcessingError",
            message: error.message
        };
    }
}

// ============================================================================
// פונקציות עזר - שלב 1
// ============================================================================

function checkImportExists(importFiles) {
    if (!importFiles || !importFiles.IMPFILES) return false;
    if (importFiles.IMPFILES.length === 0) return false;

    try {
        const parsed = JSON.parse('[' + importFiles.IMPFILES[0] + ']');
        return parsed.length > 0 && !!parsed[0].IMPFNUM;
    } catch (e) {
        return false;
    }
}

function checkDocsExist(docsList) {
    if (!docsList || docsList.DOC_YES_NO !== "Y") return false;
    return docsList.list_of_docs && docsList.list_of_docs.length > 0;
}

function checkDocsInOCR(ocrFields, azureText) {
    const unidentified = ocrFields.UnidentifiedNumbers || [];
    const docPattern = /^25\d{6}$/;          // DOCNO pattern
    const booknumPattern = /^10\d{7}$/;     // BOOKNUM pattern (10XXXXXXX - 9 digits starting with 10)

    let foundInUnidentified = false;

    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            foundInUnidentified = unidentified.some(item =>
                docPattern.test(item.value) || booknumPattern.test(item.value)
            );
        } else {
            foundInUnidentified = unidentified.some(num =>
                docPattern.test(num) || booknumPattern.test(num)
            );
        }
    }

    if (foundInUnidentified) return true;

    if (azureText) {
        // Search for both DOCNO and BOOKNUM patterns with word boundaries
        const docMatches = azureText.match(/\b25\d{6}\b/g);
        const booknumMatches = azureText.match(/\b10\d{7}\b/g);
        if ((docMatches && docMatches.length > 0) || (booknumMatches && booknumMatches.length > 0)) {
            return true;
        }
    }

    return false;
}

// ✨ פונקציה חדשה: זיהוי דינמי של תבניות תעודות
function detectDocumentPatterns(ocrFields, azureText) {
    const detected = {
        booknum_found: [],
        docno_found: [],
        booknum_pattern: null,
        docno_pattern: null,
        guidance: ""
    };

    const unidentified = ocrFields.UnidentifiedNumbers || [];

    // חפש BOOKNUM ב-UnidentifiedNumbers
    if (unidentified.length > 0) {
        const values = typeof unidentified[0] === 'object'
            ? unidentified.map(item => item.value).filter(v => v)
            : unidentified;

        // תבניות אפשריות ל-BOOKNUM (10XXXXXXX - 9 ספרות שמתחילות ב-10)
        values.forEach(val => {
            if (/^10\d{7}$/.test(val)) {
                detected.booknum_found.push(val);
            }
            if (/^25\d{6}$/.test(val)) {
                detected.docno_found.push(val);
            }
        });
    }

    // חפש גם ב-AZURE_TEXT אם לא נמצא ב-UnidentifiedNumbers
    if (detected.booknum_found.length === 0 && azureText) {
        const booknumMatches = azureText.match(/\b10\d{7}\b/g);
        if (booknumMatches) {
            detected.booknum_found = [...new Set(booknumMatches)]; // unique values
        }
    }

    if (detected.docno_found.length === 0 && azureText) {
        const docnoMatches = azureText.match(/\b25\d{6}\b/g);
        if (docnoMatches) {
            detected.docno_found = [...new Set(docnoMatches)];
        }
    }

    // זהה את התבנית המדויקת על פי מה שנמצא
    if (detected.booknum_found.length > 0) {
        const firstBooknum = detected.booknum_found[0];
        const prefix = firstBooknum.substring(0, 3); // 107 או 108

        detected.booknum_pattern = `\\b(${prefix}\\d{6})\\b`;
        detected.guidance = `🔍 זוהתה תבנית BOOKNUM: ${prefix}XXXXXX (${detected.booknum_found.length} דוגמאות: ${detected.booknum_found.slice(0, 3).join(', ')})`;

        console.log(`✨ ${detected.guidance}`);
    }

    if (detected.docno_found.length > 0) {
        detected.docno_pattern = `\\b(25\\d{6})\\b`;
        console.log(`✨ זוהתה תבנית DOCNO: 25XXXXXX (${detected.docno_found.length} דוגמאות: ${detected.docno_found.slice(0, 3).join(', ')})`);
    }

    return detected;
}

function identifyDebitType(ocrFields) {
    const total = ocrFields.InvoiceTotal || ocrFields.InvoiceTotal_amount || 0;
    return total >= 0 ? "D" : "C";
}

function findMatchingTemplate(structures, hasImport, hasDocs, debitType) {
    console.log(`🔍 מחפש תבנית: has_import=${hasImport}, has_doc=${hasDocs}, debit_type=${debitType}`);
    console.log(`📋 תבניות זמינות: ${structures.length}`);

    structures.forEach((s, i) => {
        console.log(`  תבנית ${i}: has_import=${s.has_import}, has_doc=${s.has_doc}, debit_type=${s.debit_type}`);
    });

    const index = structures.findIndex(s =>
        s.has_import === hasImport &&
        s.has_doc === hasDocs &&
        s.debit_type === debitType
    );

    console.log(`✅ תבנית שנמצאה: index=${index}`);
    return index;
}

// ============================================================================
// פונקציות עזר - שלב 2
// ============================================================================

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

        if (sample.sample_ivnum) {
            patterns.ivnum_pattern = {
                length: sample.sample_ivnum.length,
                example: sample.sample_ivnum
            };
        }
    }

    if (docsList && docsList.list_of_docs && docsList.list_of_docs.length > 0) {
        try {
            const docs = docsList.list_of_docs.map(d => JSON.parse(d));

            if (docs.length > 0) {
                const firstDoc = docs[0];
                patterns.docs_pattern = {
                    booknum_example: firstDoc.BOOKNUM,
                    docno_example: firstDoc.DOCNO
                };

                docs.forEach(doc => {
                    if (doc.TOTQUANT) {
                        patterns.docs_totquant[doc.BOOKNUM] = doc.TOTQUANT;
                    }
                });
            }
        } catch (e) {
            // שגיאה בפרסור
        }
    }

    return patterns;
}

// ============================================================================
// פונקציות עזר - שלב 3
// ============================================================================

function searchAllData(ocrFields, azureText, patterns, structure, importFiles, docsList, vehicleRules) {
    return {
        booknum: searchBooknum(ocrFields, patterns),
        ivdate: searchIvdate(ocrFields),
        details: searchDetails(ocrFields, azureText),
        ordname: structure.has_purchase_orders || structure.has_import ? searchOrdname(ocrFields) : null,
        impfnum: structure.has_import ? searchImpfnum(ocrFields, importFiles) : null,
        documents: structure.has_doc ? searchDocuments(ocrFields, azureText, patterns, docsList) : null,
        vehicles: vehicleRules ? extractVehiclesAdvanced(ocrFields, vehicleRules, azureText) : [],  // ✨ חדש! + fallback ל-AZURE_TEXT
        items: ocrFields.Items || []
    };
}

function searchBooknum(ocrFields, patterns) {
    let booknum = ocrFields.InvoiceId || "";

    booknum = String(booknum).replace(/^SI/i, '');

    if (patterns.booknum_pattern) {
        const expectedLength = patterns.booknum_pattern.length;
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
    let found = "";

    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            const orderItem = unidentified.find(item =>
                item.label && (
                    item.label.includes('הזמנה') ||
                    item.label.toLowerCase().includes('order') ||
                    item.label.toLowerCase().includes('po')
                ) && ordPattern.test(item.value)
            );

            if (orderItem) {
                found = orderItem.value;
            } else {
                const anyOrder = unidentified.find(item =>
                    ordPattern.test(item.value)
                );
                found = anyOrder ? anyOrder.value : "";
            }
        } else {
            const match = unidentified.find(num => ordPattern.test(num));
            found = match || "";
        }
    }

    return found;
}

function searchImpfnum(ocrFields, importFiles) {
    const unidentified = ocrFields.UnidentifiedNumbers || [];
    const impPattern = /^\d{2}c\d{5}$/;
    let foundInOCR = "";

    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            const importItem = unidentified.find(item =>
                item.label && (
                    item.label.includes('יבוא') ||
                    item.label.toLowerCase().includes('import') ||
                    item.label.includes('IMPFNUM')
                ) && impPattern.test(item.value)
            );

            if (importItem) {
                foundInOCR = importItem.value;
            } else {
                const anyImport = unidentified.find(item =>
                    impPattern.test(item.value)
                );
                foundInOCR = anyImport ? anyImport.value : "";
            }
        } else {
            const match = unidentified.find(num => impPattern.test(num));
            foundInOCR = match || "";
        }
    }

    if (foundInOCR) return foundInOCR;

    if (importFiles && importFiles.IMPFILES && importFiles.IMPFILES.length > 0) {
        try {
            const parsed = JSON.parse('[' + importFiles.IMPFILES[0] + ']');
            if (parsed.length > 0 && parsed[0].IMPFNUM) {
                return parsed[0].IMPFNUM;
            }
        } catch (e) {
            // ממשיכים בלי
        }
    }

    return "";
}

function searchDocuments(ocrFields, azureText, patterns, docsList) {
    const foundDocs = [];

    if (!docsList || !docsList.list_of_docs || docsList.list_of_docs.length === 0) {
        return foundDocs;
    }

    let availableDocs = [];
    try {
        // תיקון: flatMap כדי לשטח מערכים מקוננים
        availableDocs = docsList.list_of_docs.flatMap(d => JSON.parse(d));
    } catch (e) {
        return foundDocs;
    }

    const unidentified = ocrFields.UnidentifiedNumbers || [];

    if (unidentified.length > 0) {
        if (typeof unidentified[0] === 'object' && unidentified[0].value) {
            for (const item of unidentified) {
                const match = availableDocs.find(doc => doc.BOOKNUM === item.value);

                if (match) {
                    foundDocs.push({
                        DOCNO: match.DOCNO,
                        BOOKNUM: match.BOOKNUM,
                        TOTQUANT: match.TOTQUANT || null
                    });
                }
            }
        } else {
            for (const num of unidentified) {
                const match = availableDocs.find(doc => doc.BOOKNUM === num);

                if (match) {
                    foundDocs.push({
                        DOCNO: match.DOCNO,
                        BOOKNUM: match.BOOKNUM,
                        TOTQUANT: match.TOTQUANT || null
                    });
                }
            }
        }
    }

    // Fallback: אם לא נמצא ב-UnidentifiedNumbers, חפש ב-AZURE_TEXT
    if (foundDocs.length === 0 && azureText) {
        for (const doc of availableDocs) {
            // שיפור: חיפוש עם regex במקום includes (מדויק יותר)
            // תבנית: גבול מילה + BOOKNUM + גבול מילה (כדי למנוע התאמה חלקית)
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

    // ✨ חדש! Fallback 2: התאמה לפי כמויות כשהOCR לא מצא תעודות
    if (foundDocs.length === 0 && ocrFields.Items && ocrFields.Items.length > 0) {
        const totalOcrQuantity = ocrFields.Items.reduce((sum, item) => sum + (item.Quantity || 0), 0);

        if (totalOcrQuantity > 0) {
            // פונקציית עזר להשוואת כמויות עם סובלנות
            const isQuantityMatch = (qty1, qty2) => {
                if (qty1 === qty2) return true;
                const tolerance = Math.min(Math.abs(qty1 * 0.005), 10);
                return Math.abs(qty1 - qty2) <= tolerance;
            };

            // נסה למצוא תעודה בודדת שמתאימה (עם סובלנות)
            const singleMatch = availableDocs.find(doc => isQuantityMatch(doc.TOTQUANT, totalOcrQuantity));
            if (singleMatch) {
                foundDocs.push({
                    DOCNO: singleMatch.DOCNO,
                    BOOKNUM: singleMatch.BOOKNUM,
                    TOTQUANT: singleMatch.TOTQUANT || null
                });
            }
            // אם לא נמצא תעודה בודדת, נסה לחפש קומבינציה של מספר תעודות
            else {
                const matchedDocs = findDocCombinationByQuantity(totalOcrQuantity, availableDocs);
                if (matchedDocs.length > 0) {
                    foundDocs.push(...matchedDocs);
                }
            }
        }
    }

    return foundDocs;
}

// ============================================================================
// ✨ חדש! פונקציה למציאת קומבינציה של תעודות לפי כמות
// ============================================================================

function findDocCombinationByQuantity(targetQuantity, availableDocs) {
    // אם אין תעודות או כמות יעד לא תקינה
    if (!availableDocs || availableDocs.length === 0 || targetQuantity <= 0) {
        return [];
    }

    // פונקציית עזר להשוואת כמויות עם סובלנות קטנה
    const isQuantityMatch = (qty1, qty2) => {
        // התאמה מדויקת
        if (qty1 === qty2) return true;

        // סובלנות של 0.5% או 10 יחידות (הקטן מביניהם)
        const tolerance = Math.min(Math.abs(qty1 * 0.005), 10);
        return Math.abs(qty1 - qty2) <= tolerance;
    };

    // נסה כל קומבינציה אפשרית (עד 4 תעודות מקסימום)
    const maxCombinationSize = Math.min(4, availableDocs.length);

    for (let size = 2; size <= maxCombinationSize; size++) {
        const combinations = getCombinations(availableDocs, size);

        for (const combo of combinations) {
            const comboTotal = combo.reduce((sum, doc) => sum + (doc.TOTQUANT || 0), 0);

            if (isQuantityMatch(comboTotal, targetQuantity)) {
                // נמצאה קומבינציה מתאימה!
                return combo.map(doc => ({
                    DOCNO: doc.DOCNO,
                    BOOKNUM: doc.BOOKNUM,
                    TOTQUANT: doc.TOTQUANT || null
                }));
            }
        }
    }

    return [];
}

// פונקציית עזר לחישוב קומבינציות
function getCombinations(array, size) {
    if (size === 1) {
        return array.map(item => [item]);
    }

    const combinations = [];

    for (let i = 0; i < array.length - size + 1; i++) {
        const head = array[i];
        const tailCombos = getCombinations(array.slice(i + 1), size - 1);

        for (const combo of tailCombos) {
            combinations.push([head, ...combo]);
        }
    }

    return combinations;
}

// ============================================================================
// ✨ חדש! פונקציות חילוץ רכבים מתקדם
// ============================================================================

function extractVehiclesAdvanced(ocrFields, vehicleRules, azureText) {
    // תיקון: בדוק אם יש vehicle_account_mapping במקום enabled
    if (!vehicleRules || !vehicleRules.vehicle_account_mapping) return [];

    const foundVehicles = [];
    // תיקון: אם אין search_locations, השתמש בברירת מחדל
    const searchLocations = vehicleRules.search_locations || [
        {
            location: "fields.UnidentifiedNumbers",
            priority: 1,
            filter_by_label: "רכב",
            description: "חיפוש רכבים ב-UnidentifiedNumbers עם תווית רכב"
        }
    ];

    // סדר לפי עדיפות
    const sortedLocations = [...searchLocations].sort((a, b) => a.priority - b.priority);

    for (const location of sortedLocations) {
        if (location.location === "fields.VehicleNumbers") {
            // 1. רשימה מוכנה מאז'ור
            if (ocrFields.VehicleNumbers && Array.isArray(ocrFields.VehicleNumbers)) {
                ocrFields.VehicleNumbers.forEach(vNum => {
                    if (!foundVehicles.includes(vNum)) {
                        foundVehicles.push(vNum);
                    }
                });
            }
        }
        else if (location.location === "fields.Items[].VehicleNumber") {
            // 2. קישור ישיר בפריט
            if (ocrFields.Items && Array.isArray(ocrFields.Items)) {
                ocrFields.Items.forEach(item => {
                    if (item.VehicleNumber && !foundVehicles.includes(item.VehicleNumber)) {
                        foundVehicles.push(item.VehicleNumber);
                    }
                });
            }
        }
        else if (location.location === "fields.Items[].Description" && location.pattern) {
            // 3. חיפוש בתיאור לפי דפוס
            if (ocrFields.Items && Array.isArray(ocrFields.Items)) {
                const pattern = new RegExp(location.pattern);
                ocrFields.Items.forEach(item => {
                    if (item.Description) {
                        const match = item.Description.match(pattern);
                        if (match && match[0] && !foundVehicles.includes(match[0])) {
                            foundVehicles.push(match[0]);
                        }
                    }
                });
            }
        }
        else if (location.location === "fields.UnidentifiedNumbers") {
            // 4. מספרים לא מזוהים
            const unidentified = ocrFields.UnidentifiedNumbers || [];
            const vehiclePattern = /\d{3}-\d{2}-\d{3}/;

            unidentified.forEach(item => {
                const value = typeof item === 'object' ? item.value : item;
                const label = typeof item === 'object' ? (item.label || '') : '';
                const context = typeof item === 'object' ? (item.context || '') : '';

                // תיקון: גם אם יש תווית "רכב", חייב להתאים לדפוס מספר רכב!
                // זה מונע טעויות של Azure OCR שמסמן מספר כרטיס בתור "מספר רכב"
                const isValidVehicleNumber = vehiclePattern.test(value);

                // בדיקה נוספת: אם בהקשר כתוב "כרטיס", זה לא רכב
                const looksLikeCardNumber = context.includes('כרטיס') || label.includes('כרטיס');

                // אם יש filter_by_label - רק עם התווית הזו וגם דפוס תקין
                if (location.filter_by_label) {
                    if (label && label.includes(location.filter_by_label)) {
                        // תיקון: גם עם תווית רכב, חייב דפוס תקין ולא להיות מסומן ככרטיס
                        if (isValidVehicleNumber && !looksLikeCardNumber && !foundVehicles.includes(value)) {
                            foundVehicles.push(value);
                        }
                    }
                } else {
                    // אחרת - לפי דפוס רכב בלבד
                    if (isValidVehicleNumber && !looksLikeCardNumber && !foundVehicles.includes(value)) {
                        foundVehicles.push(value);
                    }
                }
            });
        }
    }

    // ✨ חדש! אם לא נמצאו רכבים, חפש גם ב-AZURE_TEXT
    if (foundVehicles.length === 0 && azureText) {
        console.log("⚠️  לא נמצאו רכבים במקומות המובנים - מחפש ב-AZURE_TEXT...");
        const vehiclePattern = /\d{3}-\d{2}-\d{3}/g;
        const matches = azureText.match(vehiclePattern) || [];

        matches.forEach(match => {
            if (!foundVehicles.includes(match)) {
                // בדוק שזה לא מופיע ליד המילה "כרטיס"
                const contextStart = Math.max(0, azureText.indexOf(match) - 20);
                const contextEnd = Math.min(azureText.length, azureText.indexOf(match) + match.length + 20);
                const context = azureText.substring(contextStart, contextEnd);

                if (!context.includes('כרטיס')) {
                    foundVehicles.push(match);
                    console.log(`✅ נמצא רכב ב-AZURE_TEXT: ${match}`);
                }
            }
        });
    }

    if (foundVehicles.length > 0) {
        console.log(`🚗 סה"כ נמצאו ${foundVehicles.length} רכבים:`, foundVehicles);
    }

    return [...new Set(foundVehicles)]; // ייחודיים בלבד
}

function createVehicleItems(vehicles, ocrItems, vehicleRules, ocrFields) {
    if (!vehicles || vehicles.length === 0) return [];

    const vehicleItems = [];

    // תיקון: מחיר = סכום כל החשבונית (לפני מע"מ)
    // חישוב: InvoiceTotal - TotalTax = סה"כ לפני מע"מ (עבודות + חלקים)
    const totalPrice = ocrFields.TotalTax_amount
        ? (ocrFields.InvoiceTotal_amount || 0) - ocrFields.TotalTax_amount
        : (ocrFields.SubTotal_amount || ocrFields.InvoiceTotal_amount || 0);
    const pricePerVehicle = vehicles.length > 0 ? totalPrice / vehicles.length : totalPrice;

    vehicles.forEach(vehicleNum => {
        // חיפוש מיפוי בחוקים
        const mapping = vehicleRules.vehicle_account_mapping?.[vehicleNum];

        // חיפוש תיאור מהפריטים של OCR
        const relatedItem = ocrItems.find(item =>
            (item.VehicleNumber && item.VehicleNumber === vehicleNum) ||
            (item.Description && item.Description.includes(vehicleNum))
        );

        // תיקון: תיאור קצר בלבד
        const shortDesc = extractShortDescription(ocrFields, vehicleNum);

        // ✨ בניית פריט - רק שדות שPriority מכיר!
        const item = {
            PARTNAME: vehicleRules.output_format?.partname || "car",
            PDES: shortDesc,
            TQUANT: relatedItem?.Quantity || 1,
            TUNITNAME: relatedItem?.Unit || "יח'",
            PRICE: pricePerVehicle,
            VATFLAG: mapping?.vat_pattern?.VATFLAG || "Y",
            ACCNAME: mapping?.accname || vehicleRules.default_values?.accname || ""
        };

        // ✨ BUDCODE - בינתיים ריק (לוגיקה לא מאופיינת)

        // ✨ SPECIALVATFLAG - רק אם זה Y (לא שדות אחרים!)
        if (mapping?.vat_pattern?.SPECIALVATFLAG === "Y") {
            item.SPECIALVATFLAG = "Y";
        }

        // שמור מידע למידה בנפרד (לא נשלח ל-Priority!)
        if (!mapping) {
            // רק לצרכי דיווח ולמידה - לא ישלח ב-JSON הסופי
            item._learningNote = "רכב חדש - נדרש מיפוי";
        }

        vehicleItems.push(item);
    });

    return vehicleItems;
}

// ============================================================================
// פונקציית עזר - חילוץ תיאור קצר
// ============================================================================

function extractShortDescription(ocrFields, vehicleNum) {
    // חיפוש תיאור קצר מהפריטים
    if (ocrFields.Items && ocrFields.Items.length > 0) {
        // חפש פריט שמכיל תיאור רלוונטי
        const item = ocrFields.Items.find(i =>
            i.Description && (
                i.Description.includes(vehicleNum) ||
                i.Description.includes('טיפול') ||
                i.Description.includes('עבודה')
            )
        );

        if (item && item.Description) {
            const desc = item.Description.trim();

            // תיקון חדש: חפש דפוס "טיפול XXX ק\"מ" או "טיפול XXX,XXX ק\"מ"
            // דפוס: "טיפול" + מספר (עם או בלי פסיק) + "ק\"מ" או "קמ"
            const servicePattern = /טיפול\s+[\d,]+\s*ק[״"]?מ/i;
            const match = desc.match(servicePattern);

            if (match) {
                // נמצא דפוס טיפול - נקה אותו ונחזיר
                let serviceDesc = match[0];
                // המר "קמ" ל-"ק"מ" והסר פסיקים מהמספר
                serviceDesc = serviceDesc
                    .replace(/,/g, '')          // הסר פסיקים
                    .replace(/קמ/g, 'ק"מ')      // תקנן את "קמ" ל-"ק"מ"
                    .replace(/ק״מ/g, 'ק"מ');   // תקנן את ״ ל-"

                return serviceDesc;
            }

            // אם לא נמצא דפוס טיפול - חפש תיאורים אחרים (החלפה, תיקון, בדיקה)
            const generalPattern = /(החלפת|תיקון|בדיקת|הח[''׳])\s+[\u0590-\u05FF\s]+/;
            const generalMatch = desc.match(generalPattern);

            if (generalMatch) {
                // קח עד 50 תווים מהתיאור
                let shortDesc = generalMatch[0].trim();
                if (shortDesc.length > 50) {
                    shortDesc = shortDesc.substring(0, 47) + '...';
                }
                return shortDesc;
            }

            // אם אין דפוס מיוחד - קח את 3-4 המילים הראשונות
            const words = desc.split(/\s+/);
            let shortDesc = words.slice(0, 4).join(' ');

            if (shortDesc.length > 50) {
                shortDesc = shortDesc.substring(0, 47) + '...';
            }

            return shortDesc;
        }
    }

    // אם לא מצאנו תיאור - החזר ברירת מחדל
    return 'טיפול';
}

// ============================================================================
// פונקציות עזר - שלב 4
// ============================================================================

function buildInvoiceFromTemplate(template, structure, config, searchResults, learnedConfig, ocrFields, docsList) {
    const invoice = {
        SUPNAME: config.supplier_config.supplier_code,
        CODE: template.CODE,
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

    // תיקון: DETAILS - יצירה חכמה לפי רכבים
    if (searchResults.vehicles && searchResults.vehicles.length > 0) {
        // אם יש רכבים - בנה DETAILS עם תיאור טיפול + ק"מ נוכחי
        const vehicleNum = searchResults.vehicles[0];
        const shortDesc = extractShortDescription(ocrFields, vehicleNum);

        // חיפוש ק"מ נוכחי מה-UnidentifiedNumbers או CustomerId
        let currentMileage = '';

        // נסה למצוא ק"מ ב-UnidentifiedNumbers
        const unidentified = ocrFields.UnidentifiedNumbers || [];
        if (unidentified.length > 0) {
            const mileageItem = unidentified.find(item => {
                if (typeof item === 'object') {
                    const label = item.label || '';
                    const value = item.value || '';
                    // חפש תווית "ק\"מ" או מספר בין 50000-300000 (טווח סביר לק"מ)
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

        // אם לא נמצא, נסה CustomerId (לפעמים Azure מזהה את ק"מ כ-CustomerId)
        if (!currentMileage && ocrFields.CustomerId && /^\d{5,6}$/.test(ocrFields.CustomerId)) {
            currentMileage = ocrFields.CustomerId;
        }

        // בנה DETAILS לפי הפורמט: "תיאור טיפול-XXXXXק\"מ"
        invoice.DETAILS = currentMileage ? `${shortDesc}-${currentMileage}` : shortDesc;
    } else if (searchResults.details) {
        // אחרת - השתמש ב-DETAILS הרגיל
        invoice.DETAILS = searchResults.details;
    }

    // תעודות
    if (structure.has_doc) {
        // אם מצאנו תעודות ב-OCR - השתמש בהן
        if (searchResults.documents && searchResults.documents.length > 0) {
            if (searchResults.documents.length === 1) {
                invoice.DOCNO = searchResults.documents[0].DOCNO;
            } else {
                invoice.PIVDOC_SUBFORM = searchResults.documents.map(d => ({
                    DOCNO: d.DOCNO,
                    BOOKNUM: d.BOOKNUM
                }));
            }
        }
        // אם לא מצאנו ב-OCR אבל יש ב-docs_list - קח מ-docs_list
        else if (docsList && docsList.DOC_YES_NO === "Y" && docsList.list_of_docs && docsList.list_of_docs.length > 0) {
            try {
                const docs = docsList.list_of_docs.flatMap(d => JSON.parse(d));
                if (docs.length === 1) {
                    invoice.DOCNO = docs[0].DOCNO;
                } else if (docs.length > 1) {
                    invoice.PIVDOC_SUBFORM = docs.map(d => ({
                        DOCNO: d.DOCNO,
                        BOOKNUM: d.BOOKNUM
                    }));
                }
            } catch (e) {
                // אם יש שגיאת parsing, המשך בלי תעודות
            }
        }
    }

    // פריטים
    const needItems = shouldAddItems(structure, searchResults.documents, docsList);

    if (needItems) {
        const vehicleRules = config.rules?.critical_patterns?.vehicle_rules;

        // ✨ חדש! אם יש רכבים - יוצרים פריטי רכבים
        if (searchResults.vehicles && searchResults.vehicles.length > 0 && vehicleRules) {
            invoice.PINVOICEITEMS_SUBFORM = createVehicleItems(
                searchResults.vehicles,
                searchResults.items,
                vehicleRules,
                ocrFields  // תיקון: העברת ocrFields
            );
        }
        // אחרת - פריטים רגילים מ-OCR
        else if (searchResults.items && searchResults.items.length > 0) {
            invoice.PINVOICEITEMS_SUBFORM = buildItems(
                searchResults.items,
                config,
                structure,
                template,
                learnedConfig
            );
        }
    }

    if (template.PINVOICESCONT_SUBFORM) {
        invoice.PINVOICESCONT_SUBFORM = template.PINVOICESCONT_SUBFORM;
    }

    return invoice;
}

function shouldAddItems(structure, documents, docsList) {
    // אם אין תעודות בכלל בתבנית → צריך פריטים
    if (!structure.has_doc) return true;

    // בדוק אם יש תעודות בפועל (ב-OCR או ב-docs_list)
    const hasDocsInOCR = documents && documents.length > 0;
    const hasDocsInList = docsList && docsList.DOC_YES_NO === "Y";
    const hasDocsActually = hasDocsInOCR || hasDocsInList;

    // אם התבנית אומרת שיש תעודות אבל אין בפועל → צריך פריטים
    if (structure.has_doc && !hasDocsActually) return true;

    // אם יש תעודות בפועל:
    if (hasDocsActually) {
        // אם יש גם יבוא → לא צריך פריטים (הכל בתעודות)
        if (structure.has_import) return false;

        // אם אין יבוא אבל יש מלאי לא מנוהל → צריך פריטים
        if (structure.inventory_management === "not_managed_inventory") return true;
    }

    // אחרת → לא צריך פריטים
    return false;
}

function buildItems(ocrItems, config, structure, template, learnedConfig) {
    // ✨ תיקון: קח את הפריט הראשון מהתבנית כבסיס
    const templateItem = template.PINVOICEITEMS_SUBFORM?.[0] || {};

    return ocrItems.map(ocrItem => {
        // ✨ התחל עם השדות מהתבנית (קבועים ללמידה)
        const item = {
            PARTNAME: templateItem.PARTNAME || "",          // מהתבנית ✅
            TUNITNAME: templateItem.TUNITNAME || "יח'",     // מהתבנית ✅
            VATFLAG: templateItem.VATFLAG || "Y",           // מהתבנית ✅
            ACCNAME: templateItem.ACCNAME || "",            // מהתבנית ✅

            // ✨ דרוס עם נתונים דינמיים מ-OCR
            PDES: ocrItem.Description || "",                // מ-OCR ✅
            TQUANT: ocrItem.Quantity || 1,                  // מ-OCR ✅
            PRICE: ocrItem.UnitPrice || ocrItem.UnitPrice_amount || 0  // מ-OCR ✅
        };

        // ✨ הוסף SPECIALVATFLAG רק אם זה "Y" בתבנית
        if (templateItem.SPECIALVATFLAG === "Y") {
            item.SPECIALVATFLAG = "Y";
        }

        // ✨ BUDCODE - בינתיים ריק (לוגיקה לא מאופיינת)

        return item;
    });
}

// ✨ פונקציות applyVehicleRules() ו-applyPartnameRules() הוסרו
// הלוגיקה עברה ל-createVehicleItems() ול-buildItems() בהתאמה

// ============================================================================
// פונקציות עזר - שלב 5 (בקרות)
// ============================================================================

function performValidation(invoice, ocrFields, config, docsList, patterns) {
    const warnings = [];
    const checks = {};

    let invoiceTotquant = 0;
    if (invoice.PINVOICEITEMS_SUBFORM) {
        invoiceTotquant = invoice.PINVOICEITEMS_SUBFORM.reduce(
            (sum, item) => sum + (item.TQUANT || 0),
            0
        );
    }

    let docsTotquant = 0;
    if (docsList && docsList.list_of_docs) {
        try {
            const docs = docsList.list_of_docs.map(d => JSON.parse(d));
            docsTotquant = docs.reduce((sum, d) => sum + (d.TOTQUANT || 0), 0);
        } catch (e) {
            // ממשיכים בלי
        }
    }

    const learnedTotquant = config.rules.validation_data.TOTQUANT || 0;

    checks.totquant = {
        invoice_items_sum: invoiceTotquant,
        docs_sum: docsTotquant,
        learned_reference: learnedTotquant,
        items_vs_docs_match: invoiceTotquant === docsTotquant || docsTotquant === 0,
        notes: []
    };

    if (invoiceTotquant !== docsTotquant && docsTotquant > 0) {
        warnings.push(`אי התאמת כמויות: פריטים=${invoiceTotquant}, תעודות=${docsTotquant}`);
        checks.totquant.notes.push("אי התאמה בין פריטים לתעודות");
    }

    if (patterns.booknum_pattern) {
        const expected = patterns.booknum_pattern.length;
        const actual = invoice.BOOKNUM.length;

        checks.booknum_pattern = {
            expected_length: expected,
            actual_length: actual,
            match: expected === actual,
            pattern_example: patterns.booknum_pattern.example
        };

        if (expected !== actual) {
            warnings.push(`דפוס BOOKNUM: צפוי ${expected} ספרות, קיבלנו ${actual}`);
        }
    }

    const requiredFields = ["SUPNAME", "CODE", "DEBIT", "IVDATE", "BOOKNUM"];
    const missingFields = requiredFields.filter(f => !invoice[f]);

    if (missingFields.length > 0) {
        warnings.push(`שדות חובה חסרים: ${missingFields.join(', ')}`);
    }

    if (invoice.PINVOICEITEMS_SUBFORM) {
        const emptyAccounts = invoice.PINVOICEITEMS_SUBFORM.filter(
            item => !item.ACCNAME || item.ACCNAME === ""
        );

        if (emptyAccounts.length > 0) {
            warnings.push(`${emptyAccounts.length} פריטים ללא ACCNAME`);
        }
    }

    return {
        all_valid: warnings.length === 0,
        checks: checks,
        warnings: warnings
    };
}

// ============================================================================
// פונקציות עזר - שלב 6 (למידה)
// ============================================================================

function analyzeLearning(invoice, config) {
    const newPatterns = {
        new_partnames: [],
        new_vehicles: [],
        unknown_accounts: []
    };

    const instructions = [];

    if (invoice.PINVOICEITEMS_SUBFORM) {
        invoice.PINVOICEITEMS_SUBFORM.forEach(item => {
            const partnameKnown = config.rules.critical_patterns.partname_rules &&
                                config.rules.critical_patterns.partname_rules[item.PARTNAME];

            if (!partnameKnown && item.PARTNAME !== "car") {
                newPatterns.new_partnames.push({
                    partname: item.PARTNAME,
                    pdes: item.PDES,
                    suggested_accname: item.ACCNAME
                });

                instructions.push({
                    type: "add_partname_rule",
                    partname: item.PARTNAME,
                    suggested_accname: item.ACCNAME,
                    priority: "medium"
                });
            }

            // ✨ חדש! זיהוי רכב חדש
            if (item.PARTNAME === "car" || item.isNewVehicle) {
                const vehicleMatch = item.PDES.match(/\d{3}-\d{2}-\d{3}/);
                if (vehicleMatch) {
                    const vNum = vehicleMatch[0];
                    const vehicleKnown = config.rules?.critical_patterns?.vehicle_rules?.vehicle_account_mapping?.[vNum];

                    if (!vehicleKnown || item.isNewVehicle) {
                        newPatterns.new_vehicles.push({
                            vehicle_number: vNum,
                            suggested_accname: item.ACCNAME,
                            suggested_budcode: item.BUDCODE,
                            suggested_vatflag: item.VATFLAG
                        });

                        instructions.push({
                            type: "add_vehicle_rule",
                            vehicle_number: vNum,
                            suggested_accname: item.ACCNAME,
                            suggested_budcode: item.BUDCODE,
                            priority: "high"
                        });
                    }
                }
            }

            if (!item.ACCNAME || item.ACCNAME === "") {
                newPatterns.unknown_accounts.push({
                    partname: item.PARTNAME,
                    pdes: item.PDES
                });

                instructions.push({
                    type: "missing_account",
                    partname: item.PARTNAME,
                    priority: "critical"
                });
            }
        });
    }

    const learningRequired =
        newPatterns.new_partnames.length > 0 ||
        newPatterns.new_vehicles.length > 0 ||
        newPatterns.unknown_accounts.length > 0;

    return {
        learning_required: learningRequired,
        new_patterns: newPatterns,
        learning_instructions: instructions,
        recommendation: learningRequired ? "שלח לקוד 3 ללמידה" : "אין צורך בלמידה"
    };
}

// ============================================================================
// פונקציות עזר - שלב 7 (יצירת פלטים נוספים)
// ============================================================================

function generateLLMPrompt(config, ocrFields, searchResults, executionReport, templateIndex, structure, documentPatterns = null) {
    const supplierCode = config.supplier_config.supplier_code;
    const supplierName = config.supplier_config.supplier_name;

    // בניית הסבר על כל שדה
    const fieldInstructions = {};

    // BOOKNUM
    fieldInstructions.booknum = {
        field_name: "BOOKNUM",
        description: "מספר חשבונית",
        how_to_find: "חפש בשדה InvoiceId ב-OCR. הסר קידומת SI אם קיימת. קח את מספר התווים האחרונים לפי הדפוס הנלמד.",
        example: searchResults.booknum || "1015938",
        ocr_source: "ocrFields.InvoiceId"
    };

    // IVDATE
    fieldInstructions.ivdate = {
        field_name: "IVDATE",
        description: "תאריך חשבונית",
        how_to_find: "קח את InvoiceDate מה-OCR והמר לפורמט DD/MM/YY",
        example: searchResults.ivdate || "10/09/25",
        ocr_source: "ocrFields.InvoiceDate"
    };

    // PRICE - חשוב!
    fieldInstructions.price = {
        field_name: "PRICE",
        description: "מחיר לפני מע\"מ (עבודות + חלקים)",
        how_to_calculate: "חשב: InvoiceTotal_amount - TotalTax_amount. זה נותן את סה\"כ החשבונית לפני מע\"מ.",
        formula: "InvoiceTotal_amount - TotalTax_amount",
        example: ocrFields.InvoiceTotal_amount && ocrFields.TotalTax_amount
            ? `${ocrFields.InvoiceTotal_amount} - ${ocrFields.TotalTax_amount} = ${ocrFields.InvoiceTotal_amount - ocrFields.TotalTax_amount}`
            : "2524 - 385.02 = 2138.98",
        fallback: "אם אין TotalTax_amount, קח SubTotal_amount. אם גם זה לא קיים, קח InvoiceTotal_amount.",
        ocr_source: "ocrFields.InvoiceTotal_amount, ocrFields.TotalTax_amount"
    };

    // VEHICLES
    const vehicleRules = config.rules?.critical_patterns?.vehicle_rules;
    if (vehicleRules) {
        fieldInstructions.vehicles = {
            field_name: "VEHICLES",
            description: "מספרי רכבים",
            how_to_find: "חפש פורמט XXX-XX-XXX ב-UnidentifiedNumbers עם label='רכב'. בדוק שזה לא מספר כרטיס (context לא מכיל 'כרטיס').",
            pattern: "\\d{3}-\\d{2}-\\d{3}",
            example: searchResults.vehicles && searchResults.vehicles.length > 0
                ? searchResults.vehicles.join(', ')
                : "459-06-303",
            ocr_source: "ocrFields.UnidentifiedNumbers (with label filter)"
        };
    }

    // DETAILS
    fieldInstructions.details = {
        field_name: "DETAILS",
        description: "תיאור החשבונית",
        how_to_find: "אם יש רכבים: חלץ תיאור קצר של השירות (3-4 מילים, מקסימום 50 תווים) מהפריט הראשון ב-Items. אם יש גם ק\"מ נוכחי (CustomerId), הוסף אותו בפורמט: 'תיאור-XXXXXק\"מ'",
        example: "טיפול 75000 ק\"מ-76256",
        ocr_source: "ocrFields.Items[0].Description, ocrFields.CustomerId"
    };

    // מיפוי רכבים
    const vehicleMapping = {};
    if (vehicleRules && vehicleRules.vehicle_account_mapping) {
        Object.keys(vehicleRules.vehicle_account_mapping).forEach(vNum => {
            const mapping = vehicleRules.vehicle_account_mapping[vNum];
            vehicleMapping[vNum] = {
                account: mapping.accname,
                budget_code: mapping.budcode,
                vat_flag: mapping.vat_pattern?.VATFLAG || "Y",
                description: mapping.accdes || `רכב ${vNum}`
            };
        });
    }

    // בניית document_type דינמית לפי מבנה התבנית שנבחרה
    let documentType = "";
    if (structure.has_import && structure.has_doc) {
        documentType = "חשבונית עם תיק יבוא עם תעודות";
    } else if (structure.has_import) {
        documentType = "חשבונית יבוא";
    } else if (structure.has_doc) {
        documentType = "חשבונית עם תעודות";
    } else if (structure.debit_type === "C") {
        documentType = "זיכוי רגיל עם פירוט";
    } else if (vehicleRules && Object.keys(vehicleRules.vehicle_account_mapping || {}).length > 0) {
        documentType = "חשבונית שירותי רכב ומוסך";
    } else {
        documentType = "חשבונית רגילה עם פירוט";
    }

    // בניית overview דינמי לפי מבנה התבנית שנבחרה
    let overview = `חשבונית מספק ${supplierName}.`;

    if (structure.has_import && structure.has_doc) {
        overview += " תבנית: יבוא + תעודות. הספק מספק מוצרי מצאי ויבוא.";
    } else if (structure.has_import) {
        overview += " תבנית: יבוא. הספק מספק מוצרים מיובאים.";
    } else if (structure.has_doc) {
        overview += " תבנית: תעודות. הספק מספק מוצרים על בסיס תעודות אספקה.";
    } else if (vehicleRules && Object.keys(vehicleRules.vehicle_account_mapping || {}).length > 0) {
        overview += " תבנית: שירותי רכב ומוסך.";
    } else {
        overview += " תבנית: חשבונית רגילה עם פירוט.";
    }

    // בניית processing_steps דינמי לפי מבנה התבנית
    const processingSteps = [];
    processingSteps.push("1. זהה את מספר החשבונית (BOOKNUM) מתוך InvoiceId");
    processingSteps.push("2. חלץ תאריך חשבונית (IVDATE) מתוך InvoiceDate");

    if (structure.has_import) {
        processingSteps.push("3. זהה מספר יבוא (IMPFNUM) מתוך import_files");
    }

    if (structure.has_doc) {
        // ✨ חדש! הנחיה דינמית על פי תבנית שזוהתה מה-OCR
        let docsGuidance = "זהה תעודות (DOCNO/BOOKNUM)";
        if (documentPatterns && documentPatterns.booknum_found.length > 0) {
            const prefix = documentPatterns.booknum_found[0].substring(0, 3);
            const examples = documentPatterns.booknum_found.slice(0, 3).join(', ');
            docsGuidance += ` - זוהו ${documentPatterns.booknum_found.length} מספרי BOOKNUM בפורמט ${prefix}XXXXXX (דוגמאות: ${examples}). חפש מספרים אלו בטקסט והתאם עם docs_list`;
        } else {
            docsGuidance += " - חפש מספרים בפורמט 25XXXXXX או 107/108XXXXXX";
        }
        processingSteps.push(`${processingSteps.length + 1}. ${docsGuidance}`);
    }

    if (structure.has_purchase_orders) {
        processingSteps.push(`${processingSteps.length + 1}. זהה הזמנת רכש (ORDNAME) אם קיימת`);
    }

    if (vehicleRules && Object.keys(vehicleRules.vehicle_account_mapping || {}).length > 0) {
        processingSteps.push(`${processingSteps.length + 1}. חלץ מספרי רכבים מ-UnidentifiedNumbers (פורמט XXX-XX-XXX)`);
        processingSteps.push(`${processingSteps.length + 1}. מפה כל רכב לחשבון הנכון לפי vehicle_mapping`);
        processingSteps.push(`${processingSteps.length + 1}. צור תיאור קצר של השירות מהפריט הראשון`);
    } else {
        processingSteps.push(`${processingSteps.length + 1}. חשב את המחיר הכולל לפני מע"מ: InvoiceTotal - TotalTax`);
    }

    return {
        supplier_code: supplierCode,
        supplier_name: supplierName,
        document_type: documentType,
        instructions: {
            overview: overview,
            processing_steps: processingSteps,
            fields: fieldInstructions,
            vehicle_mapping: vehicleMapping
        }
    };
}

function generateTechnicalConfig(config, ocrFields, searchResults, executionReport, templateIndex, structure, documentPatterns = null) {
    const supplierCode = config.supplier_config.supplier_code;
    const supplierName = config.supplier_config.supplier_name;

    // extraction rules מפורטים
    const extractionRules = {};

    // BOOKNUM
    extractionRules.booknum = {
        source: "ocrFields.InvoiceId",
        transformations: [
            {
                action: "remove_prefix",
                pattern: "^SI",
                case_insensitive: true,
                description: "הסר קידומת SI אם קיימת"
            },
            {
                action: "take_last_n_chars",
                count: 7,
                description: "קח 7 תווים אחרונים"
            }
        ],
        validation: {
            length: 7,
            pattern: "^\\d{7}$",
            required: true
        },
        example: searchResults.booknum || "1015938"
    };

    // IVDATE
    extractionRules.ivdate = {
        source: "ocrFields.InvoiceDate",
        format: "DD/MM/YY",
        transformation: {
            from: "ISO8601",
            to: "DD/MM/YY",
            description: "המר מפורמט ISO (YYYY-MM-DD) לפורמט DD/MM/YY"
        },
        validation: {
            pattern: "^\\d{2}/\\d{2}/\\d{2}$",
            required: true
        },
        example: searchResults.ivdate || "10/09/25"
    };

    // PRICE - החישוב החשוב!
    extractionRules.price = {
        calculation: {
            method: "subtract",
            primary: {
                formula: "ocrFields.InvoiceTotal_amount - ocrFields.TotalTax_amount",
                fields_required: ["InvoiceTotal_amount", "TotalTax_amount"],
                description: "סה\"כ לפני מע\"מ = סה\"כ כולל מע\"מ - מע\"מ"
            },
            fallback: {
                formula: "ocrFields.SubTotal_amount || ocrFields.InvoiceTotal_amount",
                fields_required: ["SubTotal_amount"],
                description: "אם אין TotalTax_amount, קח SubTotal_amount"
            },
            division_by_vehicles: {
                enabled: true,
                formula: "totalPrice / vehicles.length",
                description: "אם יש מספר רכבים, חלק את המחיר הכולל באופן שווה"
            }
        },
        description: "מחיר לפני מע\"מ (עבודות + חלקים)",
        example_calculation: ocrFields.InvoiceTotal_amount && ocrFields.TotalTax_amount
            ? {
                invoice_total: ocrFields.InvoiceTotal_amount,
                total_tax: ocrFields.TotalTax_amount,
                calculated_price: ocrFields.InvoiceTotal_amount - ocrFields.TotalTax_amount,
                formula_used: "InvoiceTotal_amount - TotalTax_amount"
            }
            : {
                invoice_total: 2524,
                total_tax: 385.02,
                calculated_price: 2138.98,
                formula_used: "2524 - 385.02"
            }
    };

    // VEHICLES
    const vehicleRules = config.rules?.critical_patterns?.vehicle_rules;
    if (vehicleRules) {
        extractionRules.vehicles = {
            search_locations: [
                {
                    field: "ocrFields.UnidentifiedNumbers",
                    priority: 1,
                    filter: {
                        label: "רכב",
                        description: "רק פריטים עם תווית 'רכב'"
                    },
                    pattern: "\\d{3}-\\d{2}-\\d{3}",
                    validation: {
                        must_match_pattern: true,
                        exclude_if_context_contains: ["כרטיס"],
                        description: "בדוק שזה לא מספר כרטיס"
                    }
                },
                {
                    field: "ocrFields.VehicleNumbers",
                    priority: 2,
                    pattern: "\\d{3}-\\d{2}-\\d{3}"
                },
                {
                    field: "ocrFields.Items[].Description",
                    priority: 3,
                    pattern: "\\d{3}-\\d{2}-\\d{3}",
                    description: "חפש בתיאור הפריטים"
                }
            ],
            example: searchResults.vehicles || ["459-06-303"]
        };
    }

    // DOCUMENTS (DOCNO + BOOKNUM) - רק אם התבנית שנבחרה דורשת תעודות
    if (structure.has_doc) {
        // ✨ חדש! שימוש בתבנית שזוהתה דינמית מה-OCR
        const detectedPattern = documentPatterns && documentPatterns.booknum_pattern
            ? documentPatterns.booknum_pattern
            : "\\b(108\\d{6})\\b";  // ברירת מחדל אם לא זוהה

        const detectedDescription = documentPatterns && documentPatterns.booknum_found.length > 0
            ? `BOOKNUM - זוהה ${documentPatterns.booknum_found[0].substring(0, 3)}XXXXXX (${documentPatterns.booknum_found.length} דוגמאות מה-OCR)`
            : "BOOKNUM - 9 ספרות מתחיל ב-108";

        extractionRules.documents = {
            search_in: [
                {
                    location: "ocrFields.UnidentifiedNumbers",
                    priority: 1,
                    filter: {
                        label: "מס׳ הקצאה (BOOKNUM)",
                        description: "חפש במערך UnidentifiedNumbers עם תווית BOOKNUM"
                    },
                    pattern: detectedPattern,
                    description: detectedDescription,
                    detected_examples: documentPatterns ? documentPatterns.booknum_found.slice(0, 3) : []  // ✨ הוספת דוגמאות
                },
                {
                    location: "AZURE_TEXT",
                    priority: 2,
                    fallback: true,
                    pattern: detectedPattern,
                    description: "חיפוש fallback ב-AZURE_TEXT אם לא נמצא ב-UnidentifiedNumbers"
                }
            ],
            matching: {
                match_field: "BOOKNUM",
                lookup_source: "docs_list.list_of_docs",
                output_fields: ["DOCNO", "BOOKNUM"],
                description: "התאם את BOOKNUM שנמצא ב-OCR עם docs_list כדי לקבל DOCNO"
            },
            output_format: {
                field_name: "PIVDOC_SUBFORM",
                structure: [
                    {
                        DOCNO: "string - מספר תעודה פנימי ב-Priority (25XXXXXX)",
                        BOOKNUM: "string - מספר הקצאה חיצוני (108XXXXXX)"
                    }
                ]
            },
            error_handling: {
                if_none_found: {
                    action: "return_partial_json",
                    include_empty_array: true,
                    add_to_report: "errors",
                    message: "תבנית דורשת תעודות אך לא נמצאו ב-OCR"
                },
                if_partial_found: {
                    action: "return_partial_json",
                    include_found_items: true,
                    add_to_report: "warnings",
                    message: "נמצאו רק {found_count} מתוך {expected_count} תעודות"
                }
            },
            example: searchResults.documents || [
                { DOCNO: "25026849", BOOKNUM: "108379736" },
                { DOCNO: "25026850", BOOKNUM: "108379734" }
            ]
        };
    }

    // DESCRIPTION
    extractionRules.description = {
        source: "ocrFields.Items[0].Description",
        extraction: {
            method: "pattern_match",
            patterns: [
                {
                    name: "service_with_km",
                    pattern: "טיפול\\s+[\\d,]+\\s*ק[״\"]?מ",
                    priority: 1,
                    description: "טיפול XXX ק\"מ"
                },
                {
                    name: "general_service",
                    pattern: "(החלפת|תיקון|בדיקת)\\s+[\\u0590-\\u05FF\\s]+",
                    priority: 2,
                    description: "תיאור כללי של שירות"
                }
            ],
            max_words: 4,
            max_length: 50,
            append_mileage: {
                enabled: true,
                source: "ocrFields.CustomerId",
                format: "{description}-{mileage}",
                description: "אם יש ק\"מ נוכחי, הוסף בפורמט: 'תיאור-XXXXXק\"מ'"
            }
        },
        fallback: "טיפול",
        example: "טיפול 75000 ק\"מ"
    };

    // Vehicle mapping
    const vehicleMapping = {};
    if (vehicleRules && vehicleRules.vehicle_account_mapping) {
        Object.keys(vehicleRules.vehicle_account_mapping).forEach(vNum => {
            const mapping = vehicleRules.vehicle_account_mapping[vNum];
            vehicleMapping[vNum] = {
                accname: mapping.accname,
                accdes: mapping.accdes,
                budcode: mapping.budcode,
                vat_pattern: {
                    VATFLAG: mapping.vat_pattern?.VATFLAG || "Y",
                    SPECIALVATFLAG: mapping.vat_pattern?.SPECIALVATFLAG
                },
                date_range_pattern: mapping.date_range_pattern || "never",
                pdaccname_pattern: mapping.pdaccname_pattern || "never"
            };
        });
    }

    // Template structure
    const template = {
        SUPNAME: supplierCode,
        CODE: "ש\"ח",
        DEBIT: "D",
        TUNITNAME: "יח'",
        TQUANT: 1,
        PINVOICESCONT_SUBFORM: [
            { FNCPATNAME: "2323" }
        ]
    };

    // קביעת document_type דינמי לפי התבנית שנבחרה
    let documentTypeKey = "regular_invoice";
    if (structure.has_import && structure.has_doc) {
        documentTypeKey = "import_with_docs_invoice";
    } else if (structure.has_import) {
        documentTypeKey = "import_invoice";
    } else if (structure.has_doc) {
        documentTypeKey = "docs_invoice";
    } else if (structure.debit_type === "C") {
        documentTypeKey = "credit_note";
    } else if (config.rules?.critical_patterns?.vehicle_rules?.vehicle_account_mapping &&
               Object.keys(config.rules.critical_patterns.vehicle_rules.vehicle_account_mapping).length > 0) {
        documentTypeKey = "vehicle_service_invoice";
    }

    return {
        supplier_code: supplierCode,
        supplier_name: supplierName,
        version: "4.2",
        document_type: documentTypeKey,
        extraction_rules: extractionRules,
        vehicle_mapping: vehicleMapping,
        template: template,
        validation_rules: {
            required_fields: ["SUPNAME", "CODE", "DEBIT", "IVDATE", "BOOKNUM"],
            booknum_length: 7,
            totquant_check: {
                enabled: true,
                compare_with_docs: true,
                learned_reference: config.rules.validation_data.TOTQUANT || 1
            }
        }
    };
}

// ============================================================================
// נקודת כניסה - רק אם input מוגדר (סביבת Azure Functions)
// ============================================================================

if (typeof input !== 'undefined') {
    // המר את הקלט מ-Make למבנה הצפוי
    const normalizedInput = normalizeInput(input);

    const processInput = {
        learned_config: normalizedInput.learned_config,
        docs_list: normalizedInput.docs_list,
        import_files: normalizedInput.import_files,
        AZURE_RESULT: normalizedInput.AZURE_RESULT,
        AZURE_TEXT: normalizedInput.AZURE_TEXT || ""
    };

    const result = processInvoiceComplete(processInput);

    console.log(JSON.stringify(result));
    return result;
}

// ============================================================================
// ייצוא פונקציות למודול
// ============================================================================
module.exports = {
    processInvoiceComplete,
    normalizeInput
};

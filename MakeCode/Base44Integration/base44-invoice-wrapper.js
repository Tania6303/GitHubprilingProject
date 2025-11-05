// ================================================================
// Base44 Invoice Processing Wrapper
// תאריך: 4 נובמבר 2025
// ================================================================
//
// תפקיד: שכבת אינטגרציה בין Base44 לבין מערכת עיבוד החשבוניות הקיימת
//
// 3 אופציות מימוש:
// 1. Base44 UI + Azure OCR (מומלץ)
// 2. Base44 + DigiParser OCR
// 3. Base44 + OpenAI/Claude Vision
//
// ================================================================

// ================================================================
// אופציה 1: Base44 UI + Azure OCR
// ================================================================

/**
 * פונקציה שמקבלת קובץ מ-Base44 ושולחת ל-Azure Form Recognizer
 * @param {Object} base44Input - קלט מ-Base44
 * @returns {Object} תוצאה מעובדת
 */
async function processInvoiceWithAzure(base44Input) {
    const { file_url, invoice_id, supplier_name } = base44Input;

    // 1. קריאה ל-Azure Form Recognizer (הקוד הקיים שלך!)
    const azureResponse = await fetch(
        'https://prilinqdocai.cognitiveservices.azure.com/formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': process.env.AZURE_OCR_KEY
            },
            body: JSON.stringify({
                urlSource: file_url
            })
        }
    );

    // 2. המתן לתוצאה
    const operationLocation = azureResponse.headers.get('Operation-Location');
    const azureResult = await pollAzureResult(operationLocation);

    // 3. עבד עם AzureInvoiceProcessor הקיים
    const processedData = await runAzureInvoiceProcessor(azureResult);

    // 4. החזר ל-Base44
    return {
        status: 'success',
        invoice_id: invoice_id,
        extracted_data: processedData.data.fields,
        metadata: {
            supplier: supplier_name,
            processed_at: new Date().toISOString(),
            ocr_provider: 'Azure Form Recognizer'
        }
    };
}

/**
 * המתן לתוצאה מ-Azure (polling)
 */
async function pollAzureResult(operationUrl) {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
        const response = await fetch(operationUrl, {
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.AZURE_OCR_KEY
            }
        });

        const result = await response.json();

        if (result.status === 'succeeded') {
            return result.analyzeResult;
        } else if (result.status === 'failed') {
            throw new Error('Azure OCR failed: ' + result.error);
        }

        // המתן 2 שניות
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
    }

    throw new Error('Azure OCR timeout');
}

// ================================================================
// אופציה 2: Base44 + DigiParser
// ================================================================

/**
 * עיבוד עם DigiParser (אלטרנטיבה ל-Azure)
 * @param {Object} base44Input - קלט מ-Base44
 * @returns {Object} תוצאה מעובדת
 */
async function processInvoiceWithDigiParser(base44Input) {
    const { file_url, invoice_id } = base44Input;

    // קריאה ל-DigiParser API
    const digiParserResponse = await fetch('https://app.digiparser.com/api/v1/import-document', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.DIGIPARSER_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            document_url: file_url,
            parser_id: 'invoice_parser' // ID של parser שהוגדר ב-DigiParser
        })
    });

    const digiResult = await digiParserResponse.json();

    // המרה לפורמט Azure-compatible (כדי שהקוד הקיים שלך יעבוד!)
    const azureCompatible = convertDigiParserToAzureFormat(digiResult);

    // עיבוד עם הקוד הקיים
    const processedData = await runAzureInvoiceProcessor(azureCompatible);

    return {
        status: 'success',
        invoice_id: invoice_id,
        extracted_data: processedData.data.fields,
        metadata: {
            processed_at: new Date().toISOString(),
            ocr_provider: 'DigiParser'
        }
    };
}

/**
 * המרת תוצאת DigiParser לפורמט Azure
 */
function convertDigiParserToAzureFormat(digiResult) {
    // DigiParser מחזיר JSON שונה, צריך להמיר
    return {
        content: digiResult.raw_text,
        documents: [{
            docType: 'invoice',
            fields: {
                InvoiceId: {
                    content: digiResult.invoice_number,
                    confidence: digiResult.confidence.invoice_number
                },
                InvoiceDate: {
                    content: digiResult.invoice_date,
                    confidence: digiResult.confidence.invoice_date
                },
                VendorName: {
                    content: digiResult.vendor_name,
                    confidence: digiResult.confidence.vendor_name
                },
                InvoiceTotal: {
                    amount: digiResult.total_amount,
                    confidence: digiResult.confidence.total_amount
                },
                // ... שאר השדות
            }
        }]
    };
}

// ================================================================
// אופציה 3: Base44 + OpenAI Vision
// ================================================================

/**
 * עיבוד עם OpenAI Vision API
 * @param {Object} base44Input - קלט מ-Base44
 * @returns {Object} תוצאה מעובדת
 */
async function processInvoiceWithOpenAI(base44Input) {
    const { file_url, invoice_id } = base44Input;

    // קריאה ל-OpenAI Vision
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `
                        נתח את החשבונית הזו וחלץ:
                        1. מספר חשבונית (InvoiceId)
                        2. תאריך (InvoiceDate)
                        3. שם ספק (VendorName)
                        4. סכום כולל (InvoiceTotal)
                        5. פריטים (Items) - תיאור, כמות, מחיר
                        6. מספרי תעודה (DOCNO: 25XXXXXX, BOOKNUM: 108XXXXXX)
                        7. מספרי רכב (XXX-XX-XXX)

                        החזר JSON בפורמט Azure Form Recognizer.
                        `
                    },
                    {
                        type: 'image_url',
                        image_url: { url: file_url }
                    }
                ]
            }],
            response_format: { type: 'json_object' }
        })
    });

    const openaiResult = await openaiResponse.json();
    const extractedData = JSON.parse(openaiResult.choices[0].message.content);

    // עיבוד עם הקוד הקיים
    const processedData = await runAzureInvoiceProcessor(extractedData);

    return {
        status: 'success',
        invoice_id: invoice_id,
        extracted_data: processedData.data.fields,
        metadata: {
            processed_at: new Date().toISOString(),
            ocr_provider: 'OpenAI GPT-4o Vision'
        }
    };
}

// ================================================================
// פונקציות עזר
// ================================================================

/**
 * הרצת AzureInvoiceProcessor הקיים (v2.0)
 */
async function runAzureInvoiceProcessor(azureResult) {
    // טען את המודול הקיים שלך
    const AzureInvoiceProcessor = require('../AzureInvoiceProcessor/v2.0(30.10.25)');

    return AzureInvoiceProcessor.processInvoice({
        azureJsonInput: {
            analyzeResult: azureResult
        }
    });
}

// ================================================================
// Base44 API Endpoint Handler
// ================================================================

/**
 * Webhook endpoint שמקבל קריאות מ-Base44
 */
async function handleBase44Webhook(request) {
    try {
        const { action, data } = request.body;

        let result;

        switch (action) {
            case 'process_invoice_azure':
                result = await processInvoiceWithAzure(data);
                break;

            case 'process_invoice_digiparser':
                result = await processInvoiceWithDigiParser(data);
                break;

            case 'process_invoice_openai':
                result = await processInvoiceWithOpenAI(data);
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        // עדכן את Base44 בתוצאה
        await updateBase44Entity(data.invoice_id, result);

        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Error processing invoice:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                error: error.message
            })
        };
    }
}

/**
 * עדכון entity ב-Base44
 */
async function updateBase44Entity(invoiceId, result) {
    const APP_ID = process.env.BASE44_APP_ID;
    const API_KEY = process.env.BASE44_API_KEY;

    await fetch(
        `https://app.base44.com/api/apps/${APP_ID}/entities/Invoice/${invoiceId}`,
        {
            method: 'PATCH',
            headers: {
                'api_key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: result.status,
                extracted_data: result.extracted_data,
                processed_at: result.metadata.processed_at,
                ocr_provider: result.metadata.ocr_provider
            })
        }
    );
}

// ================================================================
// Export
// ================================================================

module.exports = {
    // אופציה 1: Azure OCR (כמו עכשיו)
    processInvoiceWithAzure,

    // אופציה 2: DigiParser
    processInvoiceWithDigiParser,

    // אופציה 3: OpenAI Vision
    processInvoiceWithOpenAI,

    // Webhook handler
    handleBase44Webhook
};

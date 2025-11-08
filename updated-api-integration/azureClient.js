// Azure Client - Form Recognizer + Azure OpenAI
// מעודכן לתמיכה ב-Azure OpenAI כ-LLM ראשי

// =============== CONFIGURATION ===============
const AZURE_ENDPOINT = import.meta.env.VITE_AZURE_ENDPOINT;
const AZURE_KEY = import.meta.env.VITE_AZURE_KEY;

// Azure OpenAI Configuration (NEW!)
const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY;
const AZURE_OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

// Validate Form Recognizer configuration
if (!AZURE_ENDPOINT || !AZURE_KEY) {
  console.warn('⚠️ Azure Form Recognizer credentials missing. Set VITE_AZURE_ENDPOINT and VITE_AZURE_KEY');
}

// Validate Azure OpenAI configuration
if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
  console.warn('⚠️ Azure OpenAI credentials missing. Set VITE_AZURE_OPENAI_ENDPOINT and VITE_AZURE_OPENAI_KEY');
}

// =============== AZURE OPENAI LLM (NEW!) ===============

/**
 * Invoke Azure OpenAI for LLM operations
 * @param {string} prompt - The user prompt
 * @param {object} options - Additional options
 * @returns {Promise} LLM response
 */
export async function invokeAzureOpenAI(prompt, options = {}) {
  const {
    model = AZURE_OPENAI_DEPLOYMENT,
    max_tokens = 4096,
    temperature = 1,
    system = null,
    file_urls = [],
    response_json_schema = null
  } = options;

  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
    throw new Error('Azure OpenAI credentials not configured. Please set VITE_AZURE_OPENAI_ENDPOINT and VITE_AZURE_OPENAI_KEY');
  }

  try {
    // Build messages array
    const messages = [];

    if (system) {
      messages.push({
        role: 'system',
        content: system
      });
    }

    // Handle file URLs (images/PDFs) with vision
    if (file_urls && file_urls.length > 0) {
      const content = [
        { type: 'text', text: prompt }
      ];

      for (const url of file_urls) {
        // Fetch file and convert to base64
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });

        const mimeType = blob.type || 'image/jpeg';

        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64}`
          }
        });
      }

      messages.push({
        role: 'user',
        content: content
      });
    } else {
      messages.push({
        role: 'user',
        content: prompt
      });
    }

    // Build request body
    const requestBody = {
      messages: messages,
      max_tokens: max_tokens,
      temperature: temperature
    };

    // Add JSON schema if provided
    if (response_json_schema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: response_json_schema
      };
    }

    // Call Azure OpenAI API
    const endpoint = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${model}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Extract response
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Azure OpenAI response');
    }

    // Parse JSON if schema was provided
    let parsedContent = content;
    if (response_json_schema) {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        console.warn('Failed to parse JSON response from Azure OpenAI:', e);
      }
    }

    return {
      status: 'success',
      output: parsedContent,
      usage: result.usage,
      model: model,
      provider: 'azure-openai'
    };

  } catch (error) {
    console.error('Azure OpenAI Error:', error);
    throw error;
  }
}

// =============== AZURE FORM RECOGNIZER (EXISTING) ===============

/**
 * Extract data from PDF using Azure Form Recognizer
 * @param {string} fileUrl - Public URL to the PDF file
 * @param {object} jsonSchema - Optional JSON schema (not used by Azure FR, kept for compatibility)
 * @returns {Promise} Extraction result
 */
export async function extractDataFromPDF(fileUrl, jsonSchema = null) {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error('Azure Form Recognizer credentials not configured');
  }

  try {
    // Step 1: Submit document for analysis
    const analyzeUrl = `${AZURE_ENDPOINT}/formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`;

    const submitResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': AZURE_KEY
      },
      body: JSON.stringify({
        urlSource: fileUrl
      })
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();

      // Provide helpful error messages
      if (submitResponse.status === 401) {
        throw new Error('Azure authentication failed. Check your VITE_AZURE_KEY');
      } else if (submitResponse.status === 403) {
        throw new Error('Azure access denied. Verify your subscription and endpoint');
      } else if (submitResponse.status === 404) {
        throw new Error('Azure endpoint not found. Check VITE_AZURE_ENDPOINT');
      } else if (submitResponse.status === 400) {
        throw new Error(`Invalid request to Azure: ${errorText}`);
      }

      throw new Error(`Azure Form Recognizer error (${submitResponse.status}): ${errorText}`);
    }

    // Step 2: Get operation location for polling
    const operationLocation = submitResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('No operation location returned from Azure');
    }

    // Step 3: Poll for results
    let result;
    const maxAttempts = 60;
    const pollInterval = 1000; // 1 second

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY
        }
      });

      if (!pollResponse.ok) {
        throw new Error(`Polling failed: ${pollResponse.status}`);
      }

      const pollResult = await pollResponse.json();

      if (pollResult.status === 'succeeded') {
        result = pollResult;
        break;
      } else if (pollResult.status === 'failed') {
        throw new Error('Azure analysis failed: ' + JSON.stringify(pollResult.error));
      }
    }

    if (!result) {
      throw new Error('Azure analysis timeout - document processing took too long');
    }

    // Step 4: Format the result
    return formatAzureResult(result);

  } catch (error) {
    console.error('Azure Form Recognizer Error:', error);

    // Handle network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
      throw new Error('Network error connecting to Azure. Check CORS settings and endpoint accessibility');
    }

    throw error;
  }
}

/**
 * Format Azure Form Recognizer result into structured invoice data
 */
function formatAzureResult(azureResult) {
  const doc = azureResult.analyzeResult?.documents?.[0];

  if (!doc) {
    return {
      status: 'no_data',
      details: 'No invoice data found in document',
      output: null
    };
  }

  const fields = doc.fields || {};

  // Extract invoice data
  const invoice = {
    // Vendor information
    vendorName: getFieldValue(fields.VendorName),
    vendorAddress: getFieldValue(fields.VendorAddress),
    vendorTaxId: getFieldValue(fields.VendorTaxId),

    // Customer information
    customerName: getFieldValue(fields.CustomerName),
    customerAddress: getFieldValue(fields.CustomerAddress),
    customerTaxId: getFieldValue(fields.CustomerTaxId),

    // Invoice details
    invoiceId: getFieldValue(fields.InvoiceId),
    invoiceDate: getFieldValue(fields.InvoiceDate),
    dueDate: getFieldValue(fields.DueDate),
    purchaseOrder: getFieldValue(fields.PurchaseOrder),

    // Amounts
    subTotal: getFieldValue(fields.SubTotal),
    totalTax: getFieldValue(fields.TotalTax),
    invoiceTotal: getFieldValue(fields.InvoiceTotal),
    amountDue: getFieldValue(fields.AmountDue),

    // Currency
    currencyCode: getFieldValue(fields.CurrencyCode),

    // Line items
    items: extractLineItems(fields.Items)
  };

  // Get raw text content
  const rawText = azureResult.analyzeResult?.content || '';

  return {
    status: 'success',
    output: invoice,
    raw_text: rawText,
    azure_result: azureResult,
    provider: 'azure-form-recognizer'
  };
}

/**
 * Extract value from Azure field object
 */
function getFieldValue(field) {
  if (!field) return null;

  // Azure returns different value types
  if (field.content) return field.content;
  if (field.valueString) return field.valueString;
  if (field.valueNumber !== undefined) return field.valueNumber;
  if (field.valueDate) return field.valueDate;
  if (field.valueAddress) return field.valueAddress;

  return null;
}

/**
 * Extract line items from invoice
 */
function extractLineItems(itemsField) {
  if (!itemsField || !itemsField.valueArray) return [];

  return itemsField.valueArray.map(item => {
    const itemFields = item.valueObject || {};

    return {
      description: getFieldValue(itemFields.Description),
      quantity: getFieldValue(itemFields.Quantity),
      unitPrice: getFieldValue(itemFields.UnitPrice),
      amount: getFieldValue(itemFields.Amount),
      productCode: getFieldValue(itemFields.ProductCode),
      unit: getFieldValue(itemFields.Unit),
      tax: getFieldValue(itemFields.Tax)
    };
  });
}

// =============== EXPORTS ===============

export default {
  invokeAzureOpenAI,
  extractDataFromPDF
};

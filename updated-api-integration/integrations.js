// Integration Layer - Azure (Primary) + Claude (Fallback)
// מעודכן: Azure OpenAI כראשי, Claude כגיבוי

import { extractDataFromPDF, invokeAzureOpenAI } from './azureClient';
import { invokeLLM, chatWithClaude, extractStructuredData } from './claudeClient';
import { supabase } from './supabaseClient';

// =============== FILE MANAGEMENT ===============

/**
 * Upload a file to Supabase Storage
 * @param {File} file - The file to upload
 * @param {string} bucket - Storage bucket name (default: 'documents')
 * @returns {Promise} Upload result with file URL
 */
export async function UploadFile({ file, bucket = 'documents' }) {
  try {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      file_url: publicUrl,
      file_id: data.path,
      file_name: file.name,
      storage_path: filePath
    };

  } catch (error) {
    console.error('Upload Error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Upload a private file (requires authentication to access)
 * @param {File} file - The file to upload
 * @param {string} bucket - Storage bucket name (default: 'private-documents')
 * @returns {Promise} Upload result with signed URL
 */
export async function UploadPrivateFile({ file, bucket = 'private-documents' }) {
  try {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600);

    if (urlError) throw urlError;

    return {
      file_url: signedUrlData.signedUrl,
      file_id: data.path,
      file_name: file.name,
      storage_path: filePath
    };

  } catch (error) {
    console.error('Private Upload Error:', error);
    throw new Error(`Failed to upload private file: ${error.message}`);
  }
}

/**
 * Create a signed URL for a private file
 * @param {string} file_path - Path to the file in storage
 * @param {number} expires_in - Expiration time in seconds (default: 3600)
 * @param {string} bucket - Storage bucket name
 * @returns {Promise} Signed URL
 */
export async function CreateFileSignedUrl({ file_path, expires_in = 3600, bucket = 'private-documents' }) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(file_path, expires_in);

    if (error) throw error;

    return {
      signed_url: data.signedUrl,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
    };

  } catch (error) {
    console.error('Signed URL Error:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
}

// =============== DOCUMENT EXTRACTION ===============

/**
 * Extract data from uploaded file using Azure Form Recognizer
 * @param {string} file_url - URL of the uploaded file
 * @param {object} json_schema - Optional JSON schema for extraction
 * @returns {Promise} Extraction result
 */
export async function ExtractDataFromUploadedFile({ file_url, json_schema = null }) {
  try {
    const result = await extractDataFromPDF(file_url, json_schema);
    return result;
  } catch (error) {
    console.error('Extraction Error:', error);
    return {
      status: 'failed',
      details: error.message,
      output: null
    };
  }
}

// =============== LLM OPERATIONS (AZURE PRIMARY, CLAUDE FALLBACK) ===============

/**
 * Invoke LLM with Azure OpenAI as primary, Claude as fallback
 * 🎯 UPDATED: Azure קודם, Claude רק אם יש בעיה
 *
 * @param {string} prompt - The prompt to send
 * @param {object} options - Additional options
 * @returns {Promise} LLM response
 */
export async function InvokeLLM({ prompt, ...options }) {
  console.log('🎯 InvokeLLM: Trying Azure OpenAI first...');

  // Try Azure OpenAI first (PRIMARY)
  try {
    const result = await invokeAzureOpenAI(prompt, options);
    console.log('✅ Azure OpenAI succeeded');
    return result;
  } catch (azureError) {
    console.warn('⚠️ Azure OpenAI failed, falling back to Claude...', azureError.message);

    // Fallback to Claude (SECONDARY)
    try {
      const result = await invokeLLM(prompt, options);
      console.log('✅ Claude fallback succeeded');
      return {
        ...result,
        fallback_used: true,
        fallback_reason: azureError.message,
        original_provider: 'azure-openai',
        actual_provider: 'claude'
      };
    } catch (claudeError) {
      console.error('❌ Both Azure and Claude failed');
      return {
        status: 'failed',
        details: `Azure: ${azureError.message}, Claude: ${claudeError.message}`,
        output: null
      };
    }
  }
}

/**
 * Chat with LLM (maintains conversation)
 * Uses Azure OpenAI as primary, Claude as fallback
 *
 * @param {Array} messages - Conversation history
 * @param {object} options - Additional options
 * @returns {Promise} Chat response
 */
export async function ChatWithClaude({ messages, ...options }) {
  console.log('🎯 ChatWithClaude: Trying Azure OpenAI first...');

  // Convert messages to prompt for Azure OpenAI
  const lastMessage = messages[messages.length - 1];
  const prompt = lastMessage?.content || '';

  // Extract system message if exists
  const systemMessage = messages.find(m => m.role === 'system');
  const systemPrompt = systemMessage?.content || null;

  // Try Azure OpenAI first
  try {
    const result = await invokeAzureOpenAI(prompt, {
      ...options,
      system: systemPrompt
    });
    console.log('✅ Azure OpenAI chat succeeded');
    return result;
  } catch (azureError) {
    console.warn('⚠️ Azure OpenAI chat failed, falling back to Claude...', azureError.message);

    // Fallback to Claude
    try {
      const result = await chatWithClaude(messages, options);
      console.log('✅ Claude fallback succeeded');
      return {
        ...result,
        fallback_used: true,
        fallback_reason: azureError.message,
        original_provider: 'azure-openai',
        actual_provider: 'claude'
      };
    } catch (claudeError) {
      console.error('❌ Both Azure and Claude chat failed');
      return {
        status: 'failed',
        details: `Azure: ${azureError.message}, Claude: ${claudeError.message}`,
        output: null
      };
    }
  }
}

// =============== HELPER SERVICES ===============

/**
 * Send email (placeholder - implement with your email service)
 * @param {object} params - Email parameters (to, subject, body, html)
 * @returns {Promise} Email send result
 */
export async function SendEmail({ to, subject, body, html = null }) {
  console.warn('SendEmail not implemented - use your preferred email service');
  return {
    status: 'not_implemented',
    details: 'Email functionality requires email service integration'
  };
}

/**
 * Generate image (placeholder - implement with your image generation service)
 * @param {string} prompt - Image generation prompt
 * @returns {Promise} Generated image URL
 */
export async function GenerateImage({ prompt }) {
  console.warn('GenerateImage not implemented - use DALL-E, Midjourney, or similar');
  return {
    status: 'not_implemented',
    details: 'Image generation requires external service integration'
  };
}

// =============== EXPORTS ===============

export const Core = {
  InvokeLLM,
  ChatWithClaude,
  SendEmail,
  UploadFile,
  UploadPrivateFile,
  CreateFileSignedUrl,
  ExtractDataFromUploadedFile,
  GenerateImage
};

export default Core;

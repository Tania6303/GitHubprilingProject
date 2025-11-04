// ================================================================
// Base44 Invoice Integration Server
// ================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { handleBase44Webhook } = require('./base44-invoice-wrapper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ================================================================
// Health Check
// ================================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Base44 Invoice Integration',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ================================================================
// Base44 Webhook Endpoint
// ================================================================

app.post('/webhook/base44', async (req, res) => {
    console.log('📨 Received webhook from Base44:', {
        action: req.body.action,
        invoice_id: req.body.data?.invoice_id,
        timestamp: new Date().toISOString()
    });

    try {
        const result = await handleBase44Webhook(req);

        console.log('✅ Webhook processed successfully:', {
            status: result.statusCode,
            invoice_id: req.body.data?.invoice_id
        });

        res.status(result.statusCode).json(JSON.parse(result.body));
    } catch (error) {
        console.error('❌ Webhook error:', error);

        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ================================================================
// Manual Processing Endpoints (לבדיקות)
// ================================================================

const {
    processInvoiceWithAzure,
    processInvoiceWithDigiParser,
    processInvoiceWithOpenAI
} = require('./base44-invoice-wrapper');

// עיבוד עם Azure
app.post('/api/process/azure', async (req, res) => {
    try {
        const result = await processInvoiceWithAzure(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// עיבוד עם DigiParser
app.post('/api/process/digiparser', async (req, res) => {
    try {
        const result = await processInvoiceWithDigiParser(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// עיבוד עם OpenAI
app.post('/api/process/openai', async (req, res) => {
    try {
        const result = await processInvoiceWithOpenAI(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================================================================
// Test Endpoint
// ================================================================

app.get('/test', (req, res) => {
    const config = {
        azure: !!process.env.AZURE_OCR_KEY,
        digiparser: !!process.env.DIGIPARSER_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        base44: !!process.env.BASE44_API_KEY
    };

    res.json({
        message: 'Base44 Invoice Integration Test',
        config_status: config,
        available_endpoints: [
            'POST /webhook/base44',
            'POST /api/process/azure',
            'POST /api/process/digiparser',
            'POST /api/process/openai',
            'GET /health',
            'GET /test'
        ],
        documentation: 'https://github.com/your-repo/Base44Integration'
    });
});

// ================================================================
// Error Handling
// ================================================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found',
        path: req.path
    });
});

// ================================================================
// Start Server
// ================================================================

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Base44 Invoice Integration Server');
    console.log('='.repeat(50));
    console.log(`📍 Server running on: http://localhost:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('\n📋 Available Endpoints:');
    console.log(`   POST http://localhost:${PORT}/webhook/base44`);
    console.log(`   POST http://localhost:${PORT}/api/process/azure`);
    console.log(`   POST http://localhost:${PORT}/api/process/digiparser`);
    console.log(`   POST http://localhost:${PORT}/api/process/openai`);
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   GET  http://localhost:${PORT}/test`);
    console.log('\n🔧 Configuration:');
    console.log(`   Azure OCR: ${process.env.AZURE_OCR_KEY ? '✅' : '❌'}`);
    console.log(`   DigiParser: ${process.env.DIGIPARSER_API_KEY ? '✅' : '❌'}`);
    console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
    console.log(`   Base44: ${process.env.BASE44_API_KEY ? '✅' : '❌'}`);
    console.log('='.repeat(50) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    process.exit(0);
});

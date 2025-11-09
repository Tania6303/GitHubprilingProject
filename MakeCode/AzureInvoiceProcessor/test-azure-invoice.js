const DocumentIntelligence = require("@azure-rest/ai-document-intelligence").default;
const { getLongRunningPoller, isUnexpected } = require("@azure-rest/ai-document-intelligence");
const fs = require('fs');
const path = require('path');

const key = "CdSbyB8oJePTa6bRLuzJmkZE7IGd31GQaZZQtlIF9VjBwwsuVSbOJQQJ99BJAC5RqLJXJ3w3AAALACOGSDuM";
const endpoint = "https://prilinqdocai.cognitiveservices.azure.com/";

// FLAS-FIT invoice text
const invoiceText = `דימסמך עזיושר
מסמך חתום
על ידי גורם מאשר
דיגיטלית ומאושר
בע"מ
על ידי גורם מאשר
comsign
comsign
לבדיקת החתימה
ת בר לב
לבדיקת החתימה
לחץ כאן
ת.ד. 21 ד.נ.משגב 2015600
FLAS-FIT & TAVLIT
לחץ כאן
טלפון: 04-6445585, פקס: 1534-6438399
עוסק מורשה: 512703828
Quality that lasts
מס. תיק ניכויים: 902119254
לכבוד:
ט.פ.י פל ים בע"מ
תאריך חשבונית: 02/03/25
מושב תנובות 58 42830
טלפון: 09-8947633, פקס: 09-8943892
מס. עוסק מורשה: 513327064
חשבונית מס מרכזת SI256002097 - מקור
מק"ט
מק"ט
לקוח
תאור מוצר
כמות
מחיר ליחידה
הנחה
סה"כ מחיר
הזמנתכם
RL-4000007
r5243535
ריין קורד בושינג "1 ת/פ
240.00 יח'
13.3600 ש"ח
60.00%
1,282.56
2501001143
RL-4000005
r5273535
ריין קורד "ד 1 רקורד +
הברגה
120.00 יח'
16.5600 ש"ח
65.00%
695.52
2501001143
RL-4000005
r5273535
ריין קורד "ד 1 רקורד +
הברגה
120.00 יח'
16.5600 ש"ח
65.00%
695.52
2501001143
RL-4000008
r5283535
ריין קורד זוית "1 פ/פ
160.00 יח'
5.5000 ש"ח
880.00
2501001143
RL-4000009
r5293535
ריין קורד זוית "1 ח/פ
160.00 יח'
5.5000 ש'ח
880.00
2501001143
מחיר כולל
לתשלום עד: 31/07/25
4,433.60
תעודה: SH25001921
הנחה כללית (0.01%-)
-0.30
מספר תעודה בפנקס: NAAEM
מחיר אחרי הנחה
4,433.90
הזמנה: SO25001336
מע"מ (18.00%)
798.10
הזמנתכם: 2501001143
מס. לקוח: 710091700
סה"כ מחיר
5,232.00 ש"ח
מס. חברה לקוח: 513327064
תיק מע"מ לקוח: 513327064
סוכן: דודי יניב
לקוח נכבד!
יתרת ההזמנה תשמר במערכת ותסופק בהקדם. לפרטים נוספים אנא פנה למשרד המשלוחים / לסוכן.
* הסחורה נשארת בבעלות פלס-פיט עד לפרעון התשלום המלא.
* החזרת הסחורה תחויב ב - 5% מעלות הקניה.
תעודת התאמה לדרישות - CERTIFICATE OF CONFORMANCE
איכות ולתקנים הישימים.
אנו מאשרים בזאת כי אביזרי פלסים, דרג 10, דרג 16, מיטל, ניר, קומפיט ורוכבים המיוצרים בפלסים, נבדקים בהתאם לדרישות מערכת הבטחת
אוקסנה סורוקופוד
פלס-פיט בע"מ`;

async function main() {
    console.log('Sending FLAS-FIT invoice to Azure...');

    const client = DocumentIntelligence(endpoint, { key: key });
    console.log('Client created successfully');

    // Send the text to Azure
    console.log('Sending POST request...');
    const initialResponse = await client
        .path("/documentModels/{modelId}:analyze", "prebuilt-invoice")
        .post({
            contentType: "text/plain",
            body: invoiceText
        });

    console.log('Response received, status:', initialResponse.status);

    if (isUnexpected(initialResponse)) {
        console.error('Unexpected response:', initialResponse.body);
        throw initialResponse.body.error;
    }

    console.log('Polling for results...');
    const poller = getLongRunningPoller(client, initialResponse);
    const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;

    console.log('✅ Azure analysis complete!');

    // Save the full result
    const outputPath = path.join(__dirname, 'EXEMPTS', 'azure-flas-fit-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(analyzeResult, null, 2), 'utf-8');
    console.log('✅ Full result saved to:', outputPath);

    // Check VendorFax
    const documents = analyzeResult?.documents;
    const result = documents && documents[0];

    if (result) {
        const invoice = result.fields;
        console.log('\n📋 Key Fields:');
        console.log('VendorName:', invoice.VendorName?.valueString);
        console.log('VendorPhone:', invoice.VendorPhoneNumber?.valueString);
        console.log('VendorFax:', invoice.VendorFax?.valueString);
        console.log('InvoiceId:', invoice.InvoiceId?.valueString);
        console.log('VendorTaxId:', invoice.VendorTaxId?.valueString);
    }

    // Now test with our v2.7 processor
    console.log('\n🔄 Running v2.7 processor...');

    const input = {
        contentLong: analyzeResult.content,
        pages: analyzeResult.pages,
        tables: analyzeResult.tables,
        documents: analyzeResult.documents,
        modelId: analyzeResult.modelId
    };

    // Save input for future testing
    const inputPath = path.join(__dirname, 'EXEMPTS', 'input-flas-fit.json');
    fs.writeFileSync(inputPath, JSON.stringify(input, null, 2), 'utf-8');
    console.log('✅ Input saved to:', inputPath);
}

main().catch((error) => {
    console.error("An error occurred:");
    console.error("Error message:", error?.message);
    console.error("Error details:", JSON.stringify(error, null, 2));
    console.error("Full error:", error);
    process.exit(1);
});

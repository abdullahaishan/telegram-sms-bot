require('dotenv').config();
const express = require('express');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// بدء خدمة Keep-Alive إذا كان على Render
if (process.env.RENDER) {
    console.log('🔧 تم الكشف عن بيئة Render - بدء خدمة Keep-Alive');
    require('../keep-alive');
}

// مسارات API
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Bot is running',
        timestamp: new Date().toISOString(),
        service: 'Telegram SMS Bot',
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>بوت تلجرام SMS</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #333; }
                .status { color: green; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>🤖 بوت تلجرام SMS</h1>
            <p class="status">✅ البوت يعمل بنجاح</p>
            <p>التاريخ: ${new Date().toLocaleString('ar-SA')}</p>
            <p><a href="/health">تفاصيل الصحة</a></p>
        </body>
        </html>
    `);
});

// تشغيل الخادم
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 البوت يعمل على المنفذ ${PORT}`);
    console.log(`🌐 عنوان الويب: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
    console.log(`📊 لوحة التحكم: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/health`);
});

// معالجة الإغلاق
process.on('SIGTERM', () => {
    console.log('🔻 تلقي إشارة إغلاق...');
    process.exit(0);
});
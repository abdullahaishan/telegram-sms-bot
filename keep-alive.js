// keep-alive.js - يحافظ على نشاط البوت 24/7
const https = require('https');
const cron = require('node-cron');

// رابط تطبيقك على Render
const APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://your-app.onrender.com';

function pingSelf() {
    const url = `${APP_URL}/health`;
    
    console.log(`🔄 جارٍ إرسال ping إلى: ${url}`);
    
    const req = https.get(url, (res) => {
        console.log(`✅ Ping ناجح - الحالة: ${res.statusCode}`);
    });
    
    req.on('error', (err) => {
        console.log(`❌ فشل Ping: ${err.message}`);
    });
    
    req.setTimeout(10000, () => {
        req.destroy();
        console.log('⏰ انتهت مهلة Ping');
    });
}

// تشغيل ping كل 5 دقائق
cron.schedule('*/5 * * * *', () => {
    pingSelf();
});

// ping فوري عند البدء
pingSelf();

console.log('🚀 خدمة Keep-Alive بدأت العمل');
console.log(`🌐 التطبيق: ${APP_URL}`);
console.log('⏰ سيتم Ping كل 5 دقائق');

// منع التطبيق من الخروج
setInterval(() => {
    // مجرد تنفيذ فارغ للحفاظ على التشغيل
}, 24 * 60 * 60 * 1000); // 24 ساعة
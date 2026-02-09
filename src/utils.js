const crypto = require('crypto');

// توليد رمز تحقق
const generateCode = (length = 6) => {
    return Math.floor(Math.random() * Math.pow(10, length))
        .toString()
        .padStart(length, '0');
};

// تنسيق التاريخ العربي
const formatArabicDate = (date) => {
    return new Intl.DateTimeFormat('ar-SA', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

// تشفير نص بسيط
const encrypt = (text, key = process.env.ENCRYPTION_KEY) => {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

// فك تشفير نص
const decrypt = (encrypted, key = process.env.ENCRYPTION_KEY) => {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// تقسيم النص الطويل
const splitLongMessage = (text, maxLength = 4000) => {
    const parts = [];
    while (text.length > maxLength) {
        let splitAt = text.lastIndexOf('\n', maxLength);
        if (splitAt === -1) splitAt = text.lastIndexOf('. ', maxLength);
        if (splitAt === -1) splitAt = maxLength;
        
        parts.push(text.substring(0, splitAt));
        text = text.substring(splitAt).trim();
    }
    parts.push(text);
    return parts;
};

module.exports = {
    generateCode,
    formatArabicDate,
    encrypt,
    decrypt,
    splitLongMessage
};
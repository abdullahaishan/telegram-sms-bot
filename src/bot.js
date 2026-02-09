const TelegramBot = require('node-telegram-bot-api');
const { supabase, checkMandatoryChannels } = require('./db');
const provider = require('./provider');
const admin = require('./admin');

const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: true,
    filepath: false
});

// تخزين الحالات المؤقتة للمستخدمين
const userStates = {};

// إنشاء لوحة مفاتيح
const createKeyboard = (buttons) => ({
    reply_markup: { inline_keyboard: buttons.map(b => [b]) }
});

// ترحيب المستخدم مع التحقق من القنوات
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username ? `@${msg.from.username}` : null;
    
    // التحقق من القنوات الإجبارية
    const channelCheck = await checkMandatoryChannels(bot, userId);
    if (channelCheck.required) {
        await showChannelRequirement(chatId, channelCheck.channels);
        return;
    }
    
    // حفظ/تحديث بيانات المستخدم
    await supabase.from('users').upsert({
        telegram_id: chatId,
        username: username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
        last_seen: new Date().toISOString()
    }, { onConflict: 'telegram_id' });
    
    // التحقق من صلاحيات المسؤول
    const { data: adminUser } = await supabase
        .from('admins')
        .select('id')
        .eq('telegram_username', username)
        .single();
    
    // إنشاء القائمة الرئيسية
    const mainButtons = [
        { text: "🌍 الدول المتاحة", callback_data: "show_countries" },
        { text: "💰 أرقام للبيع", callback_data: "premium_numbers" },
        { text: "📱 أرقامي", callback_data: "my_numbers" },
        { text: "📊 الإحصائيات", callback_data: "stats" }
    ];
    
    // إضافة زر لوحة التحكم للمسؤول فقط
    if (adminUser) {
        mainButtons.push({ text: "⚙️ لوحة التحكم", callback_data: "admin_dashboard" });
    }
    
    mainButtons.push({ text: "🆘 المساعدة", callback_data: "help" });
    
    const welcomeText = `مرحباً ${msg.from.first_name}! 👋\n\nاختر من القائمة:`;
    
    bot.sendMessage(chatId, welcomeText, createKeyboard(mainButtons));
});

// عرض القنوات الإجبارية
async function showChannelRequirement(chatId, channels) {
    let message = "📢 *للأسف لا يمكنك استخدام البوت حتى تشترك في القنوات التالية:*\n\n";
    const keyboard = [];
    
    channels.forEach(channel => {
        message += `📍 ${channel.owner_name}\n`;
        keyboard.push([{ text: `✅ اشترك في ${channel.owner_name}`, url: channel.invite_link }]);
    });
    
    keyboard.push([{ text: "🔄 تحقق من الاشتراك", callback_data: "check_subscription" }]);
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

// معالجة أزرار المستخدم
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;
    
    await bot.answerCallbackQuery(query.id);
    
    // التحقق من الاشتراك أولاً
    const channelCheck = await checkMandatoryChannels(bot, userId);
    if (channelCheck.required && !data.includes('check_subscription')) {
        await showChannelRequirement(chatId, channelCheck.channels);
        return;
    }
    
    // توجيه استدعاءات المسؤول
    if (data.startsWith('admin_')) {
        return admin.handleAdminQuery(bot, query);
    }
    
    // معالجة باقي الاستدعاءات
    switch(data) {
        case 'show_countries':
            await handleShowCountries(chatId);
            break;
        case 'premium_numbers':
            await handlePremiumNumbers(chatId);
            break;
        case 'my_numbers':
            await handleMyNumbers(chatId);
            break;
        case 'stats':
            await handleStats(chatId);
            break;
        case 'help':
            await showHelp(chatId);
            break;
        case 'check_subscription':
            await bot.deleteMessage(chatId, query.message.message_id);
            await bot.sendMessage(chatId, "✅ يمكنك الآن استخدام البوت!");
            break;
    }
});

// وظائف المعالجة
async function handleShowCountries(chatId) {
    const countries = await provider.getCountries();
    
    if (countries.length === 0) {
        return bot.sendMessage(chatId, "⚠️ لا يمكن جلب الدول حالياً. حاول لاحقاً.");
    }
    
    let text = "🌍 *اختر دولة:*\n\n";
    const keyboard = [];
    
    countries.slice(0, 10).forEach((country, index) => {
        text += `${index + 1}. ${country.name}\n`;
        keyboard.push([{ 
            text: `${country.name}`, 
            callback_data: `country_${country.code}` 
        }]);
    });
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function handlePremiumNumbers(chatId) {
    const { data: numbers } = await supabase
        .from('numbers')
        .select('*')
        .eq('sale_status', 'available')
        .eq('state', 'premium')
        .order('price');
    
    if (!numbers || numbers.length === 0) {
        return bot.sendMessage(chatId, "⚠️ لا توجد أرقام للبيع حالياً.");
    }
    
    let text = "💰 *الأرقام المميزة للبيع:*\n\n";
    const keyboard = [];
    
    numbers.forEach((num, index) => {
        text += `${index + 1}. ${num.phone_number}\n`;
        text += `   🌍 ${num.country} | 💵 ${num.price}$\n\n`;
        
        keyboard.push([{ 
            text: `شراء ${num.phone_number} - ${num.price}$`, 
            callback_data: `buy_${num.id}` 
        }]);
    });
    
    keyboard.push([{ text: "🔙 رجوع", callback_data: "back_start" }]);
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function handleMyNumbers(chatId) {
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', chatId)
        .single();
    
    if (!user) return;
    
    const { data: numbers } = await supabase
        .from('user_numbers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('last_checked', { ascending: false });
    
    if (!numbers || numbers.length === 0) {
        return bot.sendMessage(chatId, "📭 ليس لديك أرقام مُتابعة.");
    }
    
    let text = `📱 *أرقامك (${numbers.length})*\n\n`;
    const keyboard = [];
    
    numbers.forEach((num, index) => {
        text += `${index + 1}. ${num.number}\n`;
        text += `   🌍 ${num.country} | 🕐 ${new Date(num.last_checked).toLocaleTimeString('ar-SA')}\n\n`;
        
        keyboard.push([{ 
            text: `📨 رسائل ${num.number}`, 
            callback_data: `view_messages_${num.number}` 
        }]);
    });
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function handleStats(chatId) {
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .single();
    
    const { data: myNumbers } = await supabase
        .from('user_numbers')
        .select('id')
        .eq('user_id', user?.id);
    
    const text = `📊 *إحصائياتك*\n\n` +
                `📱 أرقامك النشطة: ${myNumbers?.length || 0}\n` +
                `💰 رصيدك: 0$\n` +
                `🎯 الحد اليومي: 3 أرقام\n\n` +
                `*مميزات قادمة:*\n` +
                `• نظام الإحالات\n` +
                `• رصيد افتراضي\n` +
                `• مستويات عضوية`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function showHelp(chatId) {
    const helpText = `🆘 *مساعدة*\n\n` +
                    `*كيفية الاستخدام:*\n` +
                    `1. اختر "الدول المتاحة"\n` +
                    `2. اختر الدولة المطلوبة\n` +
                    `3. اختر رقم من القائمة\n` +
                    `4. تابع الرسائل الواردة\n\n` +
                    `*للمسؤولين:*\n` +
                    `- زر لوحة التحكم يظهر للمسجلين في جدول admins\n` +
                    `- كلمة المرور الافتراضية: admin123\n\n` +
                    `📞 للدعم: @YourSupportChannel`;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

module.exports = bot;
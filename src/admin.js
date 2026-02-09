const { supabase, verifyAdmin } = require('./db');

const adminStates = {};

const handleAdminQuery = async (bot, query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const username = `@${query.from.username}`;
    
    await bot.answerCallbackQuery(query.id);
    
    switch(data) {
        case 'admin_dashboard':
            await showAdminLogin(bot, chatId, username);
            break;
        case 'admin_logout':
            delete adminStates[chatId];
            await bot.sendMessage(chatId, "✅ تم تسجيل الخروج من لوحة التحكم");
            break;
        default:
            if (data.startsWith('admin_')) {
                await handleAdminAction(bot, chatId, data, username);
            }
    }
};

async function showAdminLogin(bot, chatId, username) {
    adminStates[chatId] = { awaiting: 'admin_password', username };
    
    await bot.sendMessage(chatId, 
        `🔐 *تسجيل دخول المسؤول*\n\n` +
        `اسم المستخدم: ${username}\n` +
        `أدخل كلمة المرور:`,
        { 
            parse_mode: 'Markdown',
            reply_markup: { force_reply: true }
        }
    );
}

// معالجة ردود المسؤول
const handleAdminReply = async (bot, msg) => {
    const chatId = msg.chat.id;
    const state = adminStates[chatId];
    
    if (!state || !state.awaiting) return;
    
    if (state.awaiting === 'admin_password') {
        const password = msg.text;
        const admin = await verifyAdmin(state.username, password);
        
        if (admin) {
            adminStates[chatId] = { 
                loggedIn: true, 
                adminId: admin.id,
                username: state.username,
                isSuper: admin.is_super_admin
            };
            await showAdminDashboard(bot, chatId);
        } else {
            await bot.sendMessage(chatId, "❌ كلمة المرور غير صحيحة");
            delete adminStates[chatId];
        }
    }
    
    // معالجة إضافة رقم جديد
    else if (state.awaiting === 'add_number') {
        const [country, phone, price] = msg.text.split(',');
        
        await supabase.from('numbers').insert({
            country: country.trim(),
            phone_number: phone.trim(),
            price: parseFloat(price),
            added_by: state.adminId,
            state: 'premium',
            sale_status: 'available'
        });
        
        await bot.sendMessage(chatId, `✅ تم إضافة الرقم ${phone} للبيع`);
        delete adminStates[chatId];
    }
};

async function showAdminDashboard(bot, chatId) {
    const dashboardText = `🛠️ *لوحة تحكم المسؤول*\n\n` +
                         `اختر الإدارة:`;
    
    const keyboard = [
        [{ text: "➕ إضافة رقم للبيع", callback_data: "admin_add_number" }],
        [{ text: "📊 الإحصائيات الكاملة", callback_data: "admin_stats" }],
        [{ text: "📢 إدارة القنوات", callback_data: "admin_channels" }],
        [{ text: "👥 المستخدمون", callback_data: "admin_users" }],
        [{ text: "📁 سجلات النظام", callback_data: "admin_logs" }],
        [{ text: "🚪 تسجيل خروج", callback_data: "admin_logout" }]
    ];
    
    await bot.sendMessage(chatId, dashboardText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function handleAdminAction(bot, chatId, action, username) {
    const state = adminStates[chatId];
    if (!state?.loggedIn) {
        return bot.sendMessage(chatId, "❌ يلزم تسجيل الدخول أولاً");
    }
    
    switch(action) {
        case 'admin_add_number':
            adminStates[chatId].awaiting = 'add_number';
            await bot.sendMessage(chatId,
                "➕ *إضافة رقم جديد*\n\n" +
                "أرسل البيانات بالتنسيق:\n" +
                "`البلد,رقم_الهاتف,السعر`\n\n" +
                "*مثال:*\n" +
                "`US,+1234567890,5.99`",
                { parse_mode: 'Markdown', reply_markup: { force_reply: true } }
            );
            break;
            
        case 'admin_stats':
            const { data: userCount } = await supabase
                .from('users').select('id', { count: 'exact' });
            const { data: orderCount } = await supabase
                .from('orders').select('id', { count: 'exact' });
            const { data: revenue } = await supabase
                .from('orders')
                .select('total_price');
            
            const totalRevenue = revenue?.reduce((sum, order) => 
                sum + (parseFloat(order.total_price) || 0), 0) || 0;
            
            const statsText = `📈 *إحصائيات النظام*\n\n` +
                             `👥 المستخدمون: ${userCount?.length || 0}\n` +
                             `📦 الطلبات: ${orderCount?.length || 0}\n` +
                             `💰 الإيرادات: ${totalRevenue.toFixed(2)}$\n` +
                             `🕐 آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}`;
            
            await bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
            break;
    }
}

module.exports = {
    handleAdminQuery,
    handleAdminReply,
    adminStates
};
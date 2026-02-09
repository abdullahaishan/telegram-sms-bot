const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('❌ Supabase credentials missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// أدوات تشفير كلمات المرور
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// التحقق من اشتراك المستخدم في القنوات الإجبارية
const checkMandatoryChannels = async (bot, userId) => {
    const { data: channels } = await supabase
        .from('sponsored_channels')
        .select('*')
        .eq('is_mandatory', true)
        .eq('status', 'active');
    
    if (!channels || channels.length === 0) return { required: false };
    
    const unsubscribed = [];
    
    for (const channel of channels) {
        try {
            const member = await bot.getChatMember(channel.channel_id, userId);
            if (!['creator', 'administrator', 'member'].includes(member.status)) {
                unsubscribed.push(channel);
            }
        } catch (error) {
            unsubscribed.push(channel);
        }
    }
    
    return {
        required: unsubscribed.length > 0,
        channels: unsubscribed
    };
};

// تسجيل دخول المسؤول
const verifyAdmin = async (username, password) => {
    const { data: admin } = await supabase
        .from('admins')
        .select('*')
        .eq('telegram_username', username)
        .single();
    
    if (!admin) return null;
    
    const isValid = await verifyPassword(password, admin.password_hash);
    return isValid ? admin : null;
};

module.exports = {
    supabase,
    hashPassword,
    verifyPassword,
    checkMandatoryChannels,
    verifyAdmin
};
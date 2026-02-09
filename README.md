# Telegram SMS Bot

بوت تلجرام لإدارة أرقام SMS من موقع receive-smss.live

## المميزات
- استقبال رسائل SMS مجانية
- لوحة تحكم للمسؤولين
- إدارة أرقام للبيع
- نظام قنوات إجبارية
- متكامل مع Supabase

## التثبيت
1. `npm install`
2. انسخ `.env.example` إلى `.env` واملأ البيانات
3. قم بتنفيذ `scripts/setup-db.sql` في Supabase
4. `npm start`

## النشر على Fly.io
1. `fly auth login`
2. `fly launch`
3. `fly secrets set BOT_TOKEN=xxx SUPABASE_URL=yyy`
4. `fly deploy`
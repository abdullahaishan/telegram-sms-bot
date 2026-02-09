const axios = require('axios');
const cheerio = require('cheerio');

class SMSProvider {
    constructor() {
        this.baseUrl = 'https://receive-smss.live';
        this.session = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'ar,en;q=0.9',
                'Referer': 'https://receive-smss.live/ar'
            }
        });
    }

    // 1. جلب الدول من الصفحة الرئيسية (الشكل الصحيح)
    async getCountries() {
        try {
            // استهدف الصفحة العربية الرئيسية
            const response = await this.session.get(`${this.baseUrl}/ar`);
            const $ = cheerio.load(response.data);
            const countries = [];

            // البحث عن جميع بطاقات الدول في القسم الرئيسي
            $('div.card-modern').each((index, element) => {
                const cardHtml = $(element).html();
                
                // استخراج رمز العلم واسم الدولة من البطاقة
                const flagEmojiMatch = cardHtml.match(/🇦🇷|🇦🇺|🇦🇹|🇦🇿|🇧🇪|🇧🇯|🇧🇷|🇧🇬/); // أضف رموز باقي الدول هنا
                const countryName = $(element).find('h3.text-xl').text().trim();
                
                // استخراج الرابط من الزر "عرض الأرقام"
                const linkElement = $(element).find('a[href*="/ar/sms/"]');
                const relativeLink = linkElement.attr('href');
                
                if (countryName && relativeLink) {
                    // استخراج كود الدولة من الرابط (مثال: /ar/sms/ar → ar)
                    const countryCode = relativeLink.split('/').pop();
                    
                    countries.push({
                        name: countryName,
                        flag: flagEmojiMatch ? flagEmojiMatch[0] : '🌍',
                        key: countryCode,
                        link: this.baseUrl + relativeLink
                    });
                }
            });

            // إذا لم نجد بطاقات، نستخدم الطريقة البديلة
            if (countries.length === 0) {
                return await this.getCountriesAlternative();
            }

            return countries.slice(0, 20); // إرجاع أول 20 دولة فقط

        } catch (error) {
            console.error('Error fetching countries from main page:', error.message);
            return await this.getCountriesAlternative();
        }
    }

    // 2. طريقة بديلة لجلب الدول (من صفحة free)
    async getCountriesAlternative() {
        try {
            const response = await this.session.get(`${this.baseUrl}/ar/sms/free`);
            const $ = cheerio.load(response.data);
            const countries = [];

            // البحث عن جميع الروابط التي تشير إلى صفحات الدول
            $('a[href^="/ar/sms/"]').each((index, element) => {
                const href = $(element).attr('href');
                const text = $(element).text().trim();
                
                // استبعاد الروابط العامة
                if (href && !href.includes('/free') && !href.includes('/highquality') 
                    && !href.includes('/private') && text) {
                    
                    const countryCode = href.split('/').pop();
                    
                    // تجنب التكرار
                    if (!countries.find(c => c.key === countryCode)) {
                        countries.push({
                            name: text || `الدولة ${countryCode.toUpperCase()}`,
                            key: countryCode,
                            link: this.baseUrl + href
                        });
                    }
                }
            });

            return countries;
        } catch (error) {
            console.error('Error fetching countries alternative:', error.message);
            return [];
        }
    }

    // 3. جلب الأرقام لدولة محددة
    async getNumbers(countryCode) {
        try {
            const url = `${this.baseUrl}/ar/sms/${countryCode}`;
            const response = await this.session.get(url);
            const $ = cheerio.load(response.data);
            const numbers = [];

            // البحث عن جميع الأرقام في الصفحة
            $('a[href*="/ar/sms/' + countryCode + '/"]').each((index, element) => {
                const href = $(element).attr('href');
                const numberText = $(element).text().trim();
                
                if (href) {
                    // استخراج الرقم من الرابط
                    const numberMatch = href.match(/\/(\d+)$/);
                    if (numberMatch) {
                        const phoneNumber = numberMatch[1];
                        
                        numbers.push({
                            number: phoneNumber,
                            fullNumber: `+${phoneNumber}`,
                            link: this.baseUrl + href,
                            country: countryCode,
                            displayText: numberText || `+${phoneNumber}`
                        });
                    }
                }
            });

            return numbers;
        } catch (error) {
            console.error(`Error fetching numbers for ${countryCode}:`, error.message);
            return [];
        }
    }

    // 4. جلب الرسائل لرقم معين
    async getMessages(numberUrl) {
        try {
            const url = numberUrl.startsWith('http') ? numberUrl : this.baseUrl + numberUrl;
            const response = await this.session.get(url);
            const $ = cheerio.load(response.data);
            const messages = [];

            // استخراج الرسائل (تعديل حسب الهيكل الفعلي)
            $('div:contains("الرسائل المستلمة"), div:contains("Received Messages")').nextAll().each((index, element) => {
                const messageText = $(element).text().trim();
                
                if (messageText && messageText.length > 5) {
                    // محاولة استخراج المرسل والرسالة
                    const lines = messageText.split('\n').filter(line => line.trim());
                    
                    if (lines.length >= 2) {
                        messages.push({
                            sender: lines[0].trim(),
                            text: lines[1].trim(),
                            time: lines[2] ? lines[2].trim() : 'قريباً',
                            raw: messageText
                        });
                    } else {
                        messages.push({
                            sender: 'غير معروف',
                            text: messageText,
                            time: 'قريباً',
                            raw: messageText
                        });
                    }
                }
            });

            // إذا لم تعمل الطريقة الأولى، نجرب طريقة عامة
            if (messages.length === 0) {
                $('div, p').each((index, element) => {
                    const text = $(element).text().trim();
                    if (text && text.length > 10 && text.match(/\d{4,6}/)) {
                        messages.push({
                            sender: 'نظام',
                            text: text,
                            time: 'قريباً',
                            raw: text
                        });
                    }
                });
            }

            return messages.slice(0, 10); // إرجاع أول 10 رسائل فقط
        } catch (error) {
            console.error('Error fetching messages:', error.message);
            return [];
        }
    }

    // 5. البحث عن رقم محدد
    async searchNumber(query) {
        try {
            // البحث في جميع الدول
            const countries = await this.getCountries();
            const results = [];
            
            for (const country of countries.slice(0, 5)) { // ابحث في أول 5 دول فقط للسرعة
                const numbers = await this.getNumbers(country.key);
                const matchedNumbers = numbers.filter(num => 
                    num.number.includes(query) || num.fullNumber.includes(query)
                );
                
                results.push(...matchedNumbers);
                
                if (results.length >= 5) break; // توقف عند العثور على 5 نتائج
            }
            
            return results;
        } catch (error) {
            console.error('Error searching number:', error.message);
            return [];
        }
    }
}

module.exports = new SMSProvider();

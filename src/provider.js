const axios = require('axios');
const cheerio = require('cheerio');

class SMSProvider {
    constructor() {
        this.baseUrl = 'https://receive-smss.live';
        this.session = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    async getCountries() {
        try {
            const response = await this.session.get(this.baseUrl);
            const $ = cheerio.load(response.data);
            const countries = [];
            
            $('.country-card, .number-item').each((index, element) => {
                const name = $(element).find('.country-name').text() || 
                            $(element).find('h3').text();
                const link = $(element).find('a').attr('href');
                
                if (name && link) {
                    const countryCode = this.extractCountryCode(link);
                    countries.push({
                        name: name.trim(),
                        code: countryCode,
                        link: link.startsWith('http') ? link : this.baseUrl + link
                    });
                }
            });
            
            return countries;
        } catch (error) {
            console.error('Error fetching countries:', error.message);
            return [];
        }
    }

    extractCountryCode(link) {
        const match = link.match(/sms-(\w+)/) || link.match(/country\/(\w+)/);
        return match ? match[1].toUpperCase() : 'US';
    }

    async getNumbers(countryCode) {
        try {
            const url = `${this.baseUrl}/sms-${countryCode.toLowerCase()}/`;
            const response = await this.session.get(url);
            const $ = cheerio.load(response.data);
            const numbers = [];
            
            $('.number-item, .card').each((index, element) => {
                const number = $(element).find('.number-phone, .phone').text();
                const link = $(element).find('a').attr('href');
                
                if (number && link) {
                    const cleanNumber = number.replace(/\D/g, '');
                    if (cleanNumber.length > 5) {
                        numbers.push({
                            number: cleanNumber,
                            fullNumber: number.trim(),
                            link: link.startsWith('http') ? link : this.baseUrl + link,
                            country: countryCode
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

    async getMessages(numberUrl) {
        try {
            const url = numberUrl.startsWith('http') ? numberUrl : this.baseUrl + numberUrl;
            const response = await this.session.get(url);
            const $ = cheerio.load(response.data);
            const messages = [];
            
            $('.sms-item, .message').each((index, element) => {
                const sender = $(element).find('.sender').text() || 'Unknown';
                const text = $(element).find('.text').text() || $(element).text();
                const time = $(element).find('.time').text() || 'Just now';
                
                if (text.trim()) {
                    messages.push({
                        sender: sender.trim(),
                        text: text.trim(),
                        time: time.trim(),
                        index: index + 1
                    });
                }
            });
            
            return messages;
        } catch (error) {
            console.error('Error fetching messages:', error.message);
            return [];
        }
    }
}

module.exports = new SMSProvider();
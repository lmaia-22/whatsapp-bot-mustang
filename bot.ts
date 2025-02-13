import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code to authenticate WhatsApp bot.');
});

client.on('ready', async () => {
    console.log('✅ Bot is ready!');

    // Run birthday check daily
    checkBirthdays();
    setInterval(checkBirthdays, 86400000); // Runs every 24 hours
});

// Function to check birthdays and send messages
async function checkBirthdays(): Promise<void> {
    console.log('🔍 Checking for birthdays...');

    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format

    const { data: birthdays, error } = await supabase
        .from('birthdays')
        .select('*')
        .eq('birthdate', today);

    if (error) {
        console.error('❌ Supabase Error:', error);
        return;
    }

    if (birthdays && birthdays.length > 0) {
        for (const person of birthdays) {
            const phoneNumber = `${person.phone}@c.us`;
            const message = `🎉 Happy Birthday, ${person.name}! 🎂🥳`;
            
            await client.sendMessage(phoneNumber, message);
            console.log(`📨 Sent birthday message to ${person.phone}`);
        }
    } else {
        console.log('No birthdays today.');
    }
}

client.initialize();

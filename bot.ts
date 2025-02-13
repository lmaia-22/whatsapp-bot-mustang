import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRandomBirthdayMessage } from './messages';
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

// Load environment variables
dotenv.config();

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// WhatsApp Client

async function getChromiumPath(): Promise<string> {
    const { stdout } = await promisify(exec)("which chromium");
    return stdout.trim();
}

// Function to check birthdays and send messages
async function checkBirthdays(client: Client): Promise<void> {
    console.log('🔍 Checking for birthdays...');

    const today = new Date().toISOString().split('T')[0];

    const { data: birthdays, error } = await supabase
        .from('public_members_view')
        .select()
        .eq('birthdate', today);

    if (error) {
        console.error('❌ Supabase Error:', error);
        return;
    }

    if (birthdays && birthdays.length > 0) {
        const groupId = '120363401933202931@g.us';
        for (const person of birthdays) {
            const message = `🎉 ${person.first_name} ${person.last_name}, 🎂🥳\n`;
            const messageText = getRandomBirthdayMessage();
            const fullMessage = message + messageText;
            
            await client.sendMessage(groupId, fullMessage);
            console.log(`📨 Sent birthday message for ${person.first_name} ${person.last_name} to group chat`);
        }
    } else {
        console.log('No birthdays today.');
    }
}

async function initializeWhatsAppClient() {
    const chromiumPath = await getChromiumPath();
    
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            executablePath: chromiumPath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions'
            ]
        }
    });

    client.on('auth_failure', (err) => {
        console.error('Authentication failed:', err);
    });

    client.on('disconnected', (reason) => {
        console.log('Client was disconnected:', reason);
    });

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log('Scan the QR code to authenticate WhatsApp bot.');
    });

    client.on('ready', async () => {
        console.log('✅ Bot is ready!');
        checkBirthdays(client);
        setInterval(() => checkBirthdays(client), 86400000);
    });

    try {
        await client.initialize();
    } catch (error) {
        console.error('Error during initialization:', error);
        process.exit(1);
    }

    return client;
}

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
initializeWhatsAppClient().catch(error => {
    console.error('Failed to start the bot:', error);
    process.exit(1);
});

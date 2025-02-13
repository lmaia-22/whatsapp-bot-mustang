import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRandomBirthdayMessage } from './messages'

// Load environment variables
dotenv.config();

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
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

// Add error handlers
client.on('auth_failure', (err) => {
    console.error('Authentication failed:', err);
});

client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize client with error handling
try {
    client.initialize().catch(err => {
        console.error('Failed to initialize client:', err);
        process.exit(1);
    });
} catch (error) {
    console.error('Error during initialization:', error);
    process.exit(1);
}

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code to authenticate WhatsApp bot.');
});

client.on('ready', async () => {
    console.log('✅ Bot is ready!');

    // Temporary code to find group ID
    // const chats = await client.getChats();
    // console.log("chats", chats)
    // chats.forEach(chat => {
    //     if (chat.timestamp > 1738792321) {
    //         console.log(`Group Name: ${chat.name}, ID: ${chat.id._serialized}`);
    //     }
    // });

    checkBirthdays();
    setInterval(checkBirthdays, 86400000);
});

// Function to check birthdays and send messages
async function checkBirthdays(): Promise<void> {
    console.log('🔍 Checking for birthdays...');

    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format

    const { data: birthdays, error } = await supabase
        .from('public_members_view')
        .select()
        .eq('birthdate', today);

        console.log(birthdays)

    if (error) {
        console.error('❌ Supabase Error:', error);
        return;
    }

    if (birthdays && birthdays.length > 0) {
        // const groupId = '120363283556343675@g.us'; // Replace with your actual group ID
        const groupId = '120363401933202931@g.us'; // Replace with your actual group ID
        for (const person of birthdays) {
            const message = `🎉 ${person.first_name} ${person.last_name}, 🎂🥳\n`;

            const messageText = getRandomBirthdayMessage();

            const fullMessage = message + messageText;
            
            await client.sendMessage(groupId, fullMessage);
            console.log(`📨 Sent birthday message for ${person.first_name}  ${person.last_name} to group chat`);
        }
    } else {
        console.log('No birthdays today.');
    }
}

client.initialize();

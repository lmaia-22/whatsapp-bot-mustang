import { Client, RemoteAuth } from 'whatsapp-web.js';
import { MongoStore } from 'wwebjs-mongo'
const mongoose = require('mongoose');
import qrcodeTerminal from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRandomBirthdayMessage } from './messages';
import { promisify } from 'util';
import { exec } from 'child_process';
// Load environment variables
dotenv.config();

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
        process.exit(1);
    }

    if (birthdays && birthdays.length > 0) {
        const groupId = '120363401933202931@g.us';
        for (const person of birthdays) {
            try {
                const message = `🎉 ${person.first_name} ${person.last_name}, 🎂🥳\n`;
                const messageText = getRandomBirthdayMessage();
                const fullMessage = message + messageText;
                
                const sent = await client.sendMessage(groupId, fullMessage);
                console.log(`📨 Sent birthday message for ${person.first_name} ${person.last_name} to group chat`);
                
                // Wait for message to be properly sent
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                if (!sent) {
                    throw new Error('Message not sent');
                }
            } catch (error) {
                console.error(`Failed to send message for ${person.first_name}:`, error);
            }
        }
    } else {
        console.log('No birthdays today.');
    }

    // Wait for any pending operations
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Gracefully close the client and exit
    await client.destroy();
    await mongoose.connection.close();
    process.exit(0);
}

async function initializeWhatsAppClient() {    
    mongoose.connect(process.env.MONGODB_URI).then(() => {
        const store = new MongoStore({ mongoose: mongoose });
        const client = new Client({
            authStrategy: new RemoteAuth({
                clientId: 'whatsapp-bot',
                store: store,
                backupSyncIntervalMs: 300000 
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
                product: 'chrome',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--window-size=1920x1080',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--enable-features=NetworkService,NetworkServiceInProcess',
                    '--force-color-profile=srgb',
                    '--metrics-recording-only',
                    '--no-first-run'
                ],
                ignoreHTTPSErrors: true
            }
        });

        let isClientInitialized = false;

        client.on('authenticated', async (session) => {
            try {
                console.log('Authentication successful');
                isClientInitialized = true;
            } catch (error) {
                console.error('Error in authentication handler:', error);
            }
        });

        client.on('auth_failure', async (err) => {
            console.error('Authentication failed:', err);
            if (!isClientInitialized) {
                console.error('Initial authentication failed, exiting...');
                process.exit(1);
            }
        });

    client.on('disconnected', (reason) => {
        console.log('Client was disconnected:', reason);
    });

    client.on('qr', (qr) => {
        qrcodeTerminal.generate(qr, { small: true });
        console.log('Scan the QR code to authenticate WhatsApp bot.');
    });

    client.on('ready', async () => {
        console.log('✅ Bot is ready!');
        checkBirthdays(client);
    });

    client.on('remote_session_saved', () => {
        console.log('Session data saved remotely');
      });  
    
    try {
        client.initialize();
    } catch (error) {
        console.error('Error during initialization:', error);
        process.exit(1);
    }

    return client;
    
    });
    
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
initializeWhatsAppClient().catch(error => {
    console.error('Failed to start the bot:', error);
    process.exit(1);
});

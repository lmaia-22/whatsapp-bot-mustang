import { Client, RemoteAuth } from 'whatsapp-web.js';
import { MongoStore } from 'wwebjs-mongo'
const mongoose = require('mongoose');
import qrcodeTerminal from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRandomBirthdayMessage } from './messages';
// Load environment variables
dotenv.config();

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
        // const groupId = '120363283556343675@g.us';
        const groupId = '120363401933202931@g.us';
        for (const person of birthdays) {
            try {
                const message = `🎉 ${person.first_name} ${person.last_name}, 🎂🥳\n`;
                const messageText = getRandomBirthdayMessage();
                const fullMessage = message + messageText;
                
                const sent = await client.sendMessage(groupId, fullMessage);
                
                // Wait for message to be delivered
                await new Promise((resolve) => {
                    const checkDelivery = (msg: any) => {
                        if (msg.id._serialized === sent.id._serialized && msg.ack > 0) {
                            client.removeListener('message_ack', checkDelivery);
                            console.log(`📨 Message delivered for ${person.first_name} ${person.last_name}`);
                            resolve(void 0);
                        }
                    };
                    client.on('message_ack', checkDelivery);
                    
                    // Timeout after 30 seconds
                    setTimeout(() => {
                        client.removeListener('message_ack', checkDelivery);
                        console.log(`⚠️ Message delivery timeout for ${person.first_name}`);
                        resolve(void 0);
                    }, 30000);
                });
            } catch (error) {
                console.error(`Failed to send message for ${person.first_name}:`, error);
            }
        }
    } else {
        console.log('No birthdays today.');
    }

    // Final wait to ensure all operations are complete
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('Closing connections...');
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

import { Client, RemoteAuth } from 'whatsapp-web.js';
import { MongoStore } from 'wwebjs-mongo'
const mongoose = require('mongoose');
import qrcodeTerminal from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRandomBirthdayMessage } from './src/messages';
// Load environment variables
dotenv.config();

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Function to check birthdays and send messages
async function checkBirthdays(client: Client): Promise<void> {
    try {
        console.log('🔍 Checking for birthdays...');

        // Wait longer for client to be fully ready
        if (!client.info) {
            console.log('Waiting for client to be fully ready...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            if (!client.info) {
                throw new Error('Client failed to initialize properly');
            }
        }

        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        console.log(`Checking birthdays for date: month ${month}, day ${day}`);

        const { data: birthdays, error } = await supabase
            .rpc('get_todays_birthdays', {
                target_month: month,
                target_day: day
            });

        if (error) {
            throw error;
        }

        if (birthdays && birthdays.length > 0) {
            const groupId = '120363401933202931@g.us';
            const chat = await client.getChatById(groupId);

            if (!chat || !chat.id) {
                throw new Error('Could not find or access the group chat');
            }

            for (const person of birthdays) {
                try {
                    const message = `🎉 ${person.first_name} ${person.last_name}, 🎂🥳\n`;
                    const messageText = getRandomBirthdayMessage();
                    const fullMessage = message + messageText;

                    console.log(`Preparing to send message for ${person.first_name}...`);
                    const sent = await client.sendMessage(groupId, fullMessage);

                    // More robust message delivery confirmation
                    const deliveryResult = await new Promise((resolve) => {
                        const checkDelivery = (msg: any) => {
                            if (msg.id._serialized === sent.id._serialized) {
                                client.removeListener('message_ack', checkDelivery);
                                resolve(true);
                            }
                        };
                        
                        client.on('message_ack', checkDelivery);
                        setTimeout(() => {
                            client.removeListener('message_ack', checkDelivery);
                            resolve(false);
                        }, 15000);
                    });

                    console.log(deliveryResult ? 
                        `✅ Message sent for ${person.first_name}` : 
                        `⚠️ Message status unclear for ${person.first_name}`
                    );

                    // Longer delay between messages
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (error) {
                    console.error(`Failed to send message for ${person.first_name}:`, error);
                }
            }
        } else {
            console.log('No birthdays today');
        }
    } catch (error) {
        console.error('Error in checkBirthdays:', error);
    } finally {
        console.log('Cleaning up...');
        try {
            await mongoose.connection.close();
            await client.destroy();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        process.exit(0);
    }
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
                executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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
                console.log('Authentication successful', session);
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

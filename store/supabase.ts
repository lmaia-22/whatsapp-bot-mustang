import { createClient } from '@supabase/supabase-js';
import { Store } from 'whatsapp-web.js';
import dotenv from 'dotenv';
import { writeFileSync, readFileSync } from 'fs';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

class SupabaseStore implements Store {
    private readonly ZIP_PATH = 'RemoteAuth-whatsapp-bot.zip';
    private readonly BUCKET_NAME = 'whatsapp-session';

    async sessionExists(options: { session: string }): Promise<boolean> {
        const { data } = await supabase
            .storage
            .from(this.BUCKET_NAME)
            .download(this.ZIP_PATH);
        return !!data;
    }

    async save(options: { session: string }): Promise<void> {
        try {
            // Handle the session data directly
            writeFileSync(this.ZIP_PATH, options.session);
            
            // Read the file as a buffer and upload
            const fileBuffer = readFileSync(this.ZIP_PATH);
            
            const { error } = await supabase
                .storage
                .from(this.BUCKET_NAME)
                .upload(this.ZIP_PATH, fileBuffer, {
                    upsert: true,
                    contentType: 'application/zip'
                });

            if (error) {
                throw error;
            }
            console.log('Session ZIP saved to bucket successfully');
        } catch (error) {
            console.error('Failed to save session to bucket:', error);
            throw error;
        }
    }

    async extract(options: { session: string }): Promise<any> {
        try {
            const { data, error } = await supabase
                .storage
                .from(this.BUCKET_NAME)
                .download(this.ZIP_PATH);

            if (error || !data) {
                console.error('Error downloading session:', error);
                return null;
            }

            // Convert ArrayBuffer to Buffer and save
            const buffer = Buffer.from(await data.arrayBuffer());
            writeFileSync(this.ZIP_PATH, buffer);
            console.log('Session file saved locally:', this.ZIP_PATH);
            
            return this.ZIP_PATH;
        } catch (error) {
            console.error('Error extracting session:', error);
            return null;
        }
    }

    async delete(options: { session: string }): Promise<void> {
        const { error } = await supabase
            .storage
            .from(this.BUCKET_NAME)
            .remove([this.ZIP_PATH]);

        if (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }
}

export default SupabaseStore;

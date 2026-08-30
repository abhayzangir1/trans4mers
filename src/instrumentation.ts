import { Overseer } from './lib/Overseer';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_CLOUD_PROJECT: z.string().min(1, "Missing GCP project"),
  GCS_BUCKET_NAME: z.string().min(1, "Missing GCS bucket")
});

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server is starting up... Validating Environment Variables.');
    
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('? Invalid environment variables:', parsed.error.flatten().fieldErrors);
      process.exit(1);
    }

    // Start Overseer Loop
    console.log('[Instrumentation] Starting the Overseer Loop.');
    setInterval(() => {
      Overseer.checkSwarmHealth().catch(console.error);
    }, 30000); // every 30 seconds
  }
}

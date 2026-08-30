import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';

// Initialize Genkit 3 with Vertex AI and OpenTelemetry natively enabled
export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.MODEL_ARMOR_LOCATION || 'us-central1',
    }),
  ]
});

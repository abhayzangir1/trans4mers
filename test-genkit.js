require('dotenv').config({ path: '.env.local' });
const { genkit } = require('genkit');
const { vertexAI } = require('@genkit-ai/google-genai');
const ai = genkit({ plugins: [vertexAI({ projectId: process.env.GOOGLE_CLOUD_PROJECT, location: 'us-central1' })] });
ai.generate({ model: 'vertexai/gemini-2.5-pro', prompt: 'say hi' })
  .then(res => console.log('SUCCESS:', res.text))
  .catch(err => console.error('FAILED:', err.message));

import { getAgentAuth } from './auth';

interface ModelArmorSanitizationResult {
  filterMatchState?: 'MATCH_FOUND' | 'NO_MATCH_FOUND' | string;
  filterResults?: Array<{
    filterType?: string;
    confidenceLevel?: string;
  }>;
}

interface ModelArmorResponse {
  sanitizationResult?: ModelArmorSanitizationResult;
  violationFound?: boolean;
}

export async function checkModelArmor(prompt: string): Promise<boolean> {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new Error('Missing GOOGLE_CLOUD_PROJECT for Model Armor verification.');
    }

    const auth = getAgentAuth();
    const token = await auth.getAccessToken();
    
    if (!token) {
      throw new Error('Failed to retrieve access token for Model Armor.');
    }

    const location = process.env.MODEL_ARMOR_LOCATION || 'us-central1';

    const response = await fetch(
      `https://modelarmor.googleapis.com/v1/projects/${projectId}/locations/${location}/templates/default:sanitizeUserPrompt`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPromptData: { text: prompt },
          text: prompt,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Model Armor Error:', errorText);
      // Fail secure: if Model Armor is unreachable or errors, block the prompt
      return false; 
    }

    const data = (await response.json()) as ModelArmorResponse;
    
    // Prompt blocked if violation detected or MATCH_FOUND
    if (
      data.violationFound === true ||
      data.sanitizationResult?.filterMatchState === 'MATCH_FOUND'
    ) {
      return false;
    }

    return true;
  } catch (error: unknown) {
    console.error('Model Armor Exception:', error instanceof Error ? error.message : String(error));
    // Fail secure: block the prompt if checking fails
    return false;
  }
}

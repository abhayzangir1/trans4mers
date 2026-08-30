import { GoogleAuth } from 'google-auth-library';

export function getAgentAuth(clientEmail?: string, privateKey?: string) {
  // If specific credentials are provided (e.g. from an AgentIdentity row later on), we could use them.
  // But for the hackathon local testing and since the GCP org blocks JSON key creation, 
  // we fallback to Application Default Credentials (ADC) initialized via `gcloud auth application-default login`.
  
  if (clientEmail && privateKey) {
     return new GoogleAuth({
       credentials: {
         client_email: clientEmail,
         private_key: privateKey.replace(/\\n/g, '\n'),
       },
       scopes: ['https://www.googleapis.com/auth/cloud-platform'],
     });
  }

  // ADC Fallback
  return new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

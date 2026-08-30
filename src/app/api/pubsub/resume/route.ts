import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { AgentFactory } from '@/lib/AgentFactory';

const authClient = new OAuth2Client();

export async function POST(req: NextRequest) {
  try {
    // 6. Pub/Sub Push Endpoint Security
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse('Missing or invalid Authorization header', { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Validate the Google-signed OIDC Bearer token
    try {
      const expectedAudience = process.env.PUBSUB_EXPECTED_AUDIENCE || `https://${req.headers.get('host')}/api/pubsub/resume`;
      await authClient.verifyIdToken({
        idToken: token,
        audience: expectedAudience,
      });
    } catch (e) {
      console.error('Invalid Pub/Sub ID token:', e);
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    
    // Pub/Sub messages are base64 encoded in body.message.data
    if (!body.message || !body.message.data) {
      return new NextResponse('Invalid Pub/Sub message format', { status: 400 });
    }

    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
    let payload;
    try {
      payload = JSON.parse(decodedData);
    } catch (e) {
      return new NextResponse('Invalid JSON payload in Pub/Sub message', { status: 400 });
    }

    const { agentInstanceId, prompt } = payload;
    if (!agentInstanceId || !prompt) {
      return new NextResponse('Missing required fields in payload', { status: 400 });
    }

    // Run the ReAct loop
    const result = await AgentFactory.runReActLoop(agentInstanceId, prompt);
    
    if (result && typeof result === 'object' && 'failed' in result && result.failed) {
      // Non-recoverable error handled gracefully by AgentFactory
      // Return HTTP 200 to ack the message so PubSub doesn't retry
      return NextResponse.json({ success: false, reason: (result as { reason?: string }).reason }, { status: 200 });
    }

    return NextResponse.json({ success: true, result }, { status: 200 });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Pub/Sub Push Endpoint Error:', err);
    
    // 4. Pub/Sub Infinite Retry Prevention
    // Recoverable errors (like 429) should throw HTTP 500 to trigger backoff
    if (err.message && err.message.includes('429')) {
      return new NextResponse('Rate limited, backing off', { status: 500 });
    }

    // Default catch-all for unexpected errors: return 500 to retry, 
    // unless it's a known non-recoverable error which we should 200 ack.
    // Assuming mostly transient infrastructure errors here.
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}


import { PubSub } from '@google-cloud/pubsub';
import { Storage } from '@google-cloud/storage';

async function provisionInfrastructure() {
  try {
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;

    if (!email || !key || !projectId) {
      throw new Error('Missing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_CLOUD_PROJECT.');
    }

    const credentials = { client_email: email, private_key: key };

    const pubsub = new PubSub({ projectId, credentials });
    const storage = new Storage({ projectId, credentials });

    const topics = ['agent-orchestration', 'local-tasks'];
    
    for (const topicName of topics) {
      const topic = pubsub.topic(topicName);
      const [exists] = await topic.exists();
      if (!exists) {
        console.log(`Creating topic: ${topicName}`);
        await pubsub.createTopic(topicName);
      } else {
        console.log(`Topic ${topicName} already exists.`);
      }
    }

    const bucketName = process.env.GCS_BUCKET_NAME || 'trans4mers-agent-workspace';
    const bucket = storage.bucket(bucketName);
    const [bucketExists] = await bucket.exists();
    
    if (!bucketExists) {
      console.log(`Creating bucket: ${bucketName}`);
      await storage.createBucket(bucketName, {
        location: 'US',
      });
    } else {
      console.log(`Bucket ${bucketName} already exists.`);
    }

    console.log('Infrastructure provisioned successfully.');
  } catch (error: unknown) {
    console.error('Error provisioning infrastructure:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

provisionInfrastructure();

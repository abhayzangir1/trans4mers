import { Storage } from '@google-cloud/storage';
import { getAgentAuth } from '../auth';

export class GCSFileManager {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME!;
    if (!this.bucketName) {
      throw new Error('Missing process.env.GCS_BUCKET_NAME');
    }

    const auth = getAgentAuth();
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      }
    });
  }

  async listFiles(prefix?: string) {
    const [files] = await this.storage.bucket(this.bucketName).getFiles({ prefix });
    return files.map(f => f.name);
  }

  async readFile(fileName: string): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(fileName);
    const [contents] = await file.download();
    return contents.toString('utf-8');
  }

  async writeFile(fileName: string, content: string): Promise<void> {
    const file = this.storage.bucket(this.bucketName).file(fileName);
    await file.save(content);
  }

  async deleteFile(fileName: string): Promise<void> {
    const file = this.storage.bucket(this.bucketName).file(fileName);
    await file.delete();
  }
}

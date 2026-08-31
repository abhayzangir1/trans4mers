import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const isCloudRun = !!process.env.K_SERVICE;
const bucketName = process.env.GCS_BUCKET_NAME || 'trans4mers-artifacts';

let storage: Storage | null = null;
if (isCloudRun) {
  storage = new Storage();
}

export class FileSystem {
  static async readFile(filePath: string): Promise<string> {
    if (isCloudRun && storage) {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      const [contents] = await file.download();
      return contents.toString('utf-8');
    } else {
      const fullPath = path.resolve(process.cwd(), filePath);
      return await fs.readFile(fullPath, 'utf-8');
    }
  }

  static async readFileBuffer(filePath: string): Promise<Buffer> {
    if (isCloudRun && storage) {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      const [contents] = await file.download();
      return contents;
    } else {
      const fullPath = path.resolve(process.cwd(), filePath);
      return await fs.readFile(fullPath);
    }
  }

  static async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    if (isCloudRun && storage) {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      await file.save(content);
    } else {
      const fullPath = path.resolve(process.cwd(), filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    if (isCloudRun && storage) {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      await file.delete({ ignoreNotFound: true });
    } else {
      const fullPath = path.resolve(process.cwd(), filePath);
      try {
        await fs.unlink(fullPath);
      } catch (err: unknown) {
        if (((err as Error & { code?: string }).code) !== 'ENOENT') throw err;
      }
    }
  }

  static async deleteDirectory(directoryPath: string): Promise<void> {
    if (isCloudRun && storage) {
      const bucket = storage.bucket(bucketName);
      await bucket.deleteFiles({ prefix: directoryPath });
    } else {
      const fullPath = path.resolve(process.cwd(), directoryPath);
      try {
        await fs.rm(fullPath, { recursive: true, force: true });
      } catch (err: unknown) {
        console.warn(`Failed to delete directory ${fullPath}:`, err);
      }
    }
  }

  static async listFiles(directoryPath: string): Promise<string[]> {
    if (isCloudRun && storage) {
       const bucket = storage.bucket(bucketName);
       const [files] = await bucket.getFiles({ prefix: directoryPath });
       return files.map(f => f.name);
    } else {
       const fullPath = path.resolve(process.cwd(), directoryPath);
       try {
           const dirents = await fs.readdir(fullPath, { withFileTypes: true, recursive: true });
           return dirents.filter(d => d.isFile()).map(d => path.join(d.parentPath, d.name).replace(process.cwd() + path.sep, ''));
       } catch (err: unknown) {
           if (((err as Error & { code?: string }).code) === 'ENOENT') return [];
           throw err;
       }
    }
  }
}

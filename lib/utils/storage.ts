import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET } from '@/lib/r2/client';

const SIGNED_URL_EXPIRES = 3600; // 1 hour

export async function uploadBuffer(
  buffer: Buffer,
  storagePath: string,
  contentType = 'video/mp4'
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

// Alias kept for compatibility
export const uploadVideo = uploadBuffer;

export async function getSignedUrl(storagePath: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: storagePath,
  });
  return awsGetSignedUrl(r2, command, { expiresIn: SIGNED_URL_EXPIRES });
}

export async function downloadToBuffer(storagePath: string): Promise<Buffer> {
  const response = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: storagePath })
  );

  if (!response.Body) throw new Error(`R2: objeto vacío en ${storagePath}`);

  // response.Body is a ReadableStream (Node.js)
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(storagePath: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: storagePath }));
}

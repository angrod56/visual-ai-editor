import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
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

/**
 * Download only the first `maxBytes` of a file using an HTTP Range request.
 * Much faster than downloading the full video when you only need a thumbnail.
 */
export async function downloadPartialBuffer(
  storagePath: string,
  maxBytes = 8 * 1024 * 1024 // 8 MB default
): Promise<Buffer> {
  const response = await r2.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: storagePath,
      Range: `bytes=0-${maxBytes - 1}`,
    })
  );
  if (!response.Body) throw new Error(`R2: objeto vacío en ${storagePath}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Stream a fetch Response body directly to R2 using multipart upload.
 * Never buffers the full video on disk or in memory — parts are uploaded
 * as they arrive, so total time ≈ max(download, upload) instead of sum.
 * Minimum part size: 5 MB (AWS requirement, except last part).
 */
export async function uploadStream(
  response: Response,
  storagePath: string,
  contentType = 'video/mp4'
): Promise<number> {
  const PART_SIZE = 5 * 1024 * 1024; // 5 MB minimum

  const { UploadId } = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: storagePath,
      ContentType: contentType,
    })
  );

  if (!UploadId) throw new Error('R2: no UploadId returned');

  const parts: { PartNumber: number; ETag: string }[] = [];
  let partNumber = 1;
  let buffer = Buffer.alloc(0);
  let totalBytes = 0;

  try {
    const reader = response.body!.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffer = Buffer.concat([buffer, Buffer.from(value)]);
        totalBytes += value.length;
      }

      // Upload a part when we have enough data, or on the final chunk
      if (buffer.length >= PART_SIZE || (done && buffer.length > 0)) {
        const { ETag } = await r2.send(
          new UploadPartCommand({
            Bucket: R2_BUCKET,
            Key: storagePath,
            UploadId,
            PartNumber: partNumber,
            Body: buffer,
            ContentLength: buffer.length,
          })
        );
        if (!ETag) throw new Error(`R2: no ETag for part ${partNumber}`);
        parts.push({ PartNumber: partNumber, ETag });
        partNumber++;
        buffer = Buffer.alloc(0);
      }

      if (done) break;
    }

    await r2.send(
      new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: storagePath,
        UploadId,
        MultipartUpload: { Parts: parts },
      })
    );

    return totalBytes;
  } catch (err) {
    await r2.send(
      new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: storagePath, UploadId })
    ).catch(() => {});
    throw err;
  }
}

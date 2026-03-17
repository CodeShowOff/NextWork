import { requestJson } from './http';

export interface UploadContract {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export async function createUploadContract(payload: {
  fileName: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'application/pdf';
  sizeBytes?: number;
}) {
  return requestJson<UploadContract>('/media/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadAttachmentWithContract(params: {
  localUri: string;
  fileName: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'application/pdf';
  sizeBytes?: number;
}) {
  const contract = await createUploadContract({
    fileName: params.fileName,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
  });

  const localResponse = await fetch(params.localUri);
  const blob = await localResponse.blob();

  const uploadResponse = await fetch(contract.uploadUrl, {
    method: 'PUT',
    headers: {
      ...contract.headers,
      'Content-Type': params.contentType,
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed with status ${uploadResponse.status}`);
  }

  return {
    ...contract,
    sizeBytes: params.sizeBytes ?? blob.size,
  };
}

export const uploadImageWithContract = uploadAttachmentWithContract;

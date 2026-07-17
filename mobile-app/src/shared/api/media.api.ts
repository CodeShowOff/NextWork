import { requestJson } from './http';
import { i18n } from '../i18n/i18n';

export interface UploadContract {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export async function createUploadContract(payload: {
  fileName: string;
  contentType: SupportedUploadContentType;
  sizeBytes?: number;
  groupId?: string;
}) {
  return requestJson<UploadContract>('/media/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadAttachmentWithContract(params: {
  localUri: string;
  fileName: string;
  contentType: SupportedUploadContentType;
  sizeBytes?: number;
  groupId?: string;
}) {
  const contract = await createUploadContract({
    fileName: params.fileName,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
    groupId: params.groupId,
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
    throw new Error(i18n.t('ui.states.uploadFailedStatus', { status: uploadResponse.status }));
  }

  const completed = await completeUpload(contract.mediaId);

  return {
    ...contract,
    sizeBytes: params.sizeBytes ?? blob.size,
    completion: completed,
  };
}

export const uploadImageWithContract = uploadAttachmentWithContract;

export type SupportedUploadContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'video/mp4'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function completeUpload(mediaId: string) {
  return requestJson<{
    mediaId: string;
    status: 'scanning' | 'available' | 'quarantined' | 'rejected';
    downloadUrl: string | null;
  }>('/media/uploads/complete', {
    method: 'POST',
    body: JSON.stringify({ mediaId }),
  });
}

export function getMediaDownload(mediaId: string) {
  return requestJson<{ mediaId: string; downloadUrl: string; expiresInSeconds: number }>(`/media/${mediaId}/download`);
}

export function getMediaStatus(mediaId: string) {
  return requestJson<{
    mediaId: string;
    status: 'pending_upload' | 'scanning' | 'available' | 'quarantined' | 'rejected' | 'deleted';
    scanDetail: string | null;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }>(`/media/${mediaId}`);
}

import { requestJson } from './http';

export interface GroupFile {
  id: string;
  groupId: string;
  mediaId: string;
  title: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  uploadedBy: { id: string; displayName: string; avatarUrl: string | null };
}

export interface GroupAlbum {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  photoCount: number;
  createdBy: { id: string; displayName: string; avatarUrl: string | null };
}

export interface GroupAlbumPhoto {
  id: string;
  mediaId: string;
  caption: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  uploadedBy: { id: string; displayName: string; avatarUrl: string | null };
}

export interface GroupEvent {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string; avatarUrl: string | null };
  rsvp: 'going' | 'maybe' | 'declined' | null;
  attendeeCounts: { going: number; maybe: number; declined: number };
}

export interface LiveSession {
  id: string;
  groupId: string;
  roomName: string;
  startedById: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

export function listGroupFiles(groupId: string) {
  return requestJson<{ groupId: string; items: GroupFile[] }>(`/groups/${groupId}/files`);
}

export function createGroupFile(groupId: string, payload: { mediaId: string; title?: string }) {
  return requestJson<GroupFile>(`/groups/${groupId}/files`, { method: 'POST', body: JSON.stringify(payload) });
}

export function getGroupFileDownload(groupId: string, fileId: string) {
  return requestJson<{ mediaId: string; downloadUrl: string; expiresInSeconds: number }>(`/groups/${groupId}/files/${fileId}/download`);
}

export function deleteGroupFile(groupId: string, fileId: string) {
  return requestJson<{ status: 'ok' }>(`/groups/${groupId}/files/${fileId}`, { method: 'DELETE' });
}

export function listGroupAlbums(groupId: string) {
  return requestJson<{ groupId: string; items: GroupAlbum[] }>(`/groups/${groupId}/albums`);
}

export function createGroupAlbum(groupId: string, payload: { title: string; description?: string }) {
  return requestJson<GroupAlbum>(`/groups/${groupId}/albums`, { method: 'POST', body: JSON.stringify(payload) });
}

export function getGroupAlbum(groupId: string, albumId: string) {
  return requestJson<GroupAlbum & { groupId: string; photos: GroupAlbumPhoto[] }>(`/groups/${groupId}/albums/${albumId}`);
}

export function addGroupAlbumPhoto(groupId: string, albumId: string, payload: { mediaId: string; caption?: string }) {
  return requestJson<{ id: string; mediaId: string }>(`/groups/${groupId}/albums/${albumId}/photos`, { method: 'POST', body: JSON.stringify(payload) });
}

export function getGroupAlbumPhotoDownload(groupId: string, albumId: string, photoId: string) {
  return requestJson<{ mediaId: string; downloadUrl: string; expiresInSeconds: number }>(`/groups/${groupId}/albums/${albumId}/photos/${photoId}/download`);
}

export function deleteGroupAlbumPhoto(groupId: string, albumId: string, photoId: string) {
  return requestJson<{ status: 'ok' }>(`/groups/${groupId}/albums/${albumId}/photos/${photoId}`, { method: 'DELETE' });
}

export function listGroupEvents(groupId: string) {
  return requestJson<{ groupId: string; items: GroupEvent[] }>(`/groups/${groupId}/events`);
}

export function createGroupEvent(groupId: string, payload: { title: string; description?: string; location?: string; startsAt: string; endsAt?: string; timezone: string }) {
  return requestJson<GroupEvent>(`/groups/${groupId}/events`, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateGroupEvent(groupId: string, eventId: string, payload: Partial<{ title: string; description: string; location: string; startsAt: string; endsAt: string; timezone: string }>) {
  return requestJson<GroupEvent>(`/groups/${groupId}/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteGroupEvent(groupId: string, eventId: string) {
  return requestJson<{ status: 'ok' }>(`/groups/${groupId}/events/${eventId}`, { method: 'DELETE' });
}

export function setGroupEventRsvp(groupId: string, eventId: string, status: 'going' | 'maybe' | 'declined') {
  return requestJson<GroupEvent>(`/groups/${groupId}/events/${eventId}/rsvp`, { method: 'PUT', body: JSON.stringify({ status }) });
}

export function exportGroupEventCalendar(groupId: string, eventId: string) {
  return requestJson<{ fileName: string; contentType: string; content: string }>(`/groups/${groupId}/events/${eventId}/calendar`);
}

export function getGroupLiveSession(groupId: string) {
  return requestJson<{ session: LiveSession | null }>(`/groups/${groupId}/live`);
}

export function startGroupLiveSession(groupId: string) {
  return requestJson<LiveSession & { started: boolean; serverUrl: string; token: string; expiresInSeconds: number }>(`/groups/${groupId}/live/start`, { method: 'POST' });
}

export function joinGroupLiveSession(groupId: string) {
  return requestJson<LiveSession & { serverUrl: string; token: string; expiresInSeconds: number }>(`/groups/${groupId}/live/join`, { method: 'POST' });
}

export function endGroupLiveSession(groupId: string) {
  return requestJson<{ status: 'ok' }>(`/groups/${groupId}/live/end`, { method: 'POST' });
}

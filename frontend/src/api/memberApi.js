import client from './client.js';

// GET /api/members/next-id -> { memberId } e.g. "PIC-2026-02-0001"
export async function getNextMemberId() {
  const { data } = await client.get('/members/next-id');
  return data.memberId;
}

/**
 * POST /api/members/photo (multipart) -> the stored photo
 *
 * `blob` is the already-cropped bitmap from components/photo/PhotoCropModal.jsx,
 * so the stored image is the crop the member chose.
 *
 * Content-Type is deliberately left to axios: the header has to carry the
 * multipart boundary, and setting it by hand — as src/api/submissionApi.js:18
 * does — leaves axios no boundary to send and the server cannot find the file.
 * The 20s default in client.js is also too tight for a few hundred kilobytes on
 * a phone connection, hence the per-request timeout.
 */
export async function uploadMyPhoto(blob) {
  const form = new FormData();
  form.append('photo', blob, 'card-photo.jpg');
  const { data } = await client.post('/members/photo', form, { timeout: 60000 });
  return data.photo;
}

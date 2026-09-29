import client from './client.js';
export async function createSubmission(templateId, fields) {
  const { data } = await client.post('/submissions', { templateId, fields });
  return data;
}

// PATCH /api/submissions/:id -> { status }
export async function updateSubmission(id, fields) {
  const { data } = await client.patch(`/submissions/${id}`, { fields });
  return data;
}

// POST /api/submissions/:id/photo (multipart) -> { processedPhotoUrl }
export async function uploadPhoto(id, file, cropRect) {
  const form = new FormData();
  form.append('photo', file);
  form.append('cropRect', JSON.stringify(cropRect));
  // Content-Type is left to axios on purpose: a multipart header has to carry
  // the boundary, and setting it by hand drops the boundary along with the file
  // the server is trying to read.
  const { data } = await client.post(`/submissions/${id}/photo`, form, { timeout: 60000 });
  return data;
}

// POST /api/submissions/:id/generate -> { frontImageUrl, backImageUrl, pdfUrl }
export async function generateSubmission(id) {
  const { data } = await client.post(`/submissions/${id}/generate`);
  return data;
}

// GET /api/submissions/:id -> full submission doc
export async function getSubmission(id) {
  const { data } = await client.get(`/submissions/${id}`);
  return data;
}

// GET /api/submissions/:id/download -> streams the final PDF; just build the URL
export function getDownloadUrl(id) {
  const base = client.defaults.baseURL.replace(/\/$/, '');
  return `${base}/submissions/${id}/download`;
}

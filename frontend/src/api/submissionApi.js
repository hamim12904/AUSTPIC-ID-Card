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
  const { data } = await client.post(`/submissions/${id}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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

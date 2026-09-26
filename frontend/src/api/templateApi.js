import client from './client.js';
import { template as localTemplate } from '../config/template.js';

/**
 * GET /api/templates/:name
 * Falls back to the locally bundled template config (src/config/template.js)
 * if the backend isn't up yet, so the frontend is buildable standalone
 * during Phase 4 before Phase 3 (backend API) has landed. Once the real
 * route exists, this silently prefers it.
 */
export async function getTemplate(name = localTemplate.templateId) {
  try {
    const { data } = await client.get(`/templates/${name}`);
    return data;
  } catch (err) {
    console.warn(
      `[templateApi] Falling back to local template config ("${name}" not reachable from backend yet):`,
      err?.message || err
    );
    return localTemplate;
  }
}

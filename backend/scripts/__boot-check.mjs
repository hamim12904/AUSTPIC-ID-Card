import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', '.env') });

const { missingCloudinaryVars, isCloudinaryConfigured } = await import('../utils/cloudinary.js');

console.log('missingCloudinaryVars =', JSON.stringify(missingCloudinaryVars()));
console.log('isCloudinaryConfigured =', isCloudinaryConfigured());

const { default: app } = await import('../index.js');
const mongoose = (await import('mongoose')).default;

const server = app.listen(5099, async () => {
  const res = await fetch('http://127.0.0.1:5099/api/health');
  console.log('GET /api/health ->', res.status, JSON.stringify(await res.json()));
  server.close(() => process.exit(0));
});

await mongoose.disconnect().catch(() => {});

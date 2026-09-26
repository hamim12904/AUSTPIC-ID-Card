import { Router } from 'express';
import { login, signup, me } from '../controller/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Mounted at /api/auth (see server/index.js).
const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);

export default router;

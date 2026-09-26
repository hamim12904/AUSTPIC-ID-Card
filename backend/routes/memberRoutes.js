import { Router } from 'express';
import { getNextMemberId } from '../controller/memberController.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Mounted at /api/members (see server/index.js). Note the plural mount
// matches src/api/memberApi.js, which calls '/members/next-id'.
const router = Router();

// Member ids are only handed out to logged-in users.
router.get('/next-id', requireAuth, getNextMemberId);

export default router;

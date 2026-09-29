import { Router } from 'express';
import { getNextMemberId } from '../controller/memberController.js';
import { uploadPhoto } from '../controller/photoController.js';
import { photoUpload } from '../middleware/uploadPhoto.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Mounted at /api/members (see server/index.js). Note the plural mount
// matches src/api/memberApi.js, which calls '/members/next-id'.
const router = Router();

// Member ids are only handed out to logged-in users.
router.get('/next-id', requireAuth, getNextMemberId);

// The card photo, also owner-scoped: the public id is the signed-in user's own
// id (see controller/photoController.js), so one member cannot overwrite
// another's picture. photoUpload is the multipart reader and must run before the
// handler, which is where the bytes already are.
router.post('/photo', requireAuth, photoUpload, uploadPhoto);

export default router;

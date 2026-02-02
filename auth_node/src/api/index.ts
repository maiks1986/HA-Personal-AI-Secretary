import { Router } from 'express';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';

const router = Router();

router.use('/auth', authRoutes);
router.use('/oauth', oauthRoutes);

export default router;

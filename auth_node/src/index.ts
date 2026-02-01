import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './api';
import { CONFIG } from './config';
import path from 'path';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api', apiRoutes);

// Serve Frontend (Placeholder for now)
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
    // If not an API call, serve index.html
    if (!req.path.startsWith('/api')) {
         const index = path.join(__dirname, '../frontend/dist/index.html');
         // Check if file exists to avoid crash
         // res.sendFile(index);
         res.send('Frontend not built yet. API is running on /api');
    }
});

app.listen(CONFIG.port, () => {
    console.log(`Identity Gate running on port ${CONFIG.port}`);
    console.log(`Environment: ${CONFIG.jwtSecret === 'dev-secret-change-me' ? 'DEVELOPMENT' : 'PRODUCTION'}`);
});

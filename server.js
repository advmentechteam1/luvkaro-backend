const express = require('express');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { initSocketManager } = require('./socket/socketManager');

// Load environment variables reliably from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize database connection
const { initDatabase } = require('./database/connection');
initDatabase(); // Auto-connect on start

// Initialize Express app & HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

// Initialize Real-Time Socket Manager
initSocketManager(io);

// Security Middlewares
app.use(helmet());

// Rate Limiting (Permissive in development & always skips health/localhost)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 2000 : 50000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Never throttle health check or local development
    if (req.path === '/health' || req.path === '/health/reconnect') return true;
    if (process.env.NODE_ENV !== 'production') return true;
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
  },
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use('/api', limiter);

// Standard Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Base Route
app.get('/', (req, res) => {
  res.send('💖 LoveKaro API & Real-Time Socket Server is running smoothly...');
});

// Mount API Routes (Supports both /api and /api/v1 for Web & Mobile App clients)
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// Error Handling Middlewares
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

// Start Server
const PORT = parseInt(process.env.PORT || '5000', 10);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use by another process.`);
    console.error(`👉 Tip: Kill the old process using: npx kill-port ${PORT} (or close other terminal), then run 'npm run dev' again.\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err.message);
  }
});

process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ Unhandled Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.warn('⚠️ Uncaught Exception:', err?.message || err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LoveKaro Backend Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

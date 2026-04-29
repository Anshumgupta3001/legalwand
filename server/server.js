require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes   = require('./routes/authRoutes');
const chatRoutes   = require('./routes/chatRoutes');
const newsRoutes   = require('./routes/newsRoutes');
const fileRoutes   = require('./routes/fileRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes  = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const pdfRoutes    = require('./routes/pdfRoutes');
const aiUploadRoutes        = require('./routes/aiUploadRoutes');
const aiChatUpdatedRoutes   = require('./routes/aiChatUpdatedRoutes');
const analyticsRoutes       = require('./routes/analyticsRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  })
);

// Increased from 10mb → 50mb for larger JSON payloads.
// Note: large file uploads use multipart/form-data via multer (no JSON limit applies there).
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)\x1b[0m`);
  });
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GSTWand API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth',      authRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/news',      newsRoutes);
app.use('/api/file',      fileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/upload',    uploadRoutes);  // multi-file disk upload
app.use('/api/pdf',       pdfRoutes);     // puppeteer PDF export
app.use('/api/documents',  aiUploadRoutes);       // AI-powered document library
app.use('/api/ai-chat',   aiChatUpdatedRoutes);   // GST case law RAG chat
app.use('/api/analytics', analyticsRoutes);        // MongoDB aggregation analytics

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 GSTWand Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

module.exports = app;

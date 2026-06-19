const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// In-memory store for file metadata (use DB in production)
const fileStore = new Map();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  }
});

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/csv', 'text/html',
  'application/zip', 'application/x-zip-compressed',
  'application/json',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed.`));
    }
  }
});

// Helper: format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper: get file category
function getCategory(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('text/')) return 'text';
  if (mimetype.includes('zip')) return 'archive';
  if (mimetype.includes('word') || mimetype.includes('spreadsheet') || mimetype.includes('excel')) return 'document';
  return 'other';
}

// POST /api/upload — upload one or more files
app.post('/api/upload', (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB per file.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const uploaded = req.files.map(file => {
      const id = path.basename(file.filename, path.extname(file.filename));
      const meta = {
        id,
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        sizeFormatted: formatBytes(file.size),
        category: getCategory(file.mimetype),
        uploadedAt: new Date().toISOString(),
        downloads: 0,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };
      fileStore.set(id, meta);
      return { ...meta, downloadUrl: `/api/download/${id}`, previewUrl: `/api/preview/${id}` };
    });

    res.json({ success: true, files: uploaded });
  });
});

// GET /api/files — list all files
app.get('/api/files', (req, res) => {
  const files = Array.from(fileStore.values())
    .filter(f => new Date(f.expiresAt) > new Date())
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .map(f => ({ ...f, downloadUrl: `/api/download/${f.id}`, previewUrl: `/api/preview/${f.id}` }));
  res.json({ files });
});

// GET /api/download/:id — download a file
app.get('/api/download/:id', (req, res) => {
  const meta = fileStore.get(req.params.id);
  if (!meta) return res.status(404).json({ error: 'File not found or expired.' });

  const filePath = path.join(UPLOADS_DIR, meta.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk.' });

  meta.downloads++;
  res.download(filePath, meta.originalName);
});

// GET /api/preview/:id — preview a file (images, PDFs)
app.get('/api/preview/:id', (req, res) => {
  const meta = fileStore.get(req.params.id);
  if (!meta) return res.status(404).json({ error: 'File not found.' });

  const filePath = path.join(UPLOADS_DIR, meta.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk.' });

  res.setHeader('Content-Type', meta.mimetype);
  res.setHeader('Content-Disposition', `inline; filename="${meta.originalName}"`);
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /api/delete/:id
app.delete('/api/delete/:id', (req, res) => {
  const meta = fileStore.get(req.params.id);
  if (!meta) return res.status(404).json({ error: 'File not found.' });

  const filePath = path.join(UPLOADS_DIR, meta.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  fileStore.delete(req.params.id);

  res.json({ success: true, message: 'File deleted.' });
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  const files = Array.from(fileStore.values());
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const categories = files.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {});
  res.json({
    totalFiles: files.length,
    totalSize: formatBytes(totalSize),
    totalDownloads: files.reduce((acc, f) => acc + f.downloads, 0),
    categories
  });
});

// Cleanup expired files every hour
setInterval(() => {
  const now = new Date();
  for (const [id, meta] of fileStore.entries()) {
    if (new Date(meta.expiresAt) < now) {
      const filePath = path.join(UPLOADS_DIR, meta.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      fileStore.delete(id);
    }
  }
}, 60 * 60 * 1000);

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

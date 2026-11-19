const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    let defaultExt = '.jpg';
    if (file.mimetype.startsWith('video/')) defaultExt = '.mp4';
    else if (file.mimetype.startsWith('audio/')) defaultExt = '.webm';

    const ext = path.extname(file.originalname).toLowerCase() || defaultExt;
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    cb(null, `${cleanBase}_${unique}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  const isAudio = file.mimetype.startsWith('audio/') || /\.(webm|mp3|wav|ogg|m4a|aac|flac)$/i.test(file.originalname);

  if (isImage || isVideo || isAudio) {
    return cb(null, true);
  }

  cb(new Error('Invalid file format. Please upload an image (JPG, PNG, WEBP, GIF), video (MP4, WEBM, MOV), or audio file (WEBM, MP3, WAV, OGG, M4A).'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

module.exports = upload;

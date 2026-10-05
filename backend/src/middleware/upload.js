const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { ErroHttp } = require('../utils/helpers');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!permitidos.includes(file.mimetype)) {
      return cb(new ErroHttp(400, 'Apenas imagens JPG, PNG ou WEBP são aceitas.'));
    }
    cb(null, true);
  },
});

module.exports = upload;

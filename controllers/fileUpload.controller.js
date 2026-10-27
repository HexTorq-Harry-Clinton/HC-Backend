const multer = require('multer');
const fs = require('fs');
const path = require('path');

/**
 * @param {Object} options
 * @param {string} options.baseDir      Absolute path on disk where files go
 * @param {string} options.virtualBase  The “~”-prefix you return to clients
 */
function createFileUploader({ baseDir, virtualBase }) {
  // 1) Multer storage that uses req.body.path (will be populated by multer itself)
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // at this point multer has already parsed text fields into req.body
      // console.log("PATH FROM BODY",req)
      console.log("BODY", req.body)
      const raw = (req.body.path || '').trim();
      console.log("RAW PATH", raw)
      const subdir = path.normalize(raw).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^([/\\])+/, '');
      console.log("SUBDIR", subdir)
      const uploadDir = path.join(baseDir, subdir);
      console.log("UPLOAD DIR", uploadDir)

      fs.mkdir(uploadDir, { recursive: true }, err => cb(err, uploadDir));
    },
    filename: (req, file, cb) => {
      const ts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
        .format(new Date())
        .replace(/[-: ]/g, '');

      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${ts}_${safeName}`);
    }
  });

  // 2) Tell multer to accept two fields: 
  //    • "path" as text, maxCount:1 
  //    • "file" as file,    maxCount:1
  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const allowedMime = /^(image\/(jpeg|png|gif|webp|avif)|video\/(mp4|webm|quicktime|x-msvideo|x-matroska))$/i;
      const allowedExt = /\.(jpe?g|png|gif|webp|avif|mp4|webm|mov|avi|mkv)$/i;
      if (!allowedMime.test(file.mimetype) || !allowedExt.test(file.originalname)) {
        return cb(new Error('Only supported image and video files are allowed.'));
      }
      return cb(null, true);
    },
  }).fields([
    { name: 'path', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);

  // 3) Final handler
  function handler(req, res) {
    // multer.fields puts files into req.files.file as an array
    const fileArray = req.files?.file;
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // sanitize the folder again for the virtual path
    const raw = Array.isArray(req.body.path) ? req.body.path[0] : req.body.path || '';
    const subdir = path.normalize(raw).replace(/^(\.\.(\/|\\|$))+/, '');

    const file = fileArray[0];
    // build the client-facing path, always with forward slashes
    const image = path.posix.join(virtualBase, subdir, file.filename);
    console.log("IMAGE PATH", image)
    res.json({
      message: 'File uploaded successfully',
      virtualPath: image
    });
  }

  return { upload, handler };
}

module.exports = createFileUploader;

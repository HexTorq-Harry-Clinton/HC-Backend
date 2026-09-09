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
      const subdir = path.normalize(raw).replace(/^(\.\.(\/|\\|$))+/, '');
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

      cb(null, `${ts}_${file.originalname}`);
    }
  });

  // 2) Tell multer to accept two fields: 
  //    • "path" as text, maxCount:1 
  //    • "file" as file,    maxCount:1
  const upload = multer({ storage }).fields([
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

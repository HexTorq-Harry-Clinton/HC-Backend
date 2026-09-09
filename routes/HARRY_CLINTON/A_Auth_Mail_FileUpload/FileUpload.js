const express = require('express');
const path = require('path');
const createFileUploader = require('../../../controllers/fileUpload.controller');
const PROJECT_NAME = 'HARRY_CLINTON';
const router = express.Router();

const baseDir = path.join(process.cwd(), 'Uploads', PROJECT_NAME);
const virtualBase = `~/Uploads/${PROJECT_NAME}`;
const { upload, handler } = createFileUploader({ baseDir, virtualBase });

router.post('/', upload, handler);

module.exports = router;
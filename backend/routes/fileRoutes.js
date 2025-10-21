// routes/fileRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const auth = require('../middleware/auth');
const File = require('../models/File');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'), false);
    }
  }
});

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        error: 'No file uploaded'
      });
    }

    const file = new File({
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      user: req.user._id
    });

    await file.save();

    res.status(201).json({
      status: 'success',
      message: 'File uploaded successfully',
      data: {
        file: {
          id: file._id,
          originalName: file.originalName,
          size: file.size,
          createdAt: file.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      status: 'error',
      error: 'File upload failed'
    });
  }
});

// Get user's files
router.get('/', auth, async (req, res) => {
  try {
    const files = await File.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('originalName size createdAt');

    res.json({
      status: 'success',
      data: { files }
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve files'
    });
  }
});

// Transform file (delete 3rd column)
router.post('/:id/transform', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user: req.user._id });
    if (!file) {
      return res.status(404).json({
        status: 'error',
        error: 'File not found'
      });
    }

    // Read the Excel file
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    let data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Remove 3rd column (index 2)
    data = data.map(row => {
      if (Array.isArray(row)) {
        row.splice(2, 1); // Remove 3rd column
      }
      return row;
    });

    // Create new worksheet
    const newWorksheet = xlsx.utils.aoa_to_sheet(data);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);

    // Save transformed file
    const transformedFilename = 'transformed-' + file.filename;
    const transformedPath = path.join(path.dirname(file.path), transformedFilename);
    xlsx.writeFile(newWorkbook, transformedPath);

    // Create new file record
    const transformedFile = new File({
      originalName: 'transformed-' + file.originalName,
      filename: transformedFilename,
      path: transformedPath,
      size: fs.statSync(transformedPath).size,
      mimetype: file.mimetype,
      user: req.user._id
    });

    await transformedFile.save();

    res.json({
      status: 'success',
      message: 'File transformed successfully',
      data: {
        file: {
          id: transformedFile._id,
          originalName: transformedFile.originalName,
          size: transformedFile.size,
          createdAt: transformedFile.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Transform error:', error);
    res.status(500).json({
      status: 'error',
      error: 'File transformation failed'
    });
  }
});

// Visualize file (generate pie chart data)
router.get('/:id/visualize', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user: req.user._id });
    if (!file) {
      return res.status(404).json({
        status: 'error',
        error: 'File not found'
      });
    }

    // Read the Excel file
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'File is empty'
      });
    }

    // Get column headers
    const headers = Object.keys(data[0]);

    if (headers.length < 2) {
      return res.status(400).json({
        status: 'error',
        error: 'File must have at least 2 columns'
      });
    }

    // Use first column as labels, second as values
    const labelColumn = headers[0];
    const valueColumn = headers[1];

    const chartData = data.map(row => ({
      label: row[labelColumn],
      value: parseFloat(row[valueColumn]) || 0
    })).filter(item => item.label && item.value > 0);

    res.json({
      status: 'success',
      data: {
        chartData,
        title: `Visualization of ${file.originalName}`,
        labelColumn,
        valueColumn
      }
    });
  } catch (error) {
    console.error('Visualization error:', error);
    res.status(500).json({
      status: 'error',
      error: 'File visualization failed'
    });
  }
});

module.exports = router;

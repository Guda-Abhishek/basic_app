// routes/transformRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const File = require('../models/File');
const auth = require('../middleware/auth');
const calculateSha256 = require('../utils/calculateSha256');

// Constants
const TRANSFORM_TYPES = ['filter', 'sort', 'aggregate', 'pivot', 'chart'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/json'
];

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Rate limiting
const transformLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 transformations per window
  message: 'Too many transformations from this IP, please try again after 15 minutes'
});

// File filter
const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only Excel, CSV, and JSON files are allowed.'), false);
  }
  cb(null, true);
};

// Multer setup
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const userDir = path.join(UPLOAD_DIR, 'transformations', req.user.id);
      await fs.mkdir(userDir, { recursive: true });
      cb(null, userDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `transform-${timestamp}-${random}-${sanitizedFilename}`);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

// Validation middleware
const validateTransformRequest = [
  body('transformations')
    .isArray({ min: 1 })
    .withMessage('At least one transformation is required'),
  body('transformations.*.type')
    .isIn(TRANSFORM_TYPES)
    .withMessage(`Transform type must be one of: ${TRANSFORM_TYPES.join(', ')}`),
  body('transformations.*.parameters')
    .exists()
    .withMessage('Transformation parameters are required'),
  body('originalFileId')
    .optional()
    .isMongoId()
    .withMessage('Invalid file ID format')
];

// Helper function to transform data
async function transformData(data, transformations) {
  const transformedData = [...data];
  const metadata = {
    rowCount: data.length,
    columnCount: data[0]?.length || 0,
    headers: data[0] || [],
    dataTypes: new Map(),
    summary: new Map()
  };

  for (const transform of transformations) {
    switch (transform.type) {
      case 'filter':
        const { column, operator, value } = transform.parameters;
        const colIndex = data[0].indexOf(column);
        if (colIndex !== -1) {
          transformedData.splice(1, transformedData.length - 1, 
            ...transformedData.slice(1).filter(row => {
              const cellValue = row[colIndex];
              switch (operator) {
                case 'equals': return cellValue == value;
                case 'notEquals': return cellValue != value;
                case 'greaterThan': return cellValue > value;
                case 'lessThan': return cellValue < value;
                case 'contains': return String(cellValue).includes(value);
                default: return true;
              }
            })
          );
        }
        break;

      case 'sort':
        const { columns, directions } = transform.parameters;
        const sortIndices = columns.map(col => data[0].indexOf(col));
        transformedData.splice(1, transformedData.length - 1,
          ...transformedData.slice(1).sort((a, b) => {
            for (let i = 0; i < sortIndices.length; i++) {
              const index = sortIndices[i];
              const direction = directions[i] === 'desc' ? -1 : 1;
              if (a[index] < b[index]) return -1 * direction;
              if (a[index] > b[index]) return 1 * direction;
            }
            return 0;
          })
        );
        break;

      case 'aggregate':
        const { groupBy, metrics } = transform.parameters;
        const groupIndex = data[0].indexOf(groupBy);
        const metricIndices = metrics.map(m => ({
          ...m,
          index: data[0].indexOf(m.column)
        }));

        if (groupIndex !== -1) {
          const groups = new Map();
          for (const row of transformedData.slice(1)) {
            const key = row[groupIndex];
            if (!groups.has(key)) {
              groups.set(key, []);
            }
            groups.get(key).push(row);
          }

          const aggregatedData = [
            [groupBy, ...metrics.map(m => `${m.function}_${m.column}`)]
          ];

          for (const [key, rows] of groups) {
            const aggregatedMetrics = metricIndices.map(({ index, function: fn }) => {
              const values = rows.map(row => parseFloat(row[index])).filter(v => !isNaN(v));
              switch (fn) {
                case 'sum': return values.reduce((a, b) => a + b, 0);
                case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
                case 'min': return Math.min(...values);
                case 'max': return Math.max(...values);
                case 'count': return values.length;
                default: return null;
              }
            });
            aggregatedData.push([key, ...aggregatedMetrics]);
          }

          transformedData.splice(0, transformedData.length, ...aggregatedData);
        }
        break;

      // Add more transformation types as needed
    }
  }

  // Calculate metadata
  metadata.rowCount = transformedData.length;
  metadata.columnCount = transformedData[0]?.length || 0;
  metadata.headers = transformedData[0] || [];

  // Analyze data types and generate summary
  if (transformedData.length > 1) {
    for (let i = 0; i < metadata.columnCount; i++) {
      const column = transformedData.slice(1).map(row => row[i]);
      const dataType = inferDataType(column);
      metadata.dataTypes.set(metadata.headers[i], dataType);

      // Generate column summary
      metadata.summary.set(metadata.headers[i], {
        nullCount: column.filter(v => v == null).length,
        uniqueCount: new Set(column).size,
        ...(dataType === 'number' ? {
          min: Math.min(...column.filter(v => !isNaN(v))),
          max: Math.max(...column.filter(v => !isNaN(v))),
          avg: column.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0) / column.length
        } : {
          mostCommon: findMostCommon(column)
        })
      });
    }
  }

  return { transformedData, metadata };
}

// Transform route
router.post('/', auth, transformLimiter, validateTransformRequest, upload.single('file'), async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        error: 'No file provided'
      });
    }

    // Parse transformations
    const transformations = JSON.parse(req.body.transformations);

    // Read file
    const workbook = XLSX.readFile(req.file.path, {
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false
    });

    // Apply transformations and get metadata
    const { transformedData, metadata } = await transformData(data, transformations);

    // Create new workbook
    const newWorksheet = XLSX.utils.aoa_to_sheet(transformedData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Transformed');

    // Save transformed file
    const transformedFilename = `transformed-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.xlsx`;
    const transformedPath = path.join(path.dirname(req.file.path), transformedFilename);
    XLSX.writeFile(newWorkbook, transformedPath);

    // Calculate SHA256
    const sha256 = await calculateSha256(transformedPath);

    // Save to DB
    const transformedFile = await File.create({
      userId: req.user.id,
      originalName: `transformed-${req.file.originalname}`,
      filename: transformedFilename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: (await fs.stat(transformedPath)).size,
      path: transformedPath,
      sha256,
      status: 'processed',
      metadata,
      transformations: transformations.map(t => ({
        type: t.type,
        parameters: t.parameters,
        appliedAt: Date.now()
      })),
      originalFileId: req.body.originalFileId || null
    });

    // Clean up original file
    await fs.unlink(req.file.path);

    // Send response
    res.status(201).json({
      status: 'success',
      message: 'File transformed successfully',
      data: {
        file: {
          id: transformedFile._id,
          name: transformedFile.originalName,
          size: transformedFile.size,
          transformations: transformedFile.transformations,
          metadata: transformedFile.metadata
        }
      }
    });
  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && existsSync(req.file.path)) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    console.error('Transform error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to transform file',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get transformation preview
router.post('/preview', auth, transformLimiter, validateTransformRequest, upload.single('file'), async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        error: 'No file provided'
      });
    }

    // Parse transformations
    const transformations = JSON.parse(req.body.transformations);

    // Read file
    const workbook = XLSX.readFile(req.file.path, {
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false
    });

    // Apply transformations and get preview (first 100 rows)
    const { transformedData, metadata } = await transformData(data, transformations);
    const preview = transformedData.slice(0, Math.min(100, transformedData.length));

    // Clean up uploaded file
    await fs.unlink(req.file.path);

    // Send response
    res.status(200).json({
      status: 'success',
      data: {
        preview,
        metadata,
        totalRows: transformedData.length,
        previewRows: preview.length
      }
    });
  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && existsSync(req.file.path)) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    console.error('Preview error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to generate preview',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to infer data type
function inferDataType(values) {
  const nonNull = values.filter(v => v != null);
  if (nonNull.length === 0) return 'unknown';

  const allNumbers = nonNull.every(v => !isNaN(v));
  if (allNumbers) return 'number';

  const allDates = nonNull.every(v => !isNaN(Date.parse(v)));
  if (allDates) return 'date';

  return 'string';
}

// Helper function to find most common value
function findMostCommon(values) {
  const counts = new Map();
  let maxCount = 0;
  let mostCommon = null;

  for (const value of values) {
    if (value == null) continue;
    const count = (counts.get(value) || 0) + 1;
    counts.set(value, count);
    if (count > maxCount) {
      maxCount = count;
      mostCommon = value;
    }
  }

  return mostCommon;
}

module.exports = router;

module.exports = router;

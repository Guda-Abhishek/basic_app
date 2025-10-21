const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = require('../server');
const User = require('../models/User');
const File = require('../models/File');

let authToken;

beforeAll(async () => {
  // Use existing test database connection
}, 30000);

afterAll(async () => {
  // Don't disconnect as the server manages the connection
}, 30000);

beforeEach(async () => {
  await User.deleteMany({});
  await File.deleteMany({});

  // Set environment variables for testing
  process.env.SKIP_EMAIL_VERIFICATION = 'true';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';

  // Create test user and get auth token
  const testUser = {
    fullName: 'Test User',
    email: 'test@example.com',
    phoneNumber: '6123456789',
    password: 'TestPass123!'
  };

  await User.create(testUser);

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .set('Accept', 'application/json')
    .send({
      emailOrPhone: testUser.email,
      password: testUser.password
    });

  authToken = loginResponse.body.data.token;
});

describe('File Operations', () => {
  describe('POST /api/files/upload', () => {
    it('should upload an Excel file successfully', async () => {
      const testFilePath = path.join(__dirname, '../../test.xlsx');

      // Create a test Excel file if it doesn't exist
      if (!fs.existsSync(testFilePath)) {
        const XLSX = require('xlsx');
        const data = [
          ['Name', 'Age', 'City', 'Salary'],
          ['John Doe', 30, 'New York', 50000],
          ['Jane Smith', 25, 'Los Angeles', 60000],
          ['Bob Johnson', 35, 'Chicago', 55000],
          ['Alice Brown', 28, 'Houston', 65000]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, testFilePath);
      }

      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.file.originalName).toBe('test.xlsx');
      expect(response.body.data.file.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      // Verify file was saved to database
      const savedFile = await File.findById(response.body.data.file._id);
      expect(savedFile).toBeTruthy();
      expect(savedFile.originalName).toBe('test.xlsx');

      // Verify file exists in uploads folder
      const uploadPath = path.join(__dirname, '../uploads', savedFile.filename);
      expect(fs.existsSync(uploadPath)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Accept', 'application/json')
        .expect(401);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/files', () => {
    beforeEach(async () => {
      // Upload a test file
      const testFilePath = path.join(__dirname, '../../test.xlsx');
      if (!fs.existsSync(testFilePath)) {
        const XLSX = require('xlsx');
        const data = [
          ['Name', 'Age', 'City', 'Salary'],
          ['John Doe', 30, 'New York', 50000]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, testFilePath);
      }

      await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath);
    });

    it('should retrieve user files', async () => {
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].originalName).toBe('test.xlsx');
    });
  });

  describe('POST /api/files/:id/transform', () => {
    let fileId;

    beforeEach(async () => {
      // Upload a test file
      const testFilePath = path.join(__dirname, '../../test.xlsx');
      if (!fs.existsSync(testFilePath)) {
        const XLSX = require('xlsx');
        const data = [
          ['Name', 'Age', 'City', 'Salary'],
          ['John Doe', 30, 'New York', 50000],
          ['Jane Smith', 25, 'Los Angeles', 60000],
          ['Bob Johnson', 35, 'Chicago', 55000]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, testFilePath);
      }

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath);

      fileId = uploadResponse.body.data.file._id;
    });

    it('should transform file by deleting 3rd column', async () => {
      const response = await request(app)
        .post(`/api/files/${fileId}/transform`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          operation: 'deleteColumn',
          columnIndex: 2 // 0-based index, so 2 is the 3rd column (City)
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.transformedData).toBeDefined();

      // Verify the 3rd column (City) is removed
      const transformedData = response.body.data.transformedData;
      expect(transformedData[0]).toEqual(['Name', 'Age', 'Salary']); // Headers without City
      expect(transformedData[1]).toEqual(['John Doe', 30, 50000]); // First row without City
    });
  });

  describe('GET /api/files/:id/visualize', () => {
    let fileId;

    beforeEach(async () => {
      // Upload a test file with numeric data for pie chart
      const testFilePath = path.join(__dirname, '../../test.xlsx');
      if (!fs.existsSync(testFilePath)) {
        const XLSX = require('xlsx');
        const data = [
          ['Category', 'Value'],
          ['A', 30],
          ['B', 25],
          ['C', 35],
          ['D', 10]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, testFilePath);
      }

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath);

      fileId = uploadResponse.body.data.file._id;
    });

    it('should generate pie chart visualization data', async () => {
      const response = await request(app)
        .get(`/api/files/${fileId}/visualize?type=pie&labelColumn=0&valueColumn=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.visualizationData).toBeDefined();
      expect(response.body.data.chartType).toBe('pie');

      // Verify pie chart data structure
      const vizData = response.body.data.visualizationData;
      expect(Array.isArray(vizData)).toBe(true);
      expect(vizData.length).toBe(4); // 4 data points

      // Check first data point
      expect(vizData[0]).toHaveProperty('label');
      expect(vizData[0]).toHaveProperty('value');
      expect(vizData[0]).toHaveProperty('percentage');
    });
  });
});

const XLSX = require('xlsx');
const csv = require('csv-parse');
const fs = require('fs').promises;
const path = require('path');

class FileProcessor {
  static async processFile(filePath, mimeType) {
    try {
      let data;
      let metadata = {
        rowCount: 0,
        columnCount: 0,
        headers: [],
        dataTypes: new Map(),
        summary: new Map()
      };

      switch (mimeType) {
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          data = await this.processExcel(filePath);
          break;
        case 'text/csv':
          data = await this.processCsv(filePath);
          break;
        case 'application/json':
          data = await this.processJson(filePath);
          break;
        default:
          throw new Error('Unsupported file type');
      }

      // Analyze data and generate metadata
      metadata = await this.analyzeData(data);
      
      return {
        data,
        metadata
      };
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  }

  static async processExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  }

  static async processCsv(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return new Promise((resolve, reject) => {
      csv.parse(content, {
        delimiter: ',',
        columns: true,
        skip_empty_lines: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  static async processJson(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  static async analyzeData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid data format');
    }

    const metadata = {
      rowCount: data.length,
      columnCount: 0,
      headers: [],
      dataTypes: new Map(),
      summary: new Map()
    };

    // Get headers (assuming first row contains headers)
    const headers = Array.isArray(data[0]) ? data[0] : Object.keys(data[0]);
    metadata.headers = headers;
    metadata.columnCount = headers.length;

    // Initialize summary for each column
    headers.forEach(header => {
      metadata.summary.set(header, {
        min: null,
        max: null,
        sum: 0,
        mean: 0,
        nullCount: 0,
        uniqueValues: new Set()
      });
    });

    // Analyze each column
    headers.forEach((header, colIndex) => {
      const values = data.slice(1).map(row => 
        Array.isArray(row) ? row[colIndex] : row[header]
      );

      const dataType = this.detectDataType(values);
      metadata.dataTypes.set(header, dataType);

      // Calculate summary statistics
      const summary = metadata.summary.get(header);
      values.forEach(value => {
        if (value === null || value === undefined || value === '') {
          summary.nullCount++;
          return;
        }

        summary.uniqueValues.add(value);

        if (dataType === 'number') {
          const num = Number(value);
          if (!isNaN(num)) {
            if (summary.min === null || num < summary.min) summary.min = num;
            if (summary.max === null || num > summary.max) summary.max = num;
            summary.sum += num;
          }
        }
      });

      if (dataType === 'number') {
        const validValues = values.filter(v => !isNaN(Number(v)));
        summary.mean = summary.sum / validValues.length;
      }

      // Convert Set to array for JSON serialization
      summary.uniqueValues = Array.from(summary.uniqueValues);
    });

    return metadata;
  }

  static detectDataType(values) {
    let numberCount = 0;
    let dateCount = 0;
    let booleanCount = 0;
    const totalValues = values.filter(v => v !== null && v !== undefined && v !== '').length;

    if (totalValues === 0) return 'string';

    values.forEach(value => {
      if (value === null || value === undefined || value === '') return;

      if (!isNaN(value) && typeof value !== 'boolean') {
        numberCount++;
      }
      
      if (!isNaN(Date.parse(value))) {
        dateCount++;
      }

      if (typeof value === 'boolean' || value === 'true' || value === 'false') {
        booleanCount++;
      }
    });

    const numberRatio = numberCount / totalValues;
    const dateRatio = dateCount / totalValues;
    const booleanRatio = booleanCount / totalValues;

    if (booleanRatio > 0.8) return 'boolean';
    if (numberRatio > 0.8) return 'number';
    if (dateRatio > 0.8) return 'date';
    return 'string';
  }

  static async generateTransformation(file, type, parameters) {
    const originalData = await this.processFile(file.path, file.mimeType);
    let transformedData;

    switch (type) {
      case 'filter':
        transformedData = this.applyFilter(originalData.data, parameters);
        break;
      case 'sort':
        transformedData = this.applySort(originalData.data, parameters);
        break;
      case 'aggregate':
        transformedData = this.applyAggregation(originalData.data, parameters);
        break;
      case 'pivot':
        transformedData = this.applyPivot(originalData.data, parameters);
        break;
      default:
        throw new Error('Unsupported transformation type');
    }

    const newFilePath = path.join(
      path.dirname(file.path),
      `${path.basename(file.path, path.extname(file.path))}_${type}${path.extname(file.path)}`
    );

    await this.saveTransformedData(transformedData, newFilePath, file.mimeType);
    return newFilePath;
  }

  static applyFilter(data, { column, operator, value }) {
    const operations = {
      equals: (a, b) => a == b,
      notEquals: (a, b) => a != b,
      greaterThan: (a, b) => a > b,
      lessThan: (a, b) => a < b,
      contains: (a, b) => String(a).includes(String(b)),
      notContains: (a, b) => !String(a).includes(String(b))
    };

    return data.filter(row => {
      const cellValue = row[column];
      return operations[operator](cellValue, value);
    });
  }

  static applySort(data, { column, direction }) {
    return [...data].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }

  static applyAggregation(data, { groupBy, aggregations }) {
    const grouped = new Map();

    data.forEach(row => {
      const key = row[groupBy];
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(row);
    });

    return Array.from(grouped.entries()).map(([key, group]) => {
      const result = { [groupBy]: key };
      
      aggregations.forEach(({ column, function: func }) => {
        const values = group.map(row => Number(row[column])).filter(v => !isNaN(v));
        
        switch (func) {
          case 'sum':
            result[`${column}_sum`] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[`${column}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'count':
            result[`${column}_count`] = values.length;
            break;
          case 'min':
            result[`${column}_min`] = Math.min(...values);
            break;
          case 'max':
            result[`${column}_max`] = Math.max(...values);
            break;
        }
      });

      return result;
    });
  }

  static applyPivot(data, { rows, columns, values, aggregation }) {
    const pivot = new Map();
    const columnValues = new Set();
    const aggregations = {
      sum: vals => vals.reduce((a, b) => a + b, 0),
      avg: vals => vals.reduce((a, b) => a + b, 0) / vals.length,
      count: vals => vals.length,
      min: vals => Math.min(...vals),
      max: vals => Math.max(...vals)
    };

    // Collect unique column values and build pivot structure
    data.forEach(row => {
      const rowKey = rows.map(r => row[r]).join('|');
      const colKey = columns.map(c => row[c]).join('|');
      columnValues.add(colKey);

      if (!pivot.has(rowKey)) {
        pivot.set(rowKey, new Map());
      }
      
      if (!pivot.get(rowKey).has(colKey)) {
        pivot.get(rowKey).set(colKey, []);
      }

      pivot.get(rowKey).get(colKey).push(
        values.map(v => Number(row[v])).filter(v => !isNaN(v))
      );
    });

    // Convert to final format
    const result = [];
    for (const [rowKey, colMap] of pivot.entries()) {
      const resultRow = {
        ...rows.reduce((acc, r, i) => ({
          ...acc,
          [r]: rowKey.split('|')[i]
        }), {})
      };

      for (const colKey of columnValues) {
        const vals = colMap.get(colKey) || [];
        values.forEach((value, i) => {
          resultRow[`${colKey}_${value}`] = vals.length > 0 
            ? aggregations[aggregation](vals.map(v => v[i]))
            : null;
        });
      }

      result.push(resultRow);
    }

    return result;
  }

  static async saveTransformedData(data, filePath, mimeType) {
    switch (mimeType) {
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, filePath);
        break;
      
      case 'text/csv':
        const csvContent = this.convertToCSV(data);
        await fs.writeFile(filePath, csvContent, 'utf-8');
        break;
      
      case 'application/json':
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        break;
      
      default:
        throw new Error('Unsupported output format');
    }
  }

  static convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const cell = row[header];
          if (cell === null || cell === undefined) return '';
          return typeof cell === 'string' && cell.includes(',')
            ? `"${cell}"`
            : cell;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }
}

module.exports = FileProcessor;
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Alert, StyleSheet, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Constants from 'expo-constants';

const API_BASE = __DEV__ ? `http://${Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost'}:5000/api` : 'http://localhost:5000/api'; // Backend server URL

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f3f4f6',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  previewContainer: {
    marginBottom: 16,
  },
  previewTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  table: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
  },
  headerCell: {
    flex: 1,
    padding: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  dataCell: {
    flex: 1,
    padding: 8,
    textAlign: 'center',
    color: '#374151',
  },
  transformationsContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
  },
});

export default function TransformScreen({ route, navigation }) {
  const file = route.params?.file;
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [transformations, setTransformations] = useState({
    deleteColumns: [],
    renameColumns: {},
    filterRows: {},
    reorderColumns: [],
  });

  useEffect(() => {
    if (file) {
      loadFileData();
    }
  }, [file]);

  const loadFileData = async () => {
    if (!file) return;

    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const res = await axios.get(`${API_BASE}/files/${file._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const workbook = XLSX.read(await res.data.arrayBuffer(), { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      setHeaders(jsonData[0]);
      setData(jsonData.slice(1));
    } catch (error) {
      Alert.alert('Error', 'Failed to load file data');
    }
  };

  const applyTransformations = () => {
    let transformedData = [...data];
    let transformedHeaders = [...headers];

    // Delete columns
    if (transformations.deleteColumns.length > 0) {
      transformedHeaders = transformedHeaders.filter((_, index) => !transformations.deleteColumns.includes(index));
      transformedData = transformedData.map(row => row.filter((_, index) => !transformations.deleteColumns.includes(index)));
    }

    // Rename columns
    Object.keys(transformations.renameColumns).forEach(oldName => {
      const index = transformedHeaders.indexOf(oldName);
      if (index !== -1) {
        transformedHeaders[index] = transformations.renameColumns[oldName];
      }
    });

    // Filter rows
    if (transformations.filterRows.column && transformations.filterRows.value) {
      const colIndex = transformedHeaders.indexOf(transformations.filterRows.column);
      if (colIndex !== -1) {
        transformedData = transformedData.filter(row => row[colIndex] == transformations.filterRows.value);
      }
    }

    // Reorder columns
    if (transformations.reorderColumns.length > 0) {
      const newOrder = transformations.reorderColumns.map(col => transformedHeaders.indexOf(col));
      transformedHeaders = newOrder.map(index => transformedHeaders[index]);
      transformedData = transformedData.map(row => newOrder.map(index => row[index]));
    }

    return [transformedHeaders, ...transformedData];
  };

  const handleTransform = async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const transformedData = applyTransformations();

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: `transformed-${file.originalName}`,
        type: file.mimeType,
      });
      formData.append('transformations', JSON.stringify(transformations));

      const res = await axios.post(`${API_BASE}/transform`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'File transformed and uploaded');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Transformation failed');
    }
  };

  const renderRow = ({ item, index }) => (
    <View style={styles.dataRow}>
      {item.map((cell, cellIndex) => (
        <Text key={cellIndex} style={styles.dataCell}>{cell}</Text>
      ))}
    </View>
  );

  if (!file) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Transform Data</Text>
        <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 20 }}>
          No file selected for transformation.
        </Text>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Transform Data</Text>

      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Preview:</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            {headers.map((header, index) => (
              <Text key={index} style={styles.headerCell}>{header}</Text>
            ))}
          </View>
          <FlatList
            data={data.slice(0, 10)}
            renderItem={renderRow}
            keyExtractor={(item, index) => index.toString()}
            style={{ maxHeight: 200 }}
          />
        </View>
      </View>

      <View style={styles.transformationsContainer}>
        <Text style={styles.sectionTitle}>Transformations:</Text>
        {/* Add UI for transformations here, e.g., buttons to delete columns, rename, etc. */}
        <TextInput
          style={styles.input}
          placeholder="Column to delete (index)"
          onChangeText={(text) => setTransformations({ ...transformations, deleteColumns: text.split(',').map(Number) })}
        />
        {/* Add more inputs for rename, filter, reorder */}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleTransform}>
        <Text style={styles.buttonText}>Apply Transformations & Upload</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

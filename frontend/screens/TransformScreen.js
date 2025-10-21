import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'http://localhost:5000/api';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  fileItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  fileName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1f2937',
  },
  fileSize: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  transformOptions: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1f2937',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxText: {
    marginLeft: 8,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    fontSize: 16,
  },
  transformButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  transformButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyState: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyStateText: {
    color: '#6b7280',
    fontSize: 16,
  },
});

export default function TransformScreen({ navigation }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformOptions, setTransformOptions] = useState({
    removeDuplicates: false,
    removeEmptyRows: false,
    trimWhitespace: false,
    filterColumn: '',
    filterValue: '',
  });

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE}/files`);
      setFiles(response.data.data.files);
    } catch (error) {
      console.error('Fetch files error:', error);
      Alert.alert('Error', 'Failed to fetch files');
    } finally {
      setIsLoading(false);
    }
  };

  const applyTransform = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file first');
      return;
    }

    setIsTransforming(true);
    try {
      const transformData = {
        removeDuplicates: transformOptions.removeDuplicates,
        removeEmptyRows: transformOptions.removeEmptyRows,
        trimWhitespace: transformOptions.trimWhitespace,
        filterColumn: transformOptions.filterColumn || undefined,
        filterValue: transformOptions.filterValue || undefined,
      };

      const response = await axios.post(`${API_BASE}/files/${selectedFile._id}/transform`, transformData);

      Alert.alert('Success', 'File transformed successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Transform error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to transform file');
    } finally {
      setIsTransforming(false);
    }
  };

  const toggleOption = (option) => {
    setTransformOptions(prev => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#3b82f6" />
        <Text style={{ marginLeft: 8, fontSize: 16, color: '#3b82f6' }}>Back to Home</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Transform File</Text>

      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#1f2937' }}>
        Select a file to transform:
      </Text>

      {files.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No files uploaded yet</Text>
        </View>
      ) : (
        files.map(item => (
          <TouchableOpacity
            key={item._id}
            style={[
              styles.fileItem,
              selectedFile?._id === item._id && { backgroundColor: '#dbeafe' }
            ]}
            onPress={() => setSelectedFile(item)}
          >
            <Text style={styles.fileName}>{item.originalName}</Text>
            <Text style={styles.fileSize}>
              Size: {(item.size / 1024).toFixed(2)} KB
            </Text>
          </TouchableOpacity>
        ))
      )}

      {selectedFile && (
        <View style={styles.transformOptions}>
          <Text style={styles.optionTitle}>Transformation Options:</Text>

          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleOption('removeDuplicates')}
          >
            <Text style={{ fontSize: 20 }}>{transformOptions.removeDuplicates ? '☑' : '☐'}</Text>
            <Text style={styles.checkboxText}>Remove duplicate rows</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleOption('removeEmptyRows')}
          >
            <Text style={{ fontSize: 20 }}>{transformOptions.removeEmptyRows ? '☑' : '☐'}</Text>
            <Text style={styles.checkboxText}>Remove empty rows</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleOption('trimWhitespace')}
          >
            <Text style={{ fontSize: 20 }}>{transformOptions.trimWhitespace ? '☑' : '☐'}</Text>
            <Text style={styles.checkboxText}>Trim whitespace</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 16, marginTop: 12, marginBottom: 4 }}>Filter by column:</Text>
          <TextInput
            style={styles.input}
            placeholder="Column name (optional)"
            value={transformOptions.filterColumn}
            onChangeText={(text) => setTransformOptions(prev => ({ ...prev, filterColumn: text }))}
          />

          <Text style={{ fontSize: 16, marginTop: 8, marginBottom: 4 }}>Filter value:</Text>
          <TextInput
            style={styles.input}
            placeholder="Value to filter by (optional)"
            value={transformOptions.filterValue}
            onChangeText={(text) => setTransformOptions(prev => ({ ...prev, filterValue: text }))}
          />

          <TouchableOpacity
            style={styles.transformButton}
            onPress={applyTransform}
            disabled={isTransforming}
          >
            {isTransforming ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.transformButtonText}>Apply Transform</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Navigation Buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, marginBottom: 16 }}>
        <TouchableOpacity
          style={{ flex: 1, height: 60, marginHorizontal: 4, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => navigation.navigate('Upload')}
        >
          <Text style={styles.buttonText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, height: 60, marginHorizontal: 4, backgroundColor: '#8b5cf6', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => navigation.navigate('Visualization')}
        >
          <Text style={styles.buttonText}>Visualize</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

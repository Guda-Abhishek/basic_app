import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
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
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fileInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
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
  uploadButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default function UploadScreen({ navigation }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        setSelectedFile(result);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file first');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // For web, use the file directly
        formData.append('file', selectedFile.file);
      } else {
        // For native, create blob or use uri
        const fileUri = selectedFile.uri;
        const fileName = selectedFile.name;
        const fileType = selectedFile.mimeType || 'application/octet-stream';

        formData.append('file', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        });
      }

      const token = await SecureStore.getItemAsync('token');
      const response = await axios.post(`${API_BASE}/files`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      Alert.alert('Success', 'File uploaded successfully!');
      setSelectedFile(null);
      navigation.goBack();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#3b82f6" />
        <Text style={{ marginLeft: 8, fontSize: 16, color: '#3b82f6' }}>Back to Home</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Upload File</Text>

      <TouchableOpacity style={styles.button} onPress={pickDocument}>
        <Text style={styles.buttonText}>Select CSV or Excel File</Text>
      </TouchableOpacity>

      {selectedFile && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{selectedFile.name}</Text>
          <Text style={styles.fileSize}>
            Size: {(selectedFile.size / 1024).toFixed(2)} KB
          </Text>
        </View>
      )}

      {selectedFile && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={uploadFile}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>Upload File</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Navigation Buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 }}>
        <TouchableOpacity
          style={[styles.button, { flex: 1, marginHorizontal: 4, backgroundColor: '#10b981' }]}
          onPress={() => navigation.navigate('Transform')}
        >
          <Text style={styles.buttonText}>Transform</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { flex: 1, marginHorizontal: 4, backgroundColor: '#8b5cf6' }]}
          onPress={() => navigation.navigate('Visualization')}
        >
          <Text style={styles.buttonText}>Visualize</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

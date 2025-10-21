import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

const API_BASE = __DEV__ ? `http://${Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost'}:5000/api` : 'http://localhost:5000/api'; // Backend server URL

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f3f4f6',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#1f2937',
  },
  supportedFormats: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  uploadButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
});

export default function UploadScreen({ navigation }) {
  const [uploading, setUploading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
               'application/vnd.ms-excel',
               'text/csv',
               'application/json',
               'application/sql',
               'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        uploadFile(result);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      // Verify file size (e.g., 10MB limit)
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      const fileSizeInMB = fileInfo.size / 1024 / 1024;
      
      if (fileSizeInMB > 10) {
        Alert.alert('Error', 'File size cannot exceed 10MB');
        return;
      }

      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        Alert.alert('Error', 'Please login to upload files');
        navigation.navigate('Login');
        return;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      });

      const res = await axios.post(
        `${API_BASE}/files/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            // You can add a progress state and UI if needed
            console.log(`Upload Progress: ${progress}%`);
          },
        }
      );

      // Directly navigate to Transform screen after successful upload
      navigation.navigate('Transform', { file: res.data.file });
    } catch (error) {
      let errorMessage = 'Upload failed';
      
      if (error.response?.status === 401) {
        errorMessage = 'Please login again to continue';
        // Clear tokens and redirect to login
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        navigation.navigate('Login');
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === 'Network Error') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.title}>Upload File</Text>
        <Text style={styles.supportedFormats}>Supported formats: .xlsx, .xls, .csv, .json, .sql, .txt</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickDocument}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>Pick and Upload File</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

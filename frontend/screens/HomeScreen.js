import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';

// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 403 || error.response?.status === 401) {
      // Try to refresh token
      try {
        let refreshToken;

        if (Platform.OS === 'web') {
          refreshToken = await AsyncStorage.getItem('refreshToken');
        } else {
          refreshToken = await SecureStore.getItemAsync('refreshToken');
          if (!refreshToken) {
            refreshToken = await AsyncStorage.getItem('refreshToken');
          }
        }

        if (refreshToken) {
          const API_BASE = __DEV__ ? `http://${Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost'}:5000/api` : 'http://localhost:5000/api';
          const refreshResponse = await axios.post(`${API_BASE}/auth/refresh-token`, {
            refreshToken
          });

          const { token: newToken, refreshToken: newRefreshToken } = refreshResponse.data.data;

          // Store new tokens
          if (Platform.OS === 'web') {
            await AsyncStorage.setItem('accessToken', newToken);
            await AsyncStorage.setItem('refreshToken', newRefreshToken);
          } else {
            await SecureStore.setItemAsync('accessToken', newToken);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);
          }

          // Update axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

          // Retry the original request
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // If refresh fails, clear tokens and redirect to login
        await clearStoredTokens();
        // Don't redirect here as it might cause navigation issues
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to clear stored tokens
const clearStoredTokens = async () => {
  try {
    if (Platform.OS === 'web') {
      // For web, only clear AsyncStorage
      await Promise.all([
        AsyncStorage.removeItem('accessToken'),
        AsyncStorage.removeItem('refreshToken'),
        AsyncStorage.removeItem('userId'),
        AsyncStorage.removeItem('userEmail'),
        AsyncStorage.removeItem('userFullName'),
        AsyncStorage.removeItem('userPhoneNumber'),
        AsyncStorage.removeItem('rememberMe')
      ]);
    } else {
      // For native platforms, clear both SecureStore and AsyncStorage
      const clearSecureStore = [
        SecureStore.deleteItemAsync('accessToken'),
        SecureStore.deleteItemAsync('refreshToken'),
        SecureStore.deleteItemAsync('userId'),
        SecureStore.deleteItemAsync('userEmail'),
        SecureStore.deleteItemAsync('userFullName'),
        SecureStore.deleteItemAsync('userPhoneNumber')
      ];

      const clearAsyncStorage = [
        AsyncStorage.removeItem('accessToken'),
        AsyncStorage.removeItem('refreshToken'),
        AsyncStorage.removeItem('userId'),
        AsyncStorage.removeItem('userEmail'),
        AsyncStorage.removeItem('userFullName'),
        AsyncStorage.removeItem('userPhoneNumber'),
        AsyncStorage.removeItem('rememberMe')
      ];

      await Promise.all([...clearSecureStore, ...clearAsyncStorage]);
    }
    delete axios.defaults.headers.common['Authorization'];
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
};

const API_BASE = 'http://localhost:5000/api'; // Backend server URL

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loader: {
    marginVertical: 20,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  contentContainer: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  profileSection: {
    marginBottom: 16,
  },
  profileText: {
    fontSize: 16,
    color: '#374151',
  },
  guestWarning: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  guestWarningText: {
    color: '#dc2626',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  uploadButton: {
    backgroundColor: '#3b82f6',
  },
  transformButton: {
    backgroundColor: '#10b981',
  },
  visualizeButton: {
    backgroundColor: '#8b5cf6',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  filesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  fileItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
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
  visualizeButton: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  visualizeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyState: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    color: '#6b7280',
    fontSize: 16,
  },
  fileDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchUserAndFiles();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFiles();
    } catch (error) {
      console.error('Refresh error:', error);
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchUserAndFiles = async () => {
    try {
      setError(null);
      // Fetch user profile
      const userRes = await axios.get(`${API_BASE}/auth/me`);
      setUser(userRes.data.data.user);

      // Fetch files
      const filesRes = await axios.get(`${API_BASE}/files`);
      setFiles(filesRes.data.data.files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Data fetch error:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Token expired or invalid, redirect to login
        await clearStoredTokens();
        navigation.replace('Login');
        return;
      }
      setError('Failed to fetch your data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      // Use the token already set in axios defaults
      const res = await axios.get(`${API_BASE}/files`);
      setFiles(res.data.data.files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('File fetch error:', error);
      setError('Failed to fetch your files. Please try again.');
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await clearStoredTokens();
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleFilePress = (file) => {
    Alert.alert(
      file.originalName,
      `Created: ${new Date(file.createdAt).toLocaleDateString()}\nSize: ${(file.size / 1024).toFixed(2)} KB`,
      [
        {
          text: 'Visualize',
          onPress: () => navigation.navigate('Visualization', { file }),
        },
        {
          text: 'Transform',
          onPress: () => navigation.navigate('Transform', { file }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Home</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
        ) : (
          <>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            {isGuest ? (
              <View style={styles.guestWarning}>
                <Text style={styles.guestWarningText}>⚠️ Your data won't be stored unless you log in.</Text>
              </View>
            ) : (
              <View style={styles.profileSection}>
                <Text style={styles.profileText}>Welcome, {user?.fullName || user?.email}!</Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.uploadButton]}
                onPress={() => navigation.navigate('Upload')}
              >
                <Text style={styles.buttonText}>Upload</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.transformButton]}
                onPress={() => navigation.navigate('Transform')}
              >
                <Text style={styles.buttonText}>Transform</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.visualizeButton]}
                onPress={() => navigation.navigate('Visualization')}
              >
                <Text style={styles.buttonText}>Visualize</Text>
              </TouchableOpacity>
            </View>

            {!isGuest && (
              <>
                <Text style={styles.filesTitle}>
                  Your Files {files.length > 0 && `(${files.length})`}
                </Text>
                {files.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No files uploaded yet</Text>
                  </View>
                ) : (
                  files.map(item => (
                    <TouchableOpacity
                      key={item._id}
                      style={styles.fileItem}
                      onPress={() => handleFilePress(item)}
                    >
                      <Text style={styles.fileName}>{item.originalName}</Text>
                      <Text style={styles.fileSize}>
                        Size: {(item.size / 1024).toFixed(2)} KB
                      </Text>
                      <Text style={styles.fileDate}>
                        Uploaded: {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity 
                  style={styles.logoutButton} 
                  onPress={handleLogout}
                >
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
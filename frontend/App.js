import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import TransformScreen from './screens/TransformScreen';
import VisualizeScreen from './screens/VisualizeScreen';

const Stack = createStackNavigator();

const API_BASE = __DEV__ ? `http://localhost:5000/api` : 'http://localhost:5000/api';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      let accessToken, refreshToken;

      // Check for stored tokens
      if (Platform.OS === 'web') {
        accessToken = await AsyncStorage.getItem('accessToken');
        refreshToken = await AsyncStorage.getItem('refreshToken');
      } else {
        accessToken = await SecureStore.getItemAsync('accessToken');
        refreshToken = await SecureStore.getItemAsync('refreshToken');

        // Fallback to AsyncStorage if not found in SecureStore
        if (!accessToken) {
          accessToken = await AsyncStorage.getItem('accessToken');
          refreshToken = await AsyncStorage.getItem('refreshToken');
        }
      }

      if (accessToken) {
        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        // Try to validate token by making a test request
        try {
          await axios.get(`${API_BASE}/auth/me`);
          setIsAuthenticated(true);
        } catch (error) {
          // If token is invalid, try to refresh
          if (refreshToken && error.response?.status === 401) {
            try {
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

              // Update axios header
              axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
              setIsAuthenticated(true);
            } catch (refreshError) {
              // Refresh failed, clear tokens
              await clearStoredTokens();
              setIsAuthenticated(false);
            }
          } else {
            // Other error, clear tokens
            await clearStoredTokens();
            setIsAuthenticated(false);
          }
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Authentication check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const clearStoredTokens = async () => {
    try {
      if (Platform.OS === 'web') {
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0f2fe' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? "Home" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Upload" component={UploadScreen} />
        <Stack.Screen name="Transform" component={TransformScreen} />
        <Stack.Screen name="Visualization" component={VisualizeScreen} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

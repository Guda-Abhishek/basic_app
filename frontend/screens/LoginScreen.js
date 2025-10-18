// frontend/screens/loginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert, ScrollView, Switch } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://localhost:5000/api'; // Backend server URL

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    width: '90%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#f9fafb',
    color: '#111827',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 6,
    marginBottom: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  link: {
    padding: 6,
  },
  linkText: {
    textAlign: 'center',
    color: '#2563eb',
    fontWeight: '500',
    fontSize: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  rememberMeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4b5563',
  },
});

export default function LoginScreen({ navigation, route }) {
  const [emailOrPhone, setEmailOrPhone] = useState(route.params?.emailOrPhone || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(false);

  const validateInputs = () => {
    const newErrors = {};
    if (!emailOrPhone.trim()) {
      newErrors.emailOrPhone = 'Email or phone number is required';
    }
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        emailOrPhone,
        password,
      });

      const { userId, email, fullName, phoneNumber, accessToken, refreshToken } = res.data;

      // Store user data and tokens based on remember me preference
      if (rememberMe) {
        // Store in AsyncStorage for persistent storage
        await Promise.all([
          AsyncStorage.setItem('userId', userId),
          AsyncStorage.setItem('userEmail', email),
          AsyncStorage.setItem('userFullName', fullName),
          AsyncStorage.setItem('userPhoneNumber', phoneNumber),
          AsyncStorage.setItem('accessToken', accessToken),
          AsyncStorage.setItem('refreshToken', refreshToken),
          AsyncStorage.setItem('rememberMe', 'true')
        ]);
      } else {
        // Store in SecureStore for session-only storage
        await Promise.all([
          SecureStore.setItemAsync('userId', userId),
          SecureStore.setItemAsync('userEmail', email),
          SecureStore.setItemAsync('userFullName', fullName),
          SecureStore.setItemAsync('userPhoneNumber', phoneNumber),
          SecureStore.setItemAsync('accessToken', accessToken),
          SecureStore.setItemAsync('refreshToken', refreshToken)
        ]);
      }

      // Configure axios default headers for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      navigation.replace('Home');
    } catch (error) {
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === 'Network Error') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Could not connect to server. Please check if the server is running.';
      }

      Alert.alert('Login Failed', errorMessage);
      console.error('Login error:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.formContainer}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome Back</Text>
        </View>

        {/* Email/Phone Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email or Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email or phone number"
            placeholderTextColor="#9CA3AF"
            value={emailOrPhone}
            onChangeText={(text) => {
              setEmailOrPhone(text);
              setErrors({ ...errors, emailOrPhone: '' });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.emailOrPhone ? <Text style={styles.errorText}>{errors.emailOrPhone}</Text> : null}
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors({ ...errors, password: '' });
            }}
            secureTextEntry
          />
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
        </View>

        {/* Remember Me Toggle */}
        <View style={styles.rememberMeContainer}>
          <Switch
            value={rememberMe}
            onValueChange={setRememberMe}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={rememberMe ? '#3b82f6' : '#f4f4f5'}
          />
          <Text style={styles.rememberMeText}>Remember me</Text>
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : null}
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        {/* Register Link */}
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>Don't have an account? Create one</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
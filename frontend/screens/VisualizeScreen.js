import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import axios from 'axios';
import { VictoryBar, VictoryChart, VictoryTheme, VictoryPie, VictoryLine } from 'victory-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'http://localhost:5000/api';
const { width } = Dimensions.get('window');

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
  chartContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  chartTypeButton: {
    backgroundColor: '#e5e7eb',
    padding: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  chartTypeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  chartTypeButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  chartTypeButtonTextActive: {
    color: 'white',
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
});

export default function VisualizeScreen({ navigation }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [chartType, setChartType] = useState('bar');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

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

  const fetchFileData = async (file) => {
    setIsLoadingData(true);
    try {
      const response = await axios.get(`${API_BASE}/files/${file._id}/visualize`);
      setFileData(response.data.chartData);
      setSelectedFile(file);
    } catch (error) {
      console.error('Fetch data error:', error);
      Alert.alert('Error', 'Failed to fetch file data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const renderChart = () => {
    if (fileData.length === 0) return null;

    const chartProps = {
      width: width - 64,
      height: 300,
      theme: VictoryTheme.material,
    };

    switch (chartType) {
      case 'bar':
        return (
          <VictoryChart {...chartProps}>
            <VictoryBar
              data={fileData.slice(0, 10)} // Limit to first 10 data points
              x="label"
              y="value"
            />
          </VictoryChart>
        );
      case 'pie':
        return (
          <VictoryPie
            {...chartProps}
            data={fileData.slice(0, 8)} // Limit to first 8 data points
            x="label"
            y="value"
            colorScale="qualitative"
          />
        );
      case 'line':
        return (
          <VictoryChart {...chartProps}>
            <VictoryLine
              data={fileData.slice(0, 20)} // Limit to first 20 data points
              x="label"
              y="value"
            />
          </VictoryChart>
        );
      default:
        return null;
    }
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

      <Text style={styles.title}>Visualize Data</Text>

      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#1f2937' }}>
        Select a file to visualize:
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
            onPress={() => fetchFileData(item)}
          >
            <Text style={styles.fileName}>{item.originalName}</Text>
            <Text style={styles.fileSize}>
              Size: {(item.size / 1024).toFixed(2)} KB
            </Text>
          </TouchableOpacity>
        ))
      )}

      {isLoadingData && (
        <View style={styles.chartContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {selectedFile && fileData.length > 0 && !isLoadingData && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Data Visualization - {selectedFile.originalName}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['bar', 'pie', 'line'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chartTypeButton,
                  chartType === type && styles.chartTypeButtonActive
                ]}
                onPress={() => setChartType(type)}
              >
                <Text
                  style={[
                    styles.chartTypeButtonText,
                    chartType === type && styles.chartTypeButtonTextActive
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} Chart
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderChart()}
        </View>
      )}

      {/* Navigation Buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, marginBottom: 16 }}>
        <TouchableOpacity
          style={[styles.button, { flex: 1, marginHorizontal: 4, backgroundColor: '#3b82f6' }]}
          onPress={() => navigation.navigate('Upload')}
        >
          <Text style={styles.buttonText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { flex: 1, marginHorizontal: 4, backgroundColor: '#10b981' }]}
          onPress={() => navigation.navigate('Transform')}
        >
          <Text style={styles.buttonText}>Transform</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

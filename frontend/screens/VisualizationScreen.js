import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

// Use web-specific components if needed
const WebPicker = Platform.select({
  web: props => (
    <select
      value={props.selectedValue}
      onChange={e => props.onValueChange(e.target.value)}
      style={{
        ...props.style,
        width: '100%',
        height: 40,
        border: '1px solid #d1d5db',
        borderRadius: 4,
        backgroundColor: 'white',
        padding: '8px',
      }}
    >
      {props.children.map(child => (
        <option key={child.props.value} value={child.props.value}>
          {child.props.label}
        </option>
      ))}
    </select>
  ),
  default: Picker,
});
import { VictoryBar, VictoryChart, VictoryLine, VictoryPie, VictoryScatter, VictoryArea as VictoryHistogram, VictoryTheme } from 'victory';
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
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    backgroundColor: 'white',
  },
  chartContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    height: 300,
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#6b7280',
  },
});

export default function VisualizationScreen({ route, navigation }) {
  const file = route.params?.file;
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [chartType, setChartType] = useState('bar');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [aggregation, setAggregation] = useState('sum');

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
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      setData(jsonData);
      if (jsonData.length > 0) {
        setHeaders(Object.keys(jsonData[0]));
      }
    } catch (error) {
      console.error('Failed to load file data:', error);
    }
  };

  const processData = () => {
    if (!xAxis || !yAxis) return [];

    let processed = data.map(item => ({
      x: item[xAxis],
      y: parseFloat(item[yAxis]) || 0,
    }));

    if (groupBy) {
      const grouped = {};
      processed.forEach(item => {
        const key = item.x;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item.y);
      });

      processed = Object.keys(grouped).map(key => {
        const values = grouped[key];
        let yValue;
        switch (aggregation) {
          case 'sum':
            yValue = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            yValue = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'count':
            yValue = values.length;
            break;
          default:
            yValue = values[0];
        }
        return { x: key, y: yValue };
      });
    }

    return processed;
  };

  const renderChart = () => {
    const chartData = processData();

    switch (chartType) {
      case 'bar':
        return (
          <VictoryBar
            data={chartData}
            style={{ data: { fill: '#3b82f6' } }}
          />
        );
      case 'line':
        return (
          <VictoryLine
            data={chartData}
            style={{ data: { stroke: '#3b82f6' } }}
          />
        );
      case 'pie':
        return (
          <VictoryPie
            data={chartData}
            colorScale="qualitative"
          />
        );
      case 'scatter':
        return (
          <VictoryScatter
            data={chartData}
            style={{ data: { fill: '#3b82f6' } }}
          />
        );
      case 'histogram':
        return (
          <VictoryHistogram
            data={chartData.map(d => ({ x: d.y }))}
            style={{ data: { fill: '#3b82f6' } }}
          />
        );
      default:
        return null;
    }
  };

  if (!file) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Data Visualization</Text>
        <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 20 }}>
          No file selected for visualization.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Data Visualization</Text>

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Chart Type:</Text>
        <WebPicker
          selectedValue={chartType}
          onValueChange={setChartType}
          style={styles.picker}
        >
          <Picker.Item label="Bar" value="bar" />
          <Picker.Item label="Line" value="line" />
          <Picker.Item label="Pie" value="pie" />
          <Picker.Item label="Scatter" value="scatter" />
          <Picker.Item label="Histogram" value="histogram" />
        </WebPicker>
      </View>

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>X Axis:</Text>
        <WebPicker
          selectedValue={xAxis}
          onValueChange={setXAxis}
          style={styles.picker}
        >
          <Picker.Item label="Select column" value="" />
          {headers.map(header => (
            <Picker.Item key={header} label={header} value={header} />
          ))}
        </WebPicker>
      </View>

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Y Axis:</Text>
        <WebPicker
          selectedValue={yAxis}
          onValueChange={setYAxis}
          style={styles.picker}
        >
          <Picker.Item label="Select column" value="" />
          {headers.map(header => (
            <Picker.Item key={header} label={header} value={header} />
          ))}
        </WebPicker>
      </View>

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Group By (optional):</Text>
        <WebPicker
          selectedValue={groupBy}
          onValueChange={setGroupBy}
          style={styles.picker}
        >
          <Picker.Item label="None" value="" />
          {headers.map(header => (
            <Picker.Item key={header} label={header} value={header} />
          ))}
        </WebPicker>
      </View>

      {groupBy && (
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Aggregation:</Text>
          <WebPicker
            selectedValue={aggregation}
            onValueChange={setAggregation}
            style={styles.picker}
          >
            <Picker.Item label="Sum" value="sum" />
            <Picker.Item label="Average" value="avg" />
            <Picker.Item label="Count" value="count" />
          </WebPicker>
        </View>
      )}

      <View style={styles.chartContainer}>
        <VictoryChart theme={VictoryTheme.material}>
          {renderChart()}
        </VictoryChart>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as SMS from 'expo-sms';
import axios from 'axios';

interface PendingSMS {
  id: string;
  phone: string;
  message: string;
  status: string;
}

export default function App() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [pendingSMS, setPendingSMS] = useState<PendingSMS[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');

  const API_URL = 'http://192.168.16.164:3000';

  useEffect(() => {
    setupNetworkListener();
    fetchPendingSMS();

    const interval = setInterval(() => {
      if (isConnected) {
        fetchPendingSMS();
        processPendingSMS();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isConnected]);

  const setupNetworkListener = () => {
    NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
  };

  const fetchPendingSMS = async () => {
    try {
      const response = await axios.get(`${API_URL}/sms?status=PENDING`);
      setPendingSMS(response.data);
    } catch (error) {
      setStatus('Error fetching pending SMS');
      console.error(error);
    }
  };

  const confirmSMSSent = async (sms: PendingSMS) => {
    try {
      sms.status = 'SENDED';
      await axios.put(`${API_URL}/sms/` + sms.id, { sms });
    } catch (error) {
      console.error('Error confirming SMS:', error);
    }
  };

  const sendSMS = async (sms: PendingSMS) => {
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        setStatus('SMS is not available on this device. Please ensure SMS functionality is enabled.');
        return;
      }

      setStatus('Attempting to send SMS...');
      const { result } = await SMS.sendSMSAsync([sms.phone], sms.message);
      
      if (result === 'sent') {
        setStatus('SMS sent successfully!');
        await confirmSMSSent(sms);
        setPendingSMS(current => current.filter(item => item.id !== sms.id));
      } else if (result === 'cancelled') {
        setStatus('SMS sending was cancelled by the user');
      } else {
        setStatus(`SMS sending resulted in unexpected status: ${result}`);
      }
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      setStatus(`Error sending SMS: ${errorMessage}. Please ensure the app has SMS permissions.`);
    }
  };

  const processPendingSMS = async () => {
    for (const sms of pendingSMS) {
      await sendSMS(sms);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingSMS();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>SMS Manager</Text>
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.count}>
          Pending SMS: {pendingSMS.length}
        </Text>
        {pendingSMS.map(sms => (
          <View key={sms.id} style={styles.smsItem}>
            <Text>To: {sms.phone}</Text>
            <Text>Message: {sms.message}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50
  },
  scrollView: {
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  status: {
    color: 'red',
    marginBottom: 10
  },
  count: {
    fontSize: 18,
    marginBottom: 20
  },
  smsItem: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10
  }
});
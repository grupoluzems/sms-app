import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, Button, NativeModules } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { TextInput } from 'react-native';

interface ISMS {
  id: number;
  phone: string;
  message: string;
  status: string;
  error: string;
}

export default function App() {
  const [pendingSMS, setPendingSMS] = useState<ISMS[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [token, setToken] = useState<string>('');
  
  const { DirectSmsModule } = NativeModules;

  useEffect(() => {
    // Se o fetching estiver ativado, configure o intervalo
    let interval: NodeJS.Timeout | null = null;
  
    if (isFetching || (!pendingSMS && pendingSMS.length == 0)) {
      interval = setInterval(async () => {
        const data = await fetchPendingSMS();
        await processPendingSMS(data);
      }, 5000);
    } else {
      // Se o fetching estiver desativado, limpe o intervalo
      if (interval) {
        clearInterval(interval);
      }
    }
  
    // Limpeza do intervalo quando o componente desmontar ou quando `isFetching` mudar
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isFetching, pendingSMS]);

  const fetchPendingSMS = async () => {
    try {

      setStatus("");

      if (!isFetching) {
        setStatus("Busca pausada");
        return [];
      }

      if (!baseUrl || !token) {
        setStatus("Base URL ou Token inválidos");
        return [];
      }

      setStatus("Buscando dados");
      const response = await axios.get(baseUrl, { headers: { Authorization: token } });
      setPendingSMS(response.data);
      return response.data;
    } catch (error) {
      setStatus('Erro ao buscar SMSs ' + error);
    }
  };

  const toggleFetching = () => {
    setIsFetching(!isFetching);
    setStatus("");
  };

  const confirmSMSSent = async (sms: ISMS) => {
    try {
      sms.status = 'SENT';
      await axios.put(`${baseUrl}/${sms.id}`, sms, { headers: { Authorization: token } });
    } catch (error) {
      setStatus('Erro na confirmação do SMS')
    }
  };

  const errorSMSSent = async (sms: ISMS, err: string) => {
    try {
      sms.status = 'ERROR';
      sms.error = err;
      await axios.put(`${baseUrl}/${sms.id}`, sms, { headers: { Authorization: token } });
    } catch (error) {
      setStatus('Erro na confirmação do SMS')
    }
  };

  const sendSMS = async (sms: ISMS) => {
    try {
      setStatus(`Enviando SMS para ${sms.phone}`);
      
      if (!DirectSmsModule) {
        await errorSMSSent(sms, 'Módulo SMS não disponível');
        return;
      }

      const result = await DirectSmsModule.sendSms(sms.phone, sms.message);
      
      if (result === 'sent') {
        setStatus(`SMS enviado com sucesso para ${sms.phone}!`);
        await confirmSMSSent(sms);
        setPendingSMS(current => current.filter(item => item.status == 'PENDING'));
        return;
      } 
      
      if (result === 'permission_granted') {
        
        const secondAttempt = await DirectSmsModule.sendSms(sms.phone, sms.message);
        
        if (secondAttempt === 'sent') {
          setStatus(`SMS enviado para ${sms.phone} depois da permissão habilitada!`);
          await confirmSMSSent(sms);
          setPendingSMS(current => current.filter(item => item.id !== sms.id));
          return;
        } 
        
        await errorSMSSent(sms, `Falha ao enviar SSM após permissão habilitada: ${secondAttempt}`);
        
      } else {
        await errorSMSSent(sms, `Erro: ${result}`);
      }

    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      await errorSMSSent(sms, errorMessage);
      setStatus(`Falha no envio do SMS para ${sms.phone}: ${errorMessage}`);
    }
  };

  const processPendingSMS = async (data: ISMS[]) => {
    for (const sms of data) {
      await sendSMS(sms);
      await sleep(1000);
    }
  };

  const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollView}
      >
        <Text style={styles.title}>Disparador de SMS's</Text>

        <TextInput
          style={styles.input}
          placeholder="Base URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          multiline={true}
          editable={!isFetching}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Token"
          value={token}
          onChangeText={setToken}
          multiline={true}
          editable={!isFetching}
        />
        
        <Text>
        { isFetching }
        </Text>

        <Button
          onPress={toggleFetching}
          title={isFetching ? "Pausar" : "Iniciar"}
          color={isFetching ? 'red' : 'green'} 
          disabled={!baseUrl || !token}
        />

        <Text style={styles.status}>{status}</Text>

        <Text style={styles.count}>
          SMS's pendentes: {pendingSMS.length}
        </Text>

        {pendingSMS.map(sms => (
          <View key={sms.id} style={styles.smsItem}>
            <Text style={{ marginBottom: 5 }}>Telefone: {sms.phone}</Text>
            <Text style={{ marginBottom: 5 }}>Mensagem: {sms.message}</Text>
            <Button
              onPress={() => sendSMS(sms)}
              title="Enviar"
              color="gray"
            />
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
  input: {
    borderBottomWidth: 1,
    borderColor: '#CCC',
    marginBottom: 8,
    flex: 1,
    flexWrap: 'wrap'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  status: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'right'
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
})
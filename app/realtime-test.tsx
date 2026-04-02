import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { ref, set, onValue, push } from 'firebase/database';
import { rtdb } from './../firebase';

export default function RealtimeTestScreen() {
  const [name, setName] = useState('');
  const [users, setUsers] = useState<any>({});

  const handleWriteOneUser = async () => {
    await set(ref(rtdb, 'users/u1'), {
      username: name || 'An',
      email: 'an@gmail.com',
    });
  };

  const handleAddRandomUser = async () => {
    const usersRef = ref(rtdb, 'users');
    const newUserRef = push(usersRef);

    await set(newUserRef, {
      username: name || 'User mới',
      email: `test${Date.now()}@gmail.com`,
    });
  };

  useEffect(() => {
    const usersRef = ref(rtdb, 'users');

    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      setUsers(data || {});
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, padding: 20, marginTop: 50 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>
        Test Realtime Database
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nhập tên"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 12,
          marginBottom: 12,
          borderRadius: 8,
        }}
      />

      <TouchableOpacity
        onPress={handleWriteOneUser}
        style={{
          backgroundColor: 'blue',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          Ghi vào users/u1 bằng set()
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleAddRandomUser}
        style={{
          backgroundColor: 'green',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          Thêm user mới bằng push()
        </Text>
      </TouchableOpacity>

      <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>
        Dữ liệu users:
      </Text>
      <Text>{JSON.stringify(users, null, 2)}</Text>
    </View>
  );
}
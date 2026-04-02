import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { auth, rtdb } from '../firebase';
import { getUser, updateAllMyMessagesAvatar, uploadProfilePhotoBase64 } from '../services/rtdb';
import type { AppUser } from '../types';
import { ref, update } from 'firebase/database';
import { DEFAULT_AVATAR_BASE64 } from './constants'; // hoặc dán trực tiếp

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const user = await getUser(auth.currentUser!.uid);
      if (user) {
        setProfile(user);
        setDisplayName(user.displayName);
      }
    };
    loadProfile();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,           // giảm chất lượng để Base64 nhỏ hơn
    });

    if (!result.canceled && result.assets[0]) {
      setLoading(true);
      try {
        const newBase64 = await uploadProfilePhotoBase64(
          auth.currentUser!.uid,
          result.assets[0].uri
        );
        setProfile((prev) => prev ? { ...prev, photoURL: newBase64 } : null);
        await updateAllMyMessagesAvatar(auth.currentUser!.uid, newBase64);
        Alert.alert('Thành công', 'Đã cập nhật avatar!');
      } catch (err) {
        Alert.alert('Lỗi', 'Không thể cập nhật avatar');
      } finally {
        setLoading(false);
      }
    }
  };

  const saveProfile = async () => {
    if (!displayName.trim()) {
      return Alert.alert('Lỗi', 'Tên không được để trống');
    }
    setLoading(true);
    try {
      await update(ref(rtdb, `users/${auth.currentUser!.uid}`), {
        displayName: displayName.trim(),
      });
      Alert.alert('Thành công', 'Đã lưu tên!');
      router.back();
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể lưu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Chỉnh sửa hồ sơ</Text>

      <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={loading}>
        <Image
          source={{ uri: profile?.photoURL || DEFAULT_AVATAR_BASE64 }}
          style={styles.avatar}
        />
        <View style={styles.cameraIcon}>
          <Text style={{ color: '#fff', fontSize: 18 }}>📸</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.label}>Tên hiển thị</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Nhập tên của bạn"
      />

      <Text style={styles.label}>Email</Text>
      <Text style={styles.emailText}>{profile?.email}</Text>

      <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={loading}>
        <Text style={styles.saveText}>{loading ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Hủy</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 30 },
  avatarContainer: { alignSelf: 'center', marginBottom: 30, position: 'relative' },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#007bff' },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007bff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  label: { fontSize: 16, color: '#666', marginTop: 20, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  emailText: {
    fontSize: 16,
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#28a745',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  cancelButton: {
    marginTop: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: { color: '#dc3545', fontSize: 16, fontWeight: '600' },
});
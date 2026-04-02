import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';        // ← THÊM DÒNG NÀY
import { auth, rtdb } from '../../firebase';            // ← ĐẢM BẢO import rtdb
import type { AppUser } from '../../types';
import { DEFAULT_AVATAR_BASE64 } from '../constants';

export default function SettingsScreen() {
  const [profile, setProfile] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace('/login');
        return;
      }

      // ==================== PHẦN MỚI: Lắng nghe realtime avatar ====================
      const userRef = ref(rtdb, `users/${currentUser.uid}`);
      
      const unsubscribeDB = onValue(userRef, (snapshot) => {
        const userData = snapshot.val() as AppUser | null;
        if (userData) {
          setProfile(userData);        // ← Tự động cập nhật khi avatar thay đổi
        }
      });

      return () => unsubscribeDB();     // dọn dẹp listener
    });

    return unsubscribeAuth;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      Alert.alert('Thành công', 'Đăng xuất thành công!');
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Đăng xuất thất bại');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hồ sơ cá nhân</Text>

      <View style={styles.profileCard}>
        <Image
          source={{ uri: profile?.photoURL || DEFAULT_AVATAR_BASE64 }}
          style={styles.avatar}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{profile?.displayName || 'Chưa có tên'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => router.push('/edit-profile')}
      >
        <Text style={styles.editButtonText}>✏️ Chỉnh sửa hồ sơ</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.requestButton} onPress={() => router.push('/friend-requests')}>
        <Text style={styles.requestButtonText}>📩 Xem lời mời kết bạn</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>🚪 Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 30 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginRight: 16 },
  info: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 15, color: '#666', marginTop: 4 },
  editButton: {
    backgroundColor: '#007bff',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  editButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  requestButton: {
    backgroundColor: '#007bff',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  requestButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  logoutButton: {
    backgroundColor: '#dc3545',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { auth } from '../firebase';
import { ensureDirectRoom } from '../services/rtdb';

export default function IncomingCallScreen() {
  const { fromUid, fromName, roomId } = useLocalSearchParams<{
    fromUid: string;
    fromName: string;
    roomId: string;
  }>();

  const [ringSound, setRingSound] = useState<Audio.Sound | null>(null);

  // ==================== PHÁT TIẾNG REO CHUÔNG ====================
  useEffect(() => {
    let sound: Audio.Sound | null = null;

    const playRing = async () => {
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../assets/heart_of_hope-pop-blast-ringtones-236915.mp3') // ← bạn phải có file này
      );
      sound = newSound;
      setRingSound(newSound);
      await newSound.setIsLoopingAsync(true);
      await newSound.playAsync();
    };

    playRing();

    return () => {
      if (sound) sound.unloadAsync();
    };
  }, []);

  // ==================== KHI BẤM "NGHE" (ACCEPT) ====================
  const handleAccept = async () => {
    if (ringSound) await ringSound.stopAsync();

    try {
      // Đảm bảo phòng video call đã tồn tại
      const finalRoomId = await ensureDirectRoom(fromUid, auth.currentUser!.uid);

      // Chuyển sang màn hình video call thật sự
      router.replace(`/video-call/${finalRoomId}`);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tham gia cuộc gọi');
    }
  };

  // ==================== KHI BẤM "TỪ CHỐI" ====================
  const handleDecline = async () => {
    if (ringSound) await ringSound.stopAsync();
    Alert.alert('Đã từ chối', 'Bạn đã từ chối cuộc gọi video');
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cuộc gọi video đến</Text>
      <Text style={styles.callerName}>{fromName}</Text>
      <Text style={styles.subtitle}>Đang gọi cho bạn...</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
          <Text style={styles.declineText}>Từ chối</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
          <Text style={styles.acceptText}>Nghe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: { fontSize: 28, color: '#fff', marginBottom: 8 },
  callerName: { fontSize: 42, fontWeight: 'bold', color: '#0f0', marginBottom: 20 },
  subtitle: { fontSize: 20, color: '#ccc', marginBottom: 80 },
  buttonRow: { flexDirection: 'row', gap: 40 },
  declineBtn: {
    backgroundColor: '#dc3545',
    width: 130,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#28a745',
    width: 130,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  acceptText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { auth } from '../firebase';
import { ensureDirectRoom, saveMissedCall } from '../services/rtdb';

export default function IncomingCallScreen() {
  const { fromUid, fromName, roomId } = useLocalSearchParams<{
    fromUid: string;
    fromName: string;
    roomId: string;
  }>();

  const [ringSound, setRingSound] = useState<Audio.Sound | null>(null);
  const [isRinging, setIsRinging] = useState(true);

  // ==================== PHÁT TIẾNG REO CHUÔNG + TIMEOUT ====================
  useEffect(() => {
    let sound: Audio.Sound | null = null;

    const playRing = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          require('../assets/heart_of_hope-pop-blast-ringtones-236915.mp3'), // ← Đường dẫn file chuông của bạn
          { isLooping: true }
        );
        sound = newSound;
        setRingSound(newSound);
        await newSound.playAsync();
      } catch (error) {
        console.error('❌ Lỗi phát âm thanh reo chuông:', error);
      }
    };

    playRing();

    // Tự động timeout sau 30 giây → Cuộc gọi nhỡ
    const timeout = setTimeout(() => {
      if (isRinging) {
        handleMissedCall();
      }
    }, 30000);

    return () => {
      if (sound) sound.unloadAsync();
      clearTimeout(timeout);
    };
  }, [isRinging]);

  // ==================== XỬ LÝ CUỘC GỌI NHỠ ====================
  const handleMissedCall = async () => {
    if (ringSound) await ringSound.stopAsync();
    setIsRinging(false);

    if (fromUid && roomId && auth.currentUser) {
      await saveMissedCall(roomId as string, fromUid, fromName || 'Người gọi', auth.currentUser.uid);
    }

    Alert.alert(
      'Cuộc gọi nhỡ',
      `${fromName} đã gọi lúc ${new Date().toLocaleTimeString('vi-VN')}`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  // ==================== CHẤP NHẬN CUỘC GỌI ====================
  const handleAccept = async () => {
    if (ringSound) await ringSound.stopAsync();
    setIsRinging(false);

    try {
      const finalRoomId = await ensureDirectRoom(fromUid, auth.currentUser!.uid);
      router.replace(`/video-call/${finalRoomId}`);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tham gia cuộc gọi video');
      if (roomId) router.replace(`/chat/${roomId}`);
      else router.dismiss();
    }
  };

  // ==================== TỪ CHỐI CUỘC GỌI ====================
  const handleDecline = async () => {
    if (ringSound) await ringSound.stopAsync();
    setIsRinging(false);

    if (fromUid && roomId && auth.currentUser) {
      await saveMissedCall(roomId as string, fromUid, fromName || 'Người gọi', auth.currentUser.uid);
    }

    Alert.alert('Đã từ chối', 'Bạn đã từ chối cuộc gọi video');
    if (roomId) router.replace(`/chat/${roomId}`);
    else router.dismiss();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cuộc gọi video đến</Text>
      <Text style={styles.callerName}>{fromName || 'Người gọi'}</Text>
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
  title: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 8,
  },
  callerName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#0f0',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#ccc',
    marginBottom: 80,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 40,
  },
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
  declineText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  acceptText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
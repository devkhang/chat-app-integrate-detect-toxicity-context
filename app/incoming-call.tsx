import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { auth } from '../firebase';
import { ensureDirectRoom, saveMissedCall } from '../rtdb services/ChatService';
import { sendVideoCallPush } from '../rtdb services/NotificationService';
import { getUser } from '@/services/UserService';

export default function IncomingCallScreen() {
  const { fromUid, fromName, roomId, isGroup: isGroupParam } = useLocalSearchParams<{
    fromUid: string;
    fromName: string;
    roomId: string;
    isGroup?: string; // "true" hoặc "false" dưới dạng chuỗi
  }>();

  const [ringSound, setRingSound] = useState<Audio.Sound | null>(null);
  const isGroup = isGroupParam === 'true';
  // Xóa bỏ state isRinging vì không thực sự cần thiết cho logic chạy chuông
  // const [isRinging, setIsRinging] = useState(true);

  // ==================== PHÁT TIẾNG REO CHUÔNG + TIMEOUT ====================
  useEffect(() => {
    let sound: Audio.Sound | null = null;
    let timeout: NodeJS.Timeout;

    const playRing = async () => {
      try {
        // 1. CẤU HÌNH AUDIO MODE (SỬA LỖI AUDIO FOCUS)
        // Bắt buộc phải có đoạn này trước khi createAsync
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, // Phát ra loa ngoài
        });

        // 2. TẠO VÀ PHÁT ÂM THANH
        const { sound: newSound } = await Audio.Sound.createAsync(
          require('../assets/heart_of_hope-pop-blast-ringtones-236915.mp3'),
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

    // 3. Tự động timeout sau 30 giây → Cuộc gọi nhỡ
    timeout = setTimeout(() => {
      handleMissedCall(sound); // Truyền trực tiếp sound vào để đảm bảo tắt được chuông
    }, 30000);

    // 4. CLEANUP DỌN DẸP
    return () => {
      if (sound) {
        sound.stopAsync();
        sound.unloadAsync(); // Trả lại quyền Audio cho hệ thống
      }
      clearTimeout(timeout);
    };
  }, []); // <--- QUAN TRỌNG: Để mảng rỗng [] để chỉ chạy 1 lần khi mount

  // ==================== XỬ LÝ CUỘC GỌI NHỠ ====================
  // Nhận tham số currentSound để phòng trường hợp state ringSound chưa kịp cập nhật
  const handleMissedCall = async (currentSound?: Audio.Sound | null) => {
    const soundToStop = currentSound || ringSound;
    if (soundToStop) {
      await soundToStop.stopAsync();
    }

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

    try {
      router.replace(`/video-call/${roomId}`);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tham gia cuộc gọi video');
      if (roomId) router.replace(`/chat/${roomId}`);
      else router.dismiss();
    }
  };

// ==================== TỪ CHỐI CUỘC GỌI ====================
const handleDecline = async () => {
  if (ringSound) await ringSound.stopAsync();

  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !fromUid) return;

    const myProfile = await getUser(currentUser.uid);

    // ── GỬI THÔNG BÁO "DECLINED" VỀ CHO NGƯỜI GỌI ──
    await sendVideoCallPush(
      fromUid,                          // gửi lại cho người gọi
      currentUser.uid,                  // người từ chối
      myProfile?.displayName || 'Người dùng',
      roomId as string,
      true                              // declined = true
    );

    // ── CHỈ LƯU MISSED CALL KHI LÀ DIRECT CHAT ──
    // console.log('📴 Cuộc gọi bị từ chối : ',isGroup);
    if (!isGroup) {
      await saveMissedCall(
        roomId as string,
        fromUid,
        fromName || 'Người gọi',
        currentUser.uid
      );
    }
    // Với group: KHÔNG lưu missed call (tránh duplicate)

    // Quay về chat
    if (roomId) {
      router.replace(`/chat/${roomId}`);
    } else {
      router.dismiss();
    }
  } catch (error) {
    console.error('Lỗi từ chối cuộc gọi:', error);
    if (roomId) router.replace(`/chat/${roomId}`);
    else router.dismiss();
  }
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
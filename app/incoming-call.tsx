import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, rtdb } from '../firebase'; // ✅ Đã thêm rtdb
import { ref, onValue } from 'firebase/database'; // ✅ Đã thêm import firebase database
import { ensureDirectRoom, saveMissedCall } from '../rtdb services/ChatService';
import { sendCallPush } from '../rtdb services/NotificationService';
import { getUser } from '@/rtdb services/UserService';
import { DEFAULT_AVATAR_BASE64 } from './constants';

export default function IncomingCallScreen() {
  const { fromUid, fromName, roomId, isGroup: isGroupParam, type } = useLocalSearchParams<{
    fromUid: string;
    fromName: string;
    roomId: string;
    isGroup?: string; // "true" hoặc "false" dưới dạng chuỗi
    type: "audio_call" | "video_call";   // ← Phân biệt gọi thoại hay video
  }>();

  const [ringSound, setRingSound] = useState<Audio.Sound | null>(null);
  const isGroup = isGroupParam === 'true';

  // 👉 Khai báo state hiển thị UI
  const [displayTitle, setDisplayTitle] = useState(fromName || "Cuộc gọi đến");
  const [displayAvatar, setDisplayAvatar] = useState(""); 

  // ==================== PHÁT TIẾNG REO CHUÔNG + TIMEOUT ====================
  useEffect(() => {
    let sound: Audio.Sound | null = null;
    let timeout: NodeJS.Timeout;

    const playRing = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, // Phát ra loa ngoài
        });

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

    // Tự động timeout sau 30 giây → Cuộc gọi nhỡ
    timeout = setTimeout(() => {
      handleMissedCall(sound); 
    }, 30000);

    return () => {
      if (sound) {
        sound.stopAsync();
        sound.unloadAsync(); 
      }
      clearTimeout(timeout);
    };
  }, []);

  // ==================== LOGIC REALTIME: LẤY TÊN/ẢNH PHÒNG ====================
useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => { // Không để async ở đây
      const roomData = snapshot.val();

      if (roomData) {
        if (roomData.type === 'group' || isGroup === "true") {
          setDisplayTitle(roomData.name || "Nhóm chat");
          if (roomData.photoURL) {
            setDisplayAvatar(roomData.photoURL);
          }
        } else {
          setDisplayTitle(`${fromName}`);
          
          // 👉 Dùng hàm async tự gọi (IIFE) để xử lý await
          (async () => {
            if (fromUid) {
              try {
                const callerProfile = await getUser(fromUid);
                if (callerProfile?.photoURL) {
                  setDisplayAvatar(callerProfile.photoURL);
                }
              } catch (error) {
                console.error("Lỗi lấy avatar người gọi:", error);
              }
            }
          })();
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, fromName, isGroup, fromUid]);

  // ==================== XỬ LÝ CUỘC GỌI NHỠ ====================
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
      const targetRoute = type === 'audio_call' 
        ? `/audio-call/${roomId}` 
        : `/video-call/${roomId}`;
      console.log(`✅ Tham gia cuộc gọi ${type} → Điều hướng đến:`, targetRoute);
      router.replace(targetRoute);
    } catch (error) {
      const callTypeText = type === 'audio_call' ? 'thoại' : 'video';
      Alert.alert('Lỗi', `Không thể tham gia cuộc gọi ${callTypeText}`);
      
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

      await sendCallPush(
        fromUid,                          
        currentUser.uid,                  
        myProfile?.displayName || 'Người dùng',
        roomId as string,
        type as 'audio_call' | 'video_call', 
        true                              
      );

      if (!isGroup) {
        await saveMissedCall(
          roomId as string,
          fromUid,
          fromName || 'Người gọi',
          currentUser.uid
        );
      }

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
      {/* Hiển thị Avatar của cá nhân hoặc nhóm (Nếu có) */}
      {displayAvatar ? (
         <Image source={{ uri: displayAvatar || DEFAULT_AVATAR_BASE64 }} style={styles.avatar} />
      ) : (
         <View style={styles.avatarPlaceholder} />
      )}

      {/* ✅ Hiển thị linh hoạt thoại hay video */}
      <Text style={styles.title}>
        {type === 'video_call' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}
      </Text>
      
      <Text style={styles.callerName}>{displayTitle}</Text>
      
      <Text style={styles.subtitle}>
        {isGroup ? "Đang gọi cho nhóm bạn..." : "Đang gọi cho bạn..."}
      </Text>

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
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    color: '#fff',
    marginBottom: 8,
  },
  callerName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0f0',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
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
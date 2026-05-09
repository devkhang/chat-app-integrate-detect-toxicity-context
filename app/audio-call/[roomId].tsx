// app/audio-call/[roomId].tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
  PermissionsAndroid,
  FlatList,
} from 'react-native';
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } from 'react-native-agora';
import { useLocalSearchParams, router } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../firebase';
import { DEFAULT_AVATAR_BASE64 } from '../constants';
import { stringToNumberId } from '../../functions/src/shared/utils';
import { getUser } from '../../rtdb services/UserService';
import { ref, get, update } from "firebase/database";
import { rtdb } from "../../firebase";
import type { AppUser } from '../../types';

export default function AudioCallScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  const [isJoined, setIsJoined] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
  const [participants, setParticipants] = useState<Record<number, AppUser>>({});
  const [myInfo, setMyInfo] = useState<AppUser | null>(null);
  const [myAgoraUid, setMyAgoraUid] = useState<number | null>(null);
  const [isCallEnded, setIsCallEnded] = useState(false);

  const agoraEngineRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const appId = "3bf72467644c48bd87ca6dc9d73816c5";

  // ==================== LOAD THÔNG TIN BẢN THÂN ====================
  const loadMyInfo = async () => {
    if (!auth.currentUser) return;
    try {
      const user = await getUser(auth.currentUser.uid);
      if (user) {
        setMyInfo(user);
        const myUid = stringToNumberId(auth.currentUser.uid);
        setParticipants((prev) => ({ ...prev, [myUid]: user }));
        console.log("✅ Đã load thông tin bản thân:", user.displayName);
      }
    } catch (e) {
      console.error("Lỗi load my info:", e);
    }
  };

  // ==================== LOAD THÔNG TIN NGƯỜI THAM GIA (ĐỌC MAPPING) ====================
  const loadParticipantInfo = async (agoraUid: number) => {
    try {
      const mappingSnap = await get(ref(rtdb, `callParticipants/${roomId}/${agoraUid}`));
      const firebaseUid = mappingSnap.val();

      if (firebaseUid) {
        const user = await getUser(firebaseUid);
        if (user) {
          setParticipants((prev) => ({ ...prev, [agoraUid]: user }));
          console.log(`✅ Đã load user ${agoraUid} → ${user.displayName}`);
        }
      } else {
        console.log(`⚠️ Không tìm thấy mapping cho Agora UID: ${agoraUid}`);
      }
    } catch (e) {
      console.error("Lỗi load participant info:", e);
    }
  };

  // ==================== LẤY TOKEN ====================
  const getAgoraToken = useCallback(async () => {
    if (!roomId || !auth.currentUser) return null;
    try {
      const generateToken = httpsCallable(functions, "generateAgoraToken");
      const result = await generateToken({
        channel: roomId,
        firebaseUid: auth.currentUser.uid,
      });
      const data = result.data as { token: string; agoraUid: number };
      return { token: data.token, uid: data.agoraUid };
    } catch (error) {
      console.error("Lỗi lấy token:", error);
      Alert.alert("Lỗi", "Không thể kết nối cuộc gọi thoại");
      return null;
    }
  }, [roomId]);

  // ==================== KHỞI TẠO AGORA ====================
  const setupVoiceEngine = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert("Cần quyền Microphone để gọi thoại");
          return;
        }
      }

      agoraEngineRef.current = createAgoraRtcEngine();
      const engine = agoraEngineRef.current;

      engine.initialize({ appId });

      engine.registerEventHandler({
        onJoinChannelSuccess: () => {
          setIsJoined(true);
          console.log("✅ Đã vào phòng voice call");
          loadMyInfo();
        // ==================== TỰ ĐỘNG LƯU MAPPING ====================
          // if (auth.currentUser) {
          //   const myFirebaseUid = auth.currentUser.uid;
          //   const myAgoraUid = stringToNumberId(myFirebaseUid);

          //   update(ref(rtdb, `callParticipants/${roomId}`), {
          //     [myAgoraUid]: myFirebaseUid,
          //   })
          //     .then(() => {
          //       console.log("✅ Đã tự lưu mapping của mình:", myAgoraUid, "→", myFirebaseUid);
          //     })
          //     .catch((err) => {
          //       console.error("❌ Lỗi khi lưu mapping:", err);
          //     });
          // }
          // ================================================================
          if (auth.currentUser) {
            const myFirebaseUid = auth.currentUser.uid;
            // Tự tính UID tại chỗ để tránh lỗi Stale Closure của React
            const calculatedAgoraUid = stringToNumberId(myFirebaseUid); 

            const startVoiceCallFunction = httpsCallable(functions, "startVoiceCall");
            
            startVoiceCallFunction({
              roomId: roomId,
              firebaseUid: myFirebaseUid,
              agoraUid: calculatedAgoraUid, // Dùng biến vừa tính ở trên
            })
              .then(() => {
                console.log("✅ Đã gọi startVoiceCall thành công");
              })
              .catch((err) => {
                console.error("❌ Lỗi gọi startVoiceCall:", err);
              });
          }
        },
        onUserJoined: (_connection, uid) => {
          console.log("👤 User joined:", uid);
          setRemoteUsers((prev) => {
            if (!prev.includes(uid)) {
              loadParticipantInfo(uid);
              const newUsers = [...prev, uid];
              if (newUsers.length > 0 && !timerRef.current) {
                startTimer();
              }
              return newUsers;
            }
            return prev;
          });
        },
        onUserOffline: (_connection, uid) => {
          console.log("👤 User left:", uid);
          setRemoteUsers((prev) => {
            const newUsers = prev.filter((id) => id !== uid);
            if (newUsers.length === 0) {
              endCallDueToDisconnect();
            }
            return newUsers;
          });
        },
      });
    } catch (e) {
      console.error("Lỗi khởi tạo Agora:", e);
    }
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const endCallDueToDisconnect = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cleanupMyMapping();
    setIsCallEnded(true);
  };

  // ==================== THAM GIA PHÒNG ====================
  const joinChannel = async () => {
    if (!roomId) return;
    const tokenData = await getAgoraToken();
    if (!tokenData) return;

    const { token } = tokenData;
    const uid = stringToNumberId(auth.currentUser!.uid);
    setMyAgoraUid(uid);
    try {
      await agoraEngineRef.current?.joinChannel(token, roomId, uid, {
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
      });
    } catch (e) {
      console.error("Lỗi join channel:", e);
      Alert.alert("Lỗi", "Không thể tham gia cuộc gọi");
    }
  };

  // ==================== XÓA MAPPING KHI RỜI PHÒNG ====================
  const cleanupMyMapping = async () => {
    if (!roomId || !myAgoraUid || !auth.currentUser) return;
    try {
      // await update(ref(rtdb, `callParticipants/${roomId}`), {
      //   [myAgoraUid]: null,
      // });
      // console.log("🧹 Đã xóa mapping của mình");
      const endVoiceCallFunction = httpsCallable(functions, "endVoiceCall");
      await endVoiceCallFunction({
        roomId,
        firebaseUid: auth.currentUser.uid,
        agoraUid: myAgoraUid,
      });
      console.log("🧹 Đã gọi endVoiceCall thành công");
    } catch (e) {
      console.error("Lỗi xóa mapping:", e);
    }
  };

  // ==================== RỜI PHÒNG ====================
  const leaveChannel = async () => {
    await cleanupMyMapping();
    try {
      await agoraEngineRef.current?.leaveChannel();
      if (timerRef.current) clearInterval(timerRef.current);
      router.replace(`/chat/${roomId}`);
    } catch (e) {
      console.error("Lỗi rời phòng:", e);
    }
  };

  // ==================== MUTE MIC ====================
  const toggleMute = async () => {
    if (!agoraEngineRef.current) return;
    const newMuted = !isMuted;
    await agoraEngineRef.current.muteLocalAudioStream(newMuted);
    setIsMuted(newMuted);
  };

  // ==================== MỜI THÊM NGƯỜI ====================
  const inviteMorePeople = () => {
    Alert.alert("Tính năng đang phát triển", "Bạn sẽ có thể mời thêm người vào cuộc gọi nhóm");
  };

  // ==================== LIFECYCLE ====================
  useEffect(() => {
    setupVoiceEngine();
    joinChannel();

    const timer = setTimeout(() => {
      loadMyInfo();
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (agoraEngineRef.current) {
        agoraEngineRef.current.leaveChannel();
        agoraEngineRef.current.release();
      }
      clearTimeout(timer);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // ==================== UI KẾT THÚC CUỘC GỌI ====================
  if (isCallEnded) {
    return (
      <View style={styles.endedContainer}>
        <Text style={styles.endedText}>Cuộc gọi kết thúc</Text>
        <TouchableOpacity style={styles.endXButton} onPress={() => router.replace(`/chat/${roomId}`)}>
          <Text style={styles.endXText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==================== UI CHÍNH ====================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cuộc gọi thoại nhóm</Text>
        <Text style={styles.participantCount}>
          {remoteUsers.length + 1} người
        </Text>
      </View>

      <View style={styles.participantsContainer}>
        <FlatList
          data={remoteUsers}
          keyExtractor={(uid) => uid.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item: uid }) => {
            const user = participants[uid];
            return (
              <View style={styles.participantItem}>
                <Image
                  source={{ uri: user?.photoURL || DEFAULT_AVATAR_BASE64 }}
                  style={styles.participantAvatar}
                />
                <Text style={styles.participantName} numberOfLines={1}>
                  {user?.displayName || `User ${uid}`}
                </Text>
              </View>
            );
          }}
          ListHeaderComponent={
            <View style={styles.participantItem}>
              <Image
                source={{ uri: myInfo?.photoURL || DEFAULT_AVATAR_BASE64 }}
                style={[styles.participantAvatar, { borderColor: '#10a37f' }]}
              />
              <Text style={styles.participantName}>
                {myInfo?.displayName || 'Bạn'}
              </Text>
            </View>
          }
        />
      </View>

      <View style={styles.statusContainer}>
        {remoteUsers.length === 0 ? (
          <Text style={styles.callingText}>Đang gọi thoại...</Text>
        ) : (
          <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
          <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
          <Text style={styles.controlLabel}>{isMuted ? 'Bật mic' : 'Tắt mic'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.inviteBtn} onPress={inviteMorePeople}>
          <Text style={styles.inviteIcon}>➕</Text>
          <Text style={styles.inviteLabel}>Mời thêm</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallBtn} onPress={leaveChannel}>
          <Text style={styles.endCallText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  header: { paddingTop: 60, paddingHorizontal: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  participantCount: { color: '#10a37f', fontSize: 14, marginTop: 4 },
  participantsContainer: { marginTop: 30, height: 110 },
  participantItem: { alignItems: 'center', marginRight: 16, width: 70 },
  participantAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#444' },
  participantName: { color: '#ccc', fontSize: 12, marginTop: 6, textAlign: 'center' },
  statusContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  callingText: { color: '#aaa', fontSize: 22, fontStyle: 'italic' },
  durationText: { color: '#10a37f', fontSize: 48, fontWeight: '700' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 60, paddingHorizontal: 20 },
  controlBtn: { alignItems: 'center' },
  controlIcon: { fontSize: 36 },
  controlLabel: { color: '#ccc', fontSize: 12, marginTop: 6 },
  inviteBtn: { alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  inviteIcon: { fontSize: 28, color: '#10a37f' },
  inviteLabel: { color: '#10a37f', fontSize: 12, marginTop: 4, fontWeight: '600' },
  endCallBtn: { backgroundColor: '#dc3545', width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  endCallText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  endedContainer: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  endedText: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 40 },
  endXButton: { backgroundColor: '#dc3545', width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  endXText: { color: '#fff', fontSize: 50, fontWeight: 'bold' },
});
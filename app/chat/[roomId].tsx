// app/chat/[roomId].tsx
import React, { useEffect, useMemo, useState,useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useChatRoomScreen } from '../../hooks/useChatRoomScreen';
import { useToxicDetection } from '../../hooks/useToxicDetection';
import * as ImagePicker from 'expo-image-picker';
import { sendChatMessage,subscribeTyping,setTyping,removeTypingOnDisconnect } from '../../rtdb services/ChatService';
import { getUser } from '../../rtdb services/UserService';
import { sendMessagePush, sendCallPush } from '../../rtdb services/NotificationService';
import type { Message } from '../../types';
import { DEFAULT_AVATAR_BASE64 } from '../constants';
import { auth, rtdb } from '@/firebase';
import { styles } from './styles1';
// Thêm import ở đầu file
import VoiceMessageBubble from '../../components/VoiceMessageBubble';
import { Audio } from 'expo-av';
import { stringToNumberId } from '@/functions/src/shared/utils';
import { ref, update ,onValue } from 'firebase/database';

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { room, messages, text: chatText, setText: setChatText, myUid, typingUsers,myName } =
    useChatRoomScreen(roomId);
  const router = useRouter();
  const { text, setText, result, isAnalyzing, status, progress } = useToxicDetection();
  const otherUid = useMemo(() => {
    if (!room || room.type !== 'direct' || !myUid) return "";
    return room.members.find((uid: string) => uid !== myUid) || "";
  }, [room, myUid]);

  const [otherName, setOtherName] = useState('phòng chat');

  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [selectedEmoji, setSelectedEmoji] = useState('👍'); // CHỈ 1 EMOJI
  const [myProfile, setMyProfile] = useState<any>(null);
// ==================== LOAD 1 EMOJI CHÍNH TỪ ROOM ====================
  useEffect(() => {
  if (!roomId) return;

    const emojiRef = ref(rtdb, `rooms/${roomId}/quickEmojis`);

    // Lắng nghe realtime
    const unsubscribe = onValue(emojiRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().length > 0) {
        setSelectedEmoji(snapshot.val()[0]);
      } else {
        setSelectedEmoji('👍');
      }
    });

    return () => unsubscribe(); // Cleanup khi rời trang
  }, [roomId]);

  useEffect(() => {
    if (!otherUid) return;

    getUser(otherUid).then((user) => {
      if (user) {
        setOtherName(user.displayName || user.email || 'Người dùng');
      }
    });
  }, [otherUid]);

  useEffect(() => {
    if (!myUid) return;

    const loadMyProfile = async () => {
      const profile = await getUser(myUid);
      if (profile) {
        setMyProfile(profile);
      }
    };

    loadMyProfile();
  }, [myUid]);

  const handleTextChange = (newText: string) => {
    setChatText(newText);
    setText(newText);
    if (roomId && myUid) {
      if (newText.trim().length > 0) {
        setTyping(roomId as string, myUid, true, myName);
      } else {
        setTyping(roomId as string, myUid, false);
      }
    }
  };

  // ==================== GHI ÂM VOICE (ĐÃ SỬA LỖI) ====================
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    // Bảo vệ: Không cho ghi nếu đang ghi hoặc có recording cũ
    if (isRecording || recordingRef.current) return;

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = newRecording;
      setIsRecording(true);
      setVoiceDuration(0);

      const interval = setInterval(() => {
        setVoiceDuration((prev) => prev + 1);
      }, 1000);

      (newRecording as any).interval = interval;
    } catch (err: any) {
      console.error("Lỗi ghi âm:", err);
      Alert.alert("Lỗi", "Không thể bắt đầu ghi âm");
    }
  };

  const stopRecording = async () => {
    const currentRecording = recordingRef.current;
    if (!currentRecording) return;

    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      if (!uri) return;

      setIsRecording(false);
      if ((currentRecording as any).interval) {
        clearInterval((currentRecording as any).interval);
      }

      // Chuyển thành Base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });


      sendChatMessage(roomId as string, 'voice', base64, voiceDuration);

      setVoiceDuration(0);
    } catch (err) {
      console.error("Lỗi gửi voice:", err);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn thoại");
    } finally {
      recordingRef.current = null;   // Quan trọng: reset ref
    }
  };

  // Gửi text
  const realSend = async () => {
    if (!myUid || !chatText.trim()) return;

    const trimmed = chatText.trim();     // ← Đây là dòng tạo trimmed

    try {
      // 1. Gửi tin nhắn thật vào database
      await sendChatMessage(roomId as string, 'text', trimmed);

      // 2. Gửi push thông báo
      if (room?.type === 'direct' && otherUid) {
        await sendMessagePush(otherUid, myUid, myProfile?.displayName || 'Bạn', trimmed, roomId as string);
      } 
      else if (room?.type === 'group') {
        const recipients = room.members.filter((uid: string) => uid !== myUid);
        await sendMessagePush(recipients, myUid, myProfile?.displayName || 'Bạn', trimmed, roomId as string);
      }

      setText('');   // Xóa ô nhập
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
    }
  };

  // Gửi ảnh
  const pickAndSendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (!myUid) return;

      try {
        await sendChatMessage(
          roomId as string,
          'image',
          result.assets[0].uri
        );
      } catch (err) {
        Alert.alert('Lỗi', 'Không thể gửi hình ảnh');
      }
    }
  };

  const handleVideoCall = async () => {
    if (!myUid || !room) return;

    const myProfile = await getUser(myUid);
    const fromName = myProfile?.displayName || myProfile?.email || 'Bạn';

    try {
      // Lấy tất cả thành viên KHÁC mình (hỗ trợ cả direct và group)
      const otherMembers = room.members.filter((uid: string) => uid !== myUid);

      if (otherMembers.length === 0) {
        Alert.alert('Thông báo', 'Không có thành viên nào để gọi');
        return;
      }

      // Gọi hàm mới (5 tham số) - đã đồng bộ với backend
      await sendCallPush(
        otherMembers,        // ← mảng người nhận (group hoặc direct)
        myUid,
        fromName,
        room.roomId,         // ← roomId để mọi người vào đúng phòng
        'video_call',             // ← loại cuộc gọi
        false                // declined = false (cuộc gọi bình thường)
      );


      // Người gọi nhảy vào phòng video ngay
      router.push(`/video-call/${room.roomId}`);

    } catch (err: any) {
      console.error("Lỗi gọi video:", err);
      Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi video. Vui lòng thử lại.');
    }
  };

  const handleAudioCall = async () => {
    if (!myUid || !room) return;

    const fromName = myProfile?.displayName || myProfile?.email || 'Bạn';

    const otherMembers = room.members.filter((uid: string) => uid !== myUid);

    await sendCallPush(
      otherMembers,
      myUid,
      fromName,
      room.roomId,
      'audio_call',
      false                // declined = false (cuộc gọi bình thường)                    // ← Quan trọng
    );
    

    router.replace(`/audio-call/${room.roomId}`);
  };

  const onSend = async () => {
    if (result?.isToxic && result.score > 0.75) {
      Alert.alert('Cảnh báo', 'Tin nhắn có thể gây tổn thương. Bạn vẫn muốn gửi?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Vẫn gửi', onPress: realSend },
      ]);
      return;
    }
    realSend();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : -200}
    >
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>
        {room?.type === 'group' ? room?.name || 'Nhóm chat' : otherName}
      </Text>
      
      {/* NÚT XEM DANH SÁCH THÀNH VIÊN */}
        {room?.type === 'group' && (
          <>
            <TouchableOpacity
              style={styles.membersButton}
              onPress={() => router.push(`/group-members/${roomId}`)}
            >
              <Text style={styles.membersText}>👥</Text>
            </TouchableOpacity>
          </>
        )}

      <TouchableOpacity style={styles.audioCallButton} onPress={handleAudioCall}>
        <Text style={styles.audioCallText}>📞</Text>
      </TouchableOpacity>
      {/* Nút Gọi Video nằm góc trên bên phải */}
      <TouchableOpacity style={styles.videoCallButton} onPress={handleVideoCall}>
        <Text style={styles.videoCallText}>📹</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.infoButton}
        onPress={() => {
          router.push(`/chat/room-settings?roomId=${roomId}`);
        }}
      >
        <View style={styles.infoIconContainer}>
          <Text style={styles.infoIcon}>i</Text>
        </View>
      </TouchableOpacity>
    </View>

      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        renderItem={({ item }: { item: Message }) => {
          const mine = item.senderId === myUid;
          const isEmoji = item.text && 
          item.text.length <= 4 && 
          /\p{Emoji}/u.test(item.text);   // Kiểm tra xem có phải emoji không

          if (isEmoji) {
            return (
            <View style={[styles.messageContainer, mine ? styles.myMessageContainer : styles.otherMessageContainer]}>
            {!mine && (
              <Image
                source={{ uri: item.senderPhotoURL || DEFAULT_AVATAR_BASE64 }}
                style={styles.senderAvatar}
              />
            )}

            <View 
              style={[
                styles.bubble, 
                mine ? styles.myBubble : styles.otherBubble,
                isEmoji && styles.emojiBubble   // ← Thêm style riêng cho emoji
              ]}
            >
              {item.text && (
                <Text 
                  style={[
                    mine ? styles.myText : styles.otherText,
                    isEmoji && styles.emojiText   // ← Style chữ emoji
                  ]}
                >
                  {item.text}
                </Text>
              )}
            </View>
          </View>
            );
          }
          // ==================== THÔNG BÁO HỆ THỐNG ====================
          if (item.type === "system") {
            return (
              <View style={styles.systemMessageContainer}>
                <Text style={styles.systemMessageText}>
                  {item.text}
                </Text>
              </View>
            );
          }
          if (item.type === "missed_call") {
            return (
              <View style={styles.missedCallContainer}>
                <Text style={styles.missedCallText}>
                  📴 Cuộc gọi video nhỡ từ {item.senderName} 
                  {'\n'}
                  <Text style={styles.missedCallTime}>
                    {new Date(item.timestamp).toLocaleTimeString('vi-VN')}
                  </Text>
                </Text>
              </View>
            );
          }
          if (item.type === "voice" && item.voiceBase64) {
            return (
              <View style={[styles.messageContainer, mine ? styles.myMessageContainer : styles.otherMessageContainer]}>
                {!mine && (
                  <Image source={{ uri: item.senderPhotoURL || DEFAULT_AVATAR_BASE64 }} style={styles.senderAvatar} />
                )}
                <VoiceMessageBubble item={item} isMine={mine} />
              </View>
            );
          }
          return (
            <View style={[styles.messageContainer, mine ? styles.myMessageContainer : styles.otherMessageContainer]}>
              {!mine && (
                <Image
                  source={{ uri: item.senderPhotoURL || DEFAULT_AVATAR_BASE64 }}
                  style={styles.senderAvatar}
                />
              )}
              <View style={[styles.bubble, mine ? styles.myBubble : styles.otherBubble]}>
                {item.type === 'image' && item.imageBase64 && (
                  <Image source={{ uri: item.imageBase64 }} style={styles.chatImage} resizeMode="cover" />
                )}
                {item.text && <Text style={mine ? styles.myText : styles.otherText}>{item.text}</Text>}
              </View>
            </View>
          );
        }}
      />
      {/* ==================== TYPING INDICATOR - HIỂN THỊ TÊN THẬT ==================== */}
      {Object.keys(typingUsers || {}).length > 0 ? (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {Object.entries(typingUsers || {})
              .filter(([uid]) => uid !== myUid)                    // loại bỏ chính mình
              .map(([, data]) => data.displayName)                 // lấy tên thật
              .join(", ")}{" "}
            đang gõ...
          </Text>
        </View>
      ) : null}
      {/* ==================== INPUT + TOXIC DISPLAY ==================== */}
      <View style={styles.inputArea}>
        {/* Progress tải mô hình */}
        {status === 'loading' && (
          <Text style={styles.modelLoadingText}>
            Đang tải mô hình... {progress}%
          </Text>
        )}

        {/* Đang phân tích */}
        {isAnalyzing && (
          <Text style={styles.analyzingText}>Đang phân tích nội dung...</Text>
        )}

        {/* Cảnh báo toxic + phần trăm */}
        {result?.isToxic && (
          <View style={styles.warningRow}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Toxic: {(result.score * 100).toFixed(0)}% - {result.warningText}
            </Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.imageButton} onPress={pickAndSendImage}>
            <Text style={styles.imageButtonText}>📸</Text>
          </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
          onPressIn={startRecording}     // Nhấn giữ để bắt đầu ghi
          onPressOut={stopRecording}     // Thả ra để dừng và gửi
          disabled={isAnalyzing}
        >
        <Ionicons
          name={isRecording ? "mic" : "mic-outline"}
          size={28}
          color={isRecording ? "#ef4444" : "#0084ff"}
        />
        </TouchableOpacity>
          <TextInput
            style={[styles.input, result?.isToxic && styles.inputToxic]}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Nhập"
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="send"
            blurOnSubmit={false}
          />

          {text.trim().length > 0 ? (
            <TouchableOpacity style={styles.sendButton} onPress={onSend}>
              <Text style={styles.sendText}>Gửi</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.singleEmojiButton}
              onPress={() => {
                sendChatMessage(roomId as string, 'text', selectedEmoji);
              }}
            >
              <Text style={styles.singleEmojiText}>{selectedEmoji}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}


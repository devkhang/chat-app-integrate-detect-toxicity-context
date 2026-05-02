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
import { sendMessage, sendImageMessage,subscribeTyping,setTyping,removeTypingOnDisconnect,sendVoiceMessage } from '../../services/ChatService';
import { getUser } from '../../services/UserService';
import { sendMessagePush, sendVideoCallPush } from '../../services/NotificationService';
import type { Message } from '../../types';
import { DEFAULT_AVATAR_BASE64 } from '../constants';
import { auth } from '@/firebase';
// Thêm import ở đầu file
import VoiceMessageBubble from '../../components/VoiceMessageBubble';
import { Audio } from 'expo-av';

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

  useEffect(() => {
    if (!otherUid) return;

    getUser(otherUid).then((user) => {
      if (user) {
        setOtherName(user.displayName || user.email || 'Người dùng');
      }
    });
  }, [otherUid]);

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

      const myProfile = await getUser(myUid);

      await sendVoiceMessage(
        roomId as string,
        base64,
        voiceDuration,
        myUid,
        myName,
        myProfile?.photoURL || DEFAULT_AVATAR_BASE64
      );

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

    const myProfile = await getUser(myUid);

    try {
      // 1. Gửi tin nhắn thật vào database
      await sendMessage(roomId as string, trimmed, myUid, 'Bạn', myProfile?.photoURL || DEFAULT_AVATAR_BASE64);

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
      const myProfile = await getUser(myUid);

      try {
        await sendImageMessage(
          roomId as string,
          result.assets[0].uri,
          myUid,
          'Bạn',
          myProfile?.photoURL || DEFAULT_AVATAR_BASE64
        );
      } catch (err) {
        Alert.alert('Lỗi', 'Không thể gửi hình ảnh');
      }
    }
  };

  const handleVideoCall = async () => {
    if (!myUid || !room) return;

    const otherUid = room.members.find((uid: string) => uid !== myUid);
    if (!otherUid) {
      Alert.alert('Lỗi', 'Không tìm thấy người nhận');
      return;
    }

    const myProfile = await getUser(myUid);

    try {
      // Gửi thông báo push cho người kia (để họ reo chuông)
      await sendVideoCallPush(
        otherUid,
        myUid,
        myProfile?.displayName || 'Bạn'
      );

      // A cũng nhảy vào màn hình video call
      router.replace(`/video-call/${room.roomId}`);
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi video');
    }
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


      {/* Nút Gọi Video nằm góc trên bên phải */}
      <TouchableOpacity style={styles.videoCallButton} onPress={handleVideoCall}>
        <Text style={styles.videoCallText}>📹</Text>
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

          <TouchableOpacity style={styles.sendButton} onPress={onSend} disabled={isAnalyzing}>
            <Text style={styles.sendText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 18, fontWeight: '700', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee', textAlign: 'left' },
  list: { padding: 16, flexGrow: 1, paddingBottom: 20 },

  messageContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, maxWidth: '85%' },
  myMessageContainer: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  otherMessageContainer: { alignSelf: 'flex-start' },
  senderAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },

  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18 },
  myBubble: { backgroundColor: '#0084ff', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#f1f1f1', borderBottomLeftRadius: 4 },
  myText: { color: '#fff', fontSize: 16 },
  otherText: { color: '#222', fontSize: 16 },

  chatImage: { width: 220, height: 220, borderRadius: 12, marginVertical: 4 },

  inputArea: { padding: 12, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  imageButton: { width: 48, height: 48, backgroundColor: '#f0f0f0', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  imageButtonText: { fontSize: 26 },
  input: { flex: 1, minHeight: 48, maxHeight: 160, borderWidth: 1, borderColor: '#ddd', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, backgroundColor: '#f9f9f9' },
  inputToxic: { borderColor: '#ef4444', borderWidth: 2, backgroundColor: '#fef2f2' },
  sendButton: { backgroundColor: '#0084ff', height: 48, paddingHorizontal: 24, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  modelLoadingText: { color: '#10a37f', fontSize: 13, marginBottom: 6, textAlign: 'center' },
  analyzingText: { color: '#10a37f', fontSize: 13, marginBottom: 6, textAlign: 'center' },
  warningRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', padding: 10, borderRadius: 8, marginBottom: 8 },
  warningIcon: { fontSize: 18, marginRight: 8 },
  warningText: { color: '#d97706', fontSize: 14, flex: 1 },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },

  videoCallButton: {
    width: 40,
    height: 40,
    backgroundColor: '#28a745',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  videoCallText: {
    fontSize: 22,
    color: '#fff',
  },
  missedCallContainer: {
    alignSelf: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 8,
    maxWidth: '80%',
  },

  missedCallText: {
    color: '#d97706',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },

  missedCallTime: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '400',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  typingText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  voiceButtonActive: {
    backgroundColor: '#fee2e2',
    transform: [{ scale: 1.1 }],
  },
    addMemberButton: {
    width: 40,
    height: 40,
    backgroundColor: '#28a745',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addMemberText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 28,
  },
    membersButton: {
    width: 40,
    height: 40,
    backgroundColor: '#007bff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  membersText: {
    fontSize: 22,
    color: '#fff',
  },
    systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 8,
    maxWidth: '80%',
  },
  systemMessageText: {
    color: '#555',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
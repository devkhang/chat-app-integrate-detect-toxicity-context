// app/video-call/[roomId].tsx
import AgoraUIKit from "agora-rn-uikit";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useEffect, useState, useMemo, useCallback } from "react";
import { StyleSheet, Text, View, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "../../firebase";
import { router } from "expo-router";   // ← ĐÃ THÊM

export default function VideoCallRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  // ==================== STATE ====================
  const [token, setToken] = useState<string>("");
  const [agoraUid, setAgoraUid] = useState<number>(0);
  const [loadingToken, setLoadingToken] = useState(true);

  // Quyền Camera & Microphone
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const appId = "3bf72467644c48bd87ca6dc9d73816c5";

  // ==================== LẤY TOKEN TỪ FIREBASE ====================
  const getAgoraToken = useCallback(async () => {
    if (!roomId || !auth.currentUser?.uid) return;

    try {
      setLoadingToken(true);
      const generateToken = httpsCallable(functions, "generateAgoraToken");
      console.log("Current User UID:", auth.currentUser?.uid);

      const result = await generateToken({
        channel: roomId,
        firebaseUid: auth.currentUser.uid,
      });

      const data = result.data as { token: string; agoraUid: number };

      setToken(data.token);
      setAgoraUid(data.agoraUid);
      console.log("✅ Token Agora đã nhận thành công, UID:", data.agoraUid);
    } catch (error: any) {
      console.error("❌ Lỗi lấy token:", error);
      Alert.alert("Lỗi", "Không thể lấy token video call");
    } finally {
      setLoadingToken(false);
    }
  }, [roomId]);

  useEffect(() => {
    getAgoraToken();
  }, [getAgoraToken]);

  // Xin quyền Camera & Mic
  useEffect(() => {
    if (!camPermission?.granted) requestCamPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, [camPermission, micPermission, requestCamPermission, requestMicPermission]);

  // ==================== KẾT THÚC CUỘC GỌI & NAVIGATE VỀ CHAT ====================
  const endCall = useCallback(() => {
    // Sử dụng setTimeout nhỏ để tránh xung đột render với AgoraUIKit
    setTimeout(() => {
      console.log("📴 Cuộc gọi kết thúc → Chuyển về chat room:", roomId);
      router.replace(`/chat/${roomId}`);   // ← Đây là dòng quan trọng
    }, 10);
  }, [roomId]);

  // ==================== DATA TRUYỀN CHO AGORA ====================
  const connectionData = useMemo(() => ({
    appId,
    channel: roomId,
    token,
    uid: agoraUid,
    rtmEnabled: false,
  }), [appId, roomId, token, agoraUid]);

  const rtcCallbacks = useMemo(() => ({
    EndCall: endCall,

    UserJoined: (...args: any[]) => {
      console.log(`👤 User đã tham gia phòng. Dữ liệu:`, JSON.stringify(args));
    },
    UserOffline: (...args: any[]) => {
      console.log(`👤 User đã rời phòng. Dữ liệu:`, JSON.stringify(args));
    },
  }), [endCall]);

  // ==================== RENDER ====================
  if (!camPermission?.granted || !micPermission?.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textWhite}>Đang xin quyền Camera và Microphone...</Text>
      </View>
    );
  }

  if (loadingToken) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textWhite}>Đang lấy token video call...</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textWhite}>Lỗi: Không lấy được token</Text>
      </View>
    );
  }

  // ==================== HIỂN THỊ CUỘC GỌI ====================
  return (
    <AgoraUIKit
      connectionData={connectionData}
      rtcCallbacks={rtcCallbacks}
      styleProps={{ theme: "dark" }}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  textWhite: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
});
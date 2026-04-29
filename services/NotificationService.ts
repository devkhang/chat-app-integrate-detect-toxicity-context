import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Alert } from "react-native";

export async function savePushToken(uid: string, pushToken: string) {
  try {
    const saveToken = httpsCallable(functions, "savePushToken");

    const result = await saveToken({ pushToken });

    const data = result.data as { success: boolean; message?: string };

    console.log("✅ Push token đã lưu thành công:", data);
    return data;
  } catch (error: any) {
    console.error("❌ Lỗi lưu push token:", error);
    Alert.alert('Lỗi', error.message || 'Không thể lưu push token');
    throw error;
  }
}

export async function sendMessagePush(
  toUids: string | string[],     // ← ĐÃ SỬA: hỗ trợ 1 người hoặc nhiều người
  fromUid: string,
  fromName: string,
  messageText: string,
  roomId: string
) {
  try {
    const sendPush = httpsCallable(functions, "sendMessagePush");

    // Chuẩn hóa thành mảng
    const toUidsArray = Array.isArray(toUids) ? toUids : [toUids];

    const result = await sendPush({
      toUids: toUidsArray,        // ← Truyền mảng vào
      fromUid,
      fromName,
      messageText,
      roomId,
    });

    const data = result.data as { success: boolean; message?: string };

    console.log("✅ Gửi push tin nhắn thành công:", data);
    return data;
  } catch (error: any) {
    console.error("❌ Lỗi gửi push tin nhắn:", error);
    throw error;
  }
}


export async function sendVideoCallPush(
  toUid: string, 
  fromUid: string, 
  fromName: string
) {
  try {
    const sendPush = httpsCallable(functions, "sendVideoCallPush");

    const result = await sendPush({ toUid, fromUid, fromName });

    const data = result.data as {
      success: boolean;
      message?: string;
      expoResult?: any;
    };

    console.log("📤 Kết quả từ Cloud Function:", data);

    if (data.success) {
      console.log("✅ Gửi push video call thành công!");
      // Có thể Alert nếu muốn thông báo cho người gọi
      // Alert.alert('Thành công', data.message);
    } else {
      Alert.alert('Thông báo', data.message || 'Không thể gửi cuộc gọi');
    }

    return data;        // ← Bạn có thể return để sử dụng ở component nếu cần
  } catch (error: any) {
    console.error("❌ Lỗi Cloud Function sendVideoCallPush:", error);
    Alert.alert('Lỗi', error.message || 'Không thể gửi thông báo cuộc gọi');
    throw error;
  }
}
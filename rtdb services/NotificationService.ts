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
  fromName: string,
  roomId?: string,
  declined: boolean = false     // chỉ giữ declined
) {
  try {
    const sendPush = httpsCallable(functions, "sendVideoCallPush");

    console.log(`📤 Gửi push video call - declined = ${declined} | roomId = ${roomId}`);

    const result = await sendPush({
      toUid,
      fromUid,
      fromName,
      roomId,
      declined,                    // ← Quan trọng: Phải truyền rõ ràng
    });

    const data = result.data as any;
    console.log("✅ Gửi push video call thành công:", data);

    return data;
  } catch (error: any) {
    console.error("❌ Lỗi sendVideoCallPush:", error);
    Alert.alert('Lỗi', error.message || 'Không thể gửi thông báo');
    throw error;
  }
}
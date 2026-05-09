import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// ==================== BẮT ĐẦU CUỘC GỌI THOẠI (LƯU MAPPING) ====================
export const startVoiceCall = onCall(async (request) => {
  try {
    const { roomId, firebaseUid, agoraUid } = request.data;

    if (!request.auth || request.auth.uid !== firebaseUid) {
      throw new Error("Không có quyền bắt đầu cuộc gọi");
    }

    if (!roomId || !firebaseUid || !agoraUid) {
      throw new Error("Thiếu thông tin cuộc gọi");
    }

    // Lưu mapping
    await admin.database().ref(`callParticipants/${roomId}/${agoraUid}`).set(firebaseUid);

    logger.info(`✅ Đã lưu mapping: ${agoraUid} → ${firebaseUid} trong phòng ${roomId}`);
    console.log(`✅ Đã lưu mapping: ${agoraUid} → ${firebaseUid} trong phòng ${roomId}`);
    return { success: true, message: "Đã bắt đầu cuộc gọi" };
  } catch (error: any) {
    logger.error("❌ Lỗi startVoiceCall:", error);
    throw new Error(error.message || "Không thể bắt đầu cuộc gọi");
  }
});

// ==================== KẾT THÚC CUỘC GỌI THOẠI (XÓA MAPPING) ====================
export const endVoiceCall = onCall(async (request) => {
  try {
    const { roomId, firebaseUid, agoraUid } = request.data;

    if (!request.auth || request.auth.uid !== firebaseUid) {
      throw new Error("Không có quyền kết thúc cuộc gọi");
    }

    if (!roomId || !firebaseUid || !agoraUid) {
      throw new Error("Thiếu thông tin cuộc gọi");
    }

    // Xóa mapping của chính mình
    await admin.database().ref(`callParticipants/${roomId}/${agoraUid}`).remove();

    // Kiểm tra xem còn ai trong phòng không
    const participantsSnap = await admin.database().ref(`callParticipants/${roomId}`).once("value");
    if (!participantsSnap.exists() || Object.keys(participantsSnap.val()).length === 0) {
      // Không còn ai → xóa toàn bộ node
      await admin.database().ref(`callParticipants/${roomId}`).remove();
      logger.info(`🧹 Đã xóa toàn bộ mapping của phòng ${roomId}`);
    }

    logger.info(`✅ Đã xóa mapping của ${agoraUid} trong phòng ${roomId}`);

    return { success: true, message: "Đã kết thúc cuộc gọi" };
  } catch (error: any) {
    logger.error("❌ Lỗi endVoiceCall:", error);
    throw new Error(error.message || "Không thể kết thúc cuộc gọi");
  }
});
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { RtcTokenBuilder, RtcRole } from "agora-token";

// ==================== THÔNG TIN AGORA ====================
const APP_ID = "3bf72467644c48bd87ca6dc9d73816c5";
const APP_CERTIFICATE = "9bcb05bb69914336a7142449d7814b0b"; // BẮT BUỘC thay bằng của bạn!

const stringToNumberId = (uid: string): number => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Chuyển thành 32bit integer
  }
  return Math.abs(hash);
};

export const generateAgoraToken = onCall(async (request) => {
  try {
    const { channel, firebaseUid } = request.data;
    logger.info(`👉 [DEBUG V2] Nhận request - Channel: ${channel} | FirebaseUID: ${firebaseUid}`);
    
    if (!channel || !firebaseUid) {
      throw new Error("Thiếu channel hoặc firebaseUid");
    }

    // Tạo Agora UID từ Firebase UID
    const agoraUid = stringToNumberId(firebaseUid);

    // ==================== THỜI GIAN HẾT HẠN ====================
    const expirationInSeconds = 30 * 24 * 3600;           // Token sống 24 giờ
    const tokenExpireTimeInSeconds = expirationInSeconds;
    const privilegeExpireTimeInSeconds = expirationInSeconds;

    // ==================== TẠO TOKEN ====================
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      agoraUid,
      RtcRole.PUBLISHER,
      tokenExpireTimeInSeconds,
      privilegeExpireTimeInSeconds
    );

    logger.info(`✅ Token generated | Channel: ${channel} | AgoraUID: ${agoraUid}`);

    return {
      success: true,
      token,
      appId: APP_ID,
      agoraUid,
    };
  } catch (error: any) {
    logger.error("❌ Lỗi generateAgoraToken:", error);
    throw new Error(error.message || "Không thể tạo token video call");
  }
});
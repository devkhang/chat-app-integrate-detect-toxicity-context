import { setGlobalOptions } from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { RtcTokenBuilder, RtcRole } from "agora-token";   // ← package mới
import { makeDirectRoomId } from "./shared/utils"; // Hàm tạo roomId từ 2 UID
import * as admin from "firebase-admin";
admin.initializeApp();
// ==================== CẤU HÌNH TOÀN CỤC ====================
setGlobalOptions({
  region: "asia-southeast1",
  timeoutSeconds: 30,
  memory: "256MiB",
});

// ==================== THÔNG TIN AGORA ====================
const APP_ID = "3bf72467644c48bd87ca6dc9d73816c5";
const APP_CERTIFICATE = "9bcb05bb69914336a7142449d7814b0b"; // ← BẮT BUỘC thay!

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

    // ==================== TẠO TOKEN (7 tham số) ====================
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      agoraUid,
      RtcRole.PUBLISHER,
      tokenExpireTimeInSeconds,        // ← Tham số thứ 6 (mới)
      privilegeExpireTimeInSeconds     // ← Tham số thứ 7 (mới)
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
// ==================== HÀM MỚI: GỬI PUSH VIDEO CALL TỪ SERVER ====================
export const sendVideoCallPush = onCall(async (request) => {
  try {
    const { toUid, fromUid, fromName } = request.data;

    // === BẢO MẬT: Phải đăng nhập và chỉ được gọi cho chính mình ===
    if (!request.auth) {
      throw new Error("Bạn phải đăng nhập để gọi video");
    }
    if (request.auth.uid !== fromUid) {
      throw new Error("Không có quyền gọi video thay người khác");
    }

    if (!toUid || !fromUid || !fromName) {
      throw new Error("Thiếu thông tin người nhận hoặc người gọi");
    }

    // === LẤY PUSH TOKEN CỦA NGƯỜI NHẬN TỪ RTDB ===
    const userSnap = await admin.database().ref(`users/${toUid}`).once("value");
    const user = userSnap.val() as { pushToken?: string; displayName?: string } | null;

    if (!user || !user.pushToken) {
      logger.warn(`⚠️ Người nhận ${toUid} chưa có pushToken`);
      return { success: false, message: "Người này chưa nhận được thông báo push" };
    }

    const roomId = makeDirectRoomId(fromUid, toUid);

    const payload = {
      to: user.pushToken,
      title: "📹 Cuộc gọi video",
      body: `${fromName} đang gọi video cho bạn`,
      data: {
        type: "video_call",
        fromUid,
        fromName,
        roomId,                    // ← Quan trọng để mở màn Incoming Call
      },
      sound: "default",
      priority: "high",
    };

    // === GỬI PUSH QUA EXPO ===
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    logger.info(`✅ Push video call đã gửi thành công đến ${toUid}`, result);

    return {
      success: true,
      message: "Đã gửi cuộc gọi video",
      expoResult: result,
    };
  } catch (error: any) {
    logger.error("❌ Lỗi sendVideoCallPush:", error);
    throw new Error(error.message || "Không thể gửi thông báo cuộc gọi");
  }
});

// ==================== HÀM MỚI: LƯU PUSH TOKEN TỪ SERVER ====================
export const savePushToken = onCall(async (request) => {
  try {
    const { pushToken } = request.data;

    // === BẢO MẬT: Phải đăng nhập ===
    if (!request.auth) {
      throw new Error("Bạn phải đăng nhập để lưu push token");
    }

    const uid = request.auth.uid;

    if (!pushToken || typeof pushToken !== "string") {
      throw new Error("Push token không hợp lệ");
    }

    // Lưu token vào RTDB
    await admin.database().ref(`users/${uid}`).update({
      pushToken,
      pushTokenUpdatedAt: Date.now(),   // ← thêm để dễ debug
    });

    logger.info(`✅ Push token đã lưu cho user ${uid}`);

    return {
      success: true,
      message: "Đã lưu push token thành công",
    };
  } catch (error: any) {
    logger.error("❌ Lỗi savePushToken:", error);
    throw new Error(error.message || "Không thể lưu push token");
  }
});
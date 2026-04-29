import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { makeDirectRoomId } from "./shared/utils";

// ==================== LƯU PUSH TOKEN ====================
export const savePushToken = onCall(async (request) => {
  try {
    const { pushToken } = request.data;

    if (!request.auth) {
      throw new Error("Bạn phải đăng nhập để lưu push token");
    }

    const uid = request.auth.uid;

    if (!pushToken || typeof pushToken !== "string") {
      throw new Error("Push token không hợp lệ");
    }

    await admin.database().ref(`users/${uid}`).update({
      pushToken,
      pushTokenUpdatedAt: Date.now(),
    });

    logger.info(`✅ Push token đã lưu cho user ${uid}`);

    return { success: true, message: "Đã lưu push token thành công" };
  } catch (error: any) {
    logger.error("❌ Lỗi savePushToken:", error);
    throw new Error(error.message || "Không thể lưu push token");
  }
});

// ==================== GỬI PUSH VIDEO CALL ====================
export const sendVideoCallPush = onCall(async (request) => {
  try {
    const { toUid, fromUid, fromName } = request.data;

    if (!request.auth || request.auth.uid !== fromUid) {
      throw new Error("Không có quyền gọi video thay người khác");
    }

    if (!toUid || !fromUid || !fromName) {
      throw new Error("Thiếu thông tin người nhận hoặc người gọi");
    }

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
        roomId,
      },
      sound: "default",
      priority: "high",
      channelId: "urgent_v2",  // <--- QUAN TRỌNG NHẤT
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    logger.info(`✅ Push video call đã gửi thành công đến ${toUid}`, result);

    return { success: true, message: "Đã gửi cuộc gọi video", expoResult: result };
  } catch (error: any) {
    logger.error("❌ Lỗi sendVideoCallPush:", error);
    throw new Error(error.message || "Không thể gửi thông báo cuộc gọi");
  }
});

// ==================== GỬI PUSH TIN NHẮN ====================
export const sendMessagePush = onCall(async (request) => {
  try {
    const { toUids, fromUid, fromName, messageText, roomId } = request.data;

    if (!request.auth || request.auth.uid !== fromUid) {
      throw new Error("Không có quyền gửi thông báo thay người khác");
    }

    if (!toUids || !fromUid || !fromName || !messageText || !roomId) {
      throw new Error("Thiếu thông tin cần thiết");
    }

    const uidList = Array.isArray(toUids) ? toUids : [toUids];
    const filteredUids = uidList.filter(uid => uid !== fromUid);

    if (filteredUids.length === 0) {
      return { success: true, message: "Không cần gửi push" };
    }

    const promises = filteredUids.map(uid => admin.database().ref(`users/${uid}`).once("value"));
    const snapshots = await Promise.all(promises);

    const tokens: string[] = [];
    snapshots.forEach((snap, index) => {
      const user = snap.val();
      if (user?.pushToken) {
        tokens.push(user.pushToken);
      } else {
        logger.warn(`⚠️ User ${filteredUids[index]} chưa có pushToken`);
      }
    });

    if (tokens.length === 0) {
      return { success: false, message: "Không có ai nhận được thông báo" };
    }

    const payload = {
      to: tokens.length === 1 ? tokens[0] : tokens,
      title: `📩 Tin nhắn mới từ ${fromName}`,
      body: messageText.length > 60 ? messageText.substring(0, 57) + "..." : messageText,
      data: { type: "new_message", fromUid, fromName, roomId },
      sound: "default",
      priority: "high",
      channelId: "urgent_v2",  // <--- QUAN TRỌNG NHẤT
      _displayInForeground: true
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    logger.info(`✅ Đã gửi push tin nhắn đến ${tokens.length} người`, result);

    return { success: true, message: `Đã gửi thông báo cho ${tokens.length} người`, expoResult: result };
  } catch (error: any) {
    logger.error("❌ Lỗi sendMessagePush:", error);
    throw new Error(error.message || "Không thể gửi thông báo tin nhắn");
  }
});
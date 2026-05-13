import { HttpsError, onCall } from "firebase-functions/v2/https";
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

export const sendCallPush = onCall(async (request) => {
  try {
    const { 
      toUids,           // ← CHỈ GIỮ LẠI cái này (hỗ trợ group)
      fromUid, 
      fromName, 
      declined = false,
      type,
      roomId            
    } = request.data;

    if (!request.auth || request.auth.uid !== fromUid) {
      throw new Error("Không có quyền gọi video thay người khác");
    }

    if (!fromUid || !fromName) {
      throw new Error("Thiếu thông tin người gọi");
    }

    // Xử lý toUids (có thể là string hoặc mảng)
    let recipients: string[] = [];
    if (Array.isArray(toUids)) {
      recipients = toUids;
    } else if (typeof toUids === "string") {
      recipients = [toUids];
    }

    const filteredUids = recipients.filter(uid => uid && uid !== fromUid);

    if (filteredUids.length === 0) {
      return { success: true, message: "Không có người nhận" };
    }

    // Lấy pushToken của tất cả người nhận
    const promises = filteredUids.map(uid => 
      admin.database().ref(`users/${uid}`).once("value")
    );
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
      return { success: false, message: "Không có pushToken nào hợp lệ" };
    }

    // Xác định roomId
    let finalRoomId = roomId;
    if (!finalRoomId && filteredUids.length === 1 && !declined) {
      finalRoomId = makeDirectRoomId(fromUid, filteredUids[0]);
    }

    const isGroup = filteredUids.length > 1;

    let title = "";
    let body = "";

    if (declined) {
      title = "📴 Cuộc gọi bị từ chối";
      body = `Người bên kia đã từ chối cuộc gọi`;
    } 
    else if (type === "audio_call") {
      title = isGroup ? "📞 Cuộc gọi thoại nhóm" : "📞 Cuộc gọi thoại";
      body = `${fromName} đang gọi thoại cho bạn`;
    } 
    else {
      title = isGroup ? "📹 Cuộc gọi video nhóm" : "📹 Cuộc gọi video";
      body = `${fromName} đang gọi video cho bạn`;
    }

    const payload = {
      to: tokens.length === 1 ? tokens[0] : tokens,
      title,
      body,
      data: {
        type,                    // audio_call hoặc video_call
        fromUid,
        fromName,
        roomId: roomId || "",
        declined,
        isGroup,
      },
      sound: "default",
      priority: "high",
      channelId: "urgent_v2",
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    logger.info(`✅ Đã gửi ${type} push cho ${tokens.length} người`, result);

    return { success: true, message: `Đã gửi cuộc gọi thành công` };

  } catch (error: any) {
    logger.error("❌ Lỗi sendCallPush:", error);
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

export const removePushToken = onCall(async (request) => {
  // 1. Kiểm tra đăng nhập
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Yêu cầu đăng nhập.");
  }

  const uid = request.auth.uid;
  const db = admin.database();

  try {
    // 2. Xóa Push Token của user này khỏi Database
    // (⚠️ LƯU Ý: Thay đổi đường dẫn này cho khớp với nơi bạn đang lưu Token ở hàm savePushToken nhé)
    await db.ref(`users/${uid}/pushToken`).remove(); 
    
    return { success: true, message: "Đã xóa token thành công" };
  } catch (error) {
    console.error("Lỗi khi xóa Push Token:", error);
    throw new HttpsError("internal", "Không thể xóa token trên server");
  }
});
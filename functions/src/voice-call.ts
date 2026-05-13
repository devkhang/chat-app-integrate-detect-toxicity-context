import { HttpsError, onCall } from "firebase-functions/v2/https";
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

export const saveMissedCall = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Chưa đăng nhập.");
  }

  const { roomId, fromUid, fromName, toUid } = request.data;
  
  // 👉 1. LẤY UID CỦA NGƯỜI ĐANG THỰC THI HÀM NÀY (Người bấm Từ chối hoặc máy hết 30s)
  const triggerUid = request.auth.uid; 
  
  if (!roomId || !fromUid || !fromName) {
    throw new HttpsError("invalid-argument", "Thiếu dữ liệu.");
  }

  const db = admin.database();
  const createdAt = Date.now();
  
  const msgForReceiver = `📞 Cuộc gọi nhỡ`;
  const msgForCaller = `📞 Cuộc gọi đi không bắt máy`;

  const updates: Record<string, any> = {};

  // Lưu tin nhắn vào lịch sử chat chung
  const newMsgKey = db.ref(`roomMessages/${roomId}`).push().key;
  updates[`roomMessages/${roomId}/${newMsgKey}`] = {
    id: newMsgKey,
    senderId: fromUid,
    senderName: fromName,
    type: "missed_call",
    text: msgForReceiver,
    timestamp: createdAt,
    isMissedCall: true,
    missedBy: toUid || null,
  };

  const roomSnap = await db.ref(`rooms/${roomId}`).once("value");

  if (!roomSnap.exists()) {
    if (!toUid) return { success: false, message: "Thiếu toUid" };

    updates[`rooms/${roomId}`] = {
      roomId,
      type: "direct",
      members: [fromUid, toUid].sort(),
      createdBy: fromUid,
      createdAt,
      lastMessage: msgForReceiver,
      lastMessageAt: createdAt,
      lastSenderId: fromUid,
    };

    updates[`userRooms/${fromUid}/${roomId}`] = {
      lastMessageAt: createdAt,
      lastMessage: msgForCaller, 
      unreadCount: 0,
    };
    updates[`userRooms/${toUid}/${roomId}`] = {
      lastMessageAt: createdAt,
      lastMessage: msgForReceiver, 
      // 👉 2. NẾU MÌNH TỰ TỪ CHỐI THÌ KHÔNG TẠO SỐ THÔNG BÁO (0)
      unreadCount: triggerUid === toUid ? 0 : 1, 
    };
  } else {
    updates[`rooms/${roomId}/lastMessage`] = msgForReceiver;
    updates[`rooms/${roomId}/lastMessageAt`] = createdAt;
    updates[`rooms/${roomId}/lastSenderId`] = fromUid;

    const roomData = roomSnap.val();
    
    if (roomData.members && Array.isArray(roomData.members)) {
      roomData.members.forEach((uid: string) => {
        updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;

        if (uid === fromUid) {
          updates[`userRooms/${uid}/${roomId}/lastMessage`] = msgForCaller;
        } else {
          updates[`userRooms/${uid}/${roomId}/lastMessage`] = msgForReceiver;
        }

        // 👉 3. CHỈ TĂNG UNREAD NẾU HỌ KHÔNG PHẢI LÀ NGƯỜI ĐANG TỪ CHỐI CUỘC GỌI NÀY
        if (toUid) {
          if (uid === toUid && uid !== triggerUid) {
            updates[`userRooms/${uid}/${roomId}/unreadCount`] = admin.database.ServerValue.increment(1);
          }
        } else {
          // Xử lý cho nhóm
          if (uid !== fromUid && uid !== triggerUid) {
            updates[`userRooms/${uid}/${roomId}/unreadCount`] = admin.database.ServerValue.increment(1);
          }
        }
      });
    }
  }

  await db.ref().update(updates);
  return { success: true };
});
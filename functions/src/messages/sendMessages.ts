import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Đảm bảo bạn đã khởi tạo admin ở file index.ts chính:
// if (!admin.apps.length) { admin.initializeApp(); }

export const sendChatMessage = onCall(async (request) => {
  // 1. Trong v2, auth nằm trong object request
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Người dùng chưa đăng nhập');
  }

  const senderId = request.auth.uid;
  
  // 2. Dữ liệu truyền từ client lên nằm ở request.data
  const { roomId, type, content, duration } = request.data;

  if (!roomId || !type || !content) {
    throw new HttpsError('invalid-argument', 'Thiếu dữ liệu đầu vào');
  }

  const db = admin.database();

  // 3. Tự động lấy Profile thật từ Database
  const userSnap = await db.ref(`users/${senderId}`).get();
  const userData = userSnap.val() || {};
  
  const realSenderName = userData.displayName || userData.email || 'Người dùng';
  const realSenderPhotoURL = userData.photoURL || 'https://via.placeholder.com/150'; 

  const msgRef = db.ref(`roomMessages/${roomId}`).push();
  const messageId = msgRef.key as string;
  const createdAt = Date.now();

  // 4. Chuẩn bị Payload
  const payload: any = {
    id: messageId,
    type: type,
    senderId,
    senderName: realSenderName,
    senderPhotoURL: realSenderPhotoURL,
    createdAt,
  };

  let lastMessageStr = "";

  // 5. Phân loại nội dung
  if (type === 'text') {
    payload.text = content;
    lastMessageStr = content;

  } else if (type === 'image') {
    payload.imageBase64 = content;
    payload.imageType = 'image/jpeg';
    lastMessageStr = '📸 Hình ảnh';

  } else if (type === 'voice') {
    payload.voiceBase64 = content;
    payload.voiceDuration = Math.round(duration || 0);
    payload.voiceMimeType = 'audio/m4a';
    lastMessageStr = '🎤 Tin nhắn thoại';
  } else {
    throw new HttpsError('invalid-argument', 'Loại tin nhắn không hợp lệ');
  }

  // 6. Cập nhật Atomic (nhiều node cùng lúc)
  const updates: Record<string, any> = {
    [`roomMessages/${roomId}/${messageId}`]: payload,
    [`rooms/${roomId}/lastMessage`]: lastMessageStr,
    [`rooms/${roomId}/lastMessageAt`]: createdAt,
    [`rooms/${roomId}/lastSenderId`]: senderId,
  };

  const roomSnap = await db.ref(`rooms/${roomId}`).get();
  const roomData = roomSnap.val();

  if (roomData?.members?.length) {
    roomData.members.forEach((uid: string) => {
      if (uid !== senderId) {
        updates[`userRooms/${uid}/${roomId}/unreadCount`] = admin.database.ServerValue.increment(1);
      }
      updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
    });
  }

  // 7. Thực thi
  await db.ref().update(updates);

  // Trả về kết quả
  return { success: true, messageId };
});
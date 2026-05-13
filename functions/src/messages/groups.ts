import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

function appendSystemMessage(
  roomId: string,
  text: string,
  members: string[], // <-- THÊM: Danh sách người nhận
  callerUid: string, // <-- THÊM: UID người thực hiện hành động (để không báo unread cho chính người đó)
  updates: Record<string, any>
): Record<string, any> {
  const db = admin.database();
  const msgRef = db.ref(`roomMessages/${roomId}`).push();
  const messageId = msgRef.key as string;
  const createdAt = Date.now();

  // 1. Lưu tin nhắn vào phòng
  updates[`roomMessages/${roomId}/${messageId}`] = {
    id: messageId,
    type: "system",
    text,
    senderName: "Hệ thống",
    senderId: "system",
    createdAt,
  };
  updates[`rooms/${roomId}/lastMessage`] = text;
  updates[`rooms/${roomId}/lastMessageAt`] = createdAt;
  updates[`rooms/${roomId}/lastSenderId`] = "system";

  // 2. 👉 BÁO UNREAD CHO TẤT CẢ THÀNH VIÊN TRONG NHÓM
  members.forEach((uid) => {
    // Không tăng số lượng chưa đọc cho người vừa thực hiện thao tác
    if (uid !== callerUid) {
      updates[`userRooms/${uid}/${roomId}/unreadCount`] = admin.database.ServerValue.increment(1);
    }
    // Ai cũng phải được cập nhật thời gian và nội dung mới để Inbox nổi lên trên cùng
    updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
    updates[`userRooms/${uid}/${roomId}/lastMessage`] = text;
  });

  return updates;
}

// ==================== 1. TẠO NHÓM CHAT ====================
export const createGroupRoom = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Yêu cầu đăng nhập.");
  
  const { groupName, selectedUids } = request.data;
  const callerUid = request.auth.uid;

  if (!groupName || !selectedUids || !Array.isArray(selectedUids)) {
    throw new HttpsError("invalid-argument", "Thiếu tên nhóm hoặc danh sách thành viên.");
  }

  const db = admin.database();
  const roomRef = db.ref("rooms").push();
  const roomId = roomRef.key as string;
  const members = Array.from(new Set([callerUid, ...selectedUids]));

  const payload = {
    roomId,
    type: "group",
    name: groupName.trim(),
    members,
    admins: [callerUid], // Người tạo auto là Admin
    createdBy: callerUid,
    createdAt: Date.now(),
    lastMessage: "",
    lastMessageAt: null,
    lastSenderId: "",
  };

  const updates: Record<string, any> = {
    [`rooms/${roomId}`]: payload,
  };

  members.forEach((uid) => {
    updates[`userRooms/${uid}/${roomId}`] = true;
  });

  await db.ref().update(updates);
  return { success: true, roomId };
});

// ==================== 2. THÊM THÀNH VIÊN ====================
export const addMembersToGroup = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Yêu cầu đăng nhập.");

  const { roomId, newMemberUids } = request.data;
  const callerUid = request.auth.uid;

  if (!roomId || !newMemberUids || !Array.isArray(newMemberUids) || newMemberUids.length === 0) {
    throw new HttpsError("invalid-argument", "Dữ liệu không hợp lệ.");
  }

  const db = admin.database();
  const roomSnap = await db.ref(`rooms/${roomId}`).get();
  
  if (!roomSnap.exists()) throw new HttpsError("not-found", "Không tìm thấy nhóm.");
  const room = roomSnap.val();
  if (room.type !== "group") throw new HttpsError("failed-precondition", "Chỉ áp dụng cho nhóm chat.");
  if (!room.members.includes(callerUid)) throw new HttpsError("permission-denied", "Bạn không có quyền.");

  const currentMembers = room.members || [];
  const membersToAdd = newMemberUids.filter(uid => !currentMembers.includes(uid));

  if (membersToAdd.length === 0) {
    throw new HttpsError("already-exists", "Tất cả đã ở trong nhóm.");
  }

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/members`] = [...currentMembers, ...membersToAdd];

//   membersToAdd.forEach(uid => {
//     updates[`userRooms/${uid}/${roomId}`] = { unreadCount: 0 };
//   });

  const callerSnap = await db.ref(`users/${callerUid}`).get();
  const callerName = callerSnap.val()?.displayName || "Một thành viên";
  const addedSnaps = await Promise.all(membersToAdd.map(uid => db.ref(`users/${uid}`).get()));
  const nameList = addedSnaps.map(snap => snap.val()?.displayName || "Người dùng").join(", ");
  const finalMembers = [...currentMembers, ...membersToAdd]; // Danh sách sau khi thêm
  // Bơm tin nhắn hệ thống vào chuỗi updates
  appendSystemMessage(roomId, `${callerName} đã thêm ${nameList} vào nhóm`, finalMembers, callerUid, updates);

  await db.ref().update(updates);
  return { success: true };
});

// ==================== 3. XÓA THÀNH VIÊN ====================
export const removeMemberFromGroup = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Yêu cầu đăng nhập.");

  const { roomId, memberUidToRemove } = request.data;
  const callerUid = request.auth.uid;

  if (!roomId || !memberUidToRemove) throw new HttpsError("invalid-argument", "Thiếu dữ liệu.");
  if (callerUid === memberUidToRemove) throw new HttpsError("invalid-argument", "Không tự xóa chính mình.");

  const db = admin.database();
  const roomSnap = await db.ref(`rooms/${roomId}`).get();
  
  if (!roomSnap.exists()) throw new HttpsError("not-found", "Không tìm thấy nhóm.");
  const room = roomSnap.val();
  
  // KIỂM TRA ADMIN
  if (!room.admins || !room.admins.includes(callerUid)) {
    throw new HttpsError("permission-denied", "Chỉ Admin mới có quyền xóa thành viên.");
  }

  const currentMembers = room.members || [];
  if (!currentMembers.includes(memberUidToRemove)) throw new HttpsError("not-found", "Người này không còn trong nhóm.");

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/members`] = currentMembers.filter((uid: string) => uid !== memberUidToRemove);
  updates[`userRooms/${memberUidToRemove}/${roomId}`] = null;

  const callerSnap = await db.ref(`users/${callerUid}`).get();
  const callerName = callerSnap.val()?.displayName || "Admin";
  const removedSnap = await db.ref(`users/${memberUidToRemove}`).get();
  const removedName = removedSnap.val()?.displayName || "Một thành viên";

  // Bơm tin nhắn hệ thống vào chuỗi updates
  const remainingMembers = currentMembers.filter((uid: string) => uid !== memberUidToRemove); // Danh sách sau khi xóa
  
  // Bơm tin nhắn hệ thống vào chuỗi updates
  appendSystemMessage(roomId, `${callerName} đã xóa ${removedName} khỏi nhóm.`, remainingMembers, callerUid, updates);

  await db.ref().update(updates);
  return { success: true };
});

// ==================== 4. RỜI NHÓM ====================
export const leaveGroup = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Yêu cầu đăng nhập.");

  const { roomId } = request.data;
  const callerUid = request.auth.uid;

  if (!roomId) throw new HttpsError("invalid-argument", "Thiếu mã phòng.");

  const db = admin.database();
  const roomSnap = await db.ref(`rooms/${roomId}`).get();
  
  if (!roomSnap.exists()) throw new HttpsError("not-found", "Không tìm thấy nhóm.");
  const room = roomSnap.val();
  if (!room.members.includes(callerUid)) throw new HttpsError("failed-precondition", "Bạn không ở trong nhóm này.");

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/members`] = room.members.filter((uid: string) => uid !== callerUid);
  updates[`userRooms/${callerUid}/${roomId}`] = null;

  const callerSnap = await db.ref(`users/${callerUid}`).get();
  const callerName = callerSnap.val()?.displayName || "Một thành viên";

  const remainingMembers = room.members.filter((uid: string) => uid !== callerUid); // Danh sách sau khi người này rời đi
  
  // Bơm tin nhắn hệ thống vào chuỗi updates
  appendSystemMessage(roomId, `${callerName} đã rời khỏi nhóm.`, remainingMembers, callerUid, updates);

  await db.ref().update(updates);
  return { success: true };
});
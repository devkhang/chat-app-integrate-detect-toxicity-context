import { ref, get, update, push, onValue,set,remove,onDisconnect,increment } from "firebase/database";
import { rtdb } from "../firebase";
import type { Room, Message, ChatListItem } from "../types";
import { snapshotToArray, makeDirectRoomId, formatRoomTime } from "@/functions/src/shared/utils";
import { getUser } from "./UserService";
import { Alert } from "react-native";

export async function ensureDirectRoom(myUid: string, otherUid: string) {
  const roomId = makeDirectRoomId(myUid, otherUid);
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);

  if (!roomSnap.exists()) {
    const payload: Room = {
      roomId,
      type: "direct",
      name: "",
      members: [myUid, otherUid],
      admins: [],
      createdBy: myUid,
      createdAt: Date.now(),
      lastMessage: "",
      lastMessageAt: null,
      lastSenderId: "",
    };

    await update(ref(rtdb), {
      [`rooms/${roomId}`]: payload,
      [`userRooms/${myUid}/${roomId}`]: true,
      [`userRooms/${otherUid}/${roomId}`]: true,
    });
  }

  return roomId;
}

export async function createGroupRoom(
  myUid: string,
  groupName: string,
  selectedUids: string[],
) {
  const roomRef = push(ref(rtdb, "rooms"));
  const roomId = roomRef.key as string;
  const members = Array.from(new Set([myUid, ...selectedUids]));

  const payload: Room = {
    roomId,
    type: "group",
    name: groupName.trim(),
    members,
    admins: [myUid],
    createdBy: myUid,
    createdAt: Date.now(),
    lastMessage: "",
    lastMessageAt: null,
    lastSenderId: "",
  };

  const updates: Record<string, unknown> = {
    [`rooms/${roomId}`]: payload,
  };

  members.forEach((uid) => {
    updates[`userRooms/${uid}/${roomId}`] = true;
  });

  await update(ref(rtdb), updates);
  return roomId;
}

export async function ensureAIRoom(myUid: string): Promise<string> {
  const roomId = `ai-${myUid}`;   // ← unique per user

  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);

  if (!roomSnap.exists()) {
    const payload: Room = {
      roomId,
      type: 'ai',                    // ← loại room mới
      name: 'Chat với Gemini AI',
      members: [myUid],              // chỉ có mình user
      admins: [],
      createdBy: myUid,
      createdAt: Date.now(),
      lastMessage: '',
      lastMessageAt: null,
      lastSenderId: '',
    };

    await update(ref(rtdb), {
      [`rooms/${roomId}`]: payload,
      [`userRooms/${myUid}/${roomId}`]: { unreadCount: 0,},  // khởi tạo userRoom
    });
  }

  return roomId;
}


export function subscribeUserChatList(
  myUid: string,
  callback: (items: ChatListItem[]) => void,
) {
  return onValue(ref(rtdb, `userRooms/${myUid}`), async (snapshot) => {
    const roomMap = snapshot.val() as Record<string, any> | null;
    const roomIds = roomMap ? Object.keys(roomMap) : [];

    if (roomIds.length === 0) {
      callback([]);
      return;
    }

    const roomSnaps = await Promise.all(
      roomIds.map((roomId) => get(ref(rtdb, `rooms/${roomId}`))),
    );

    const rooms = roomSnaps
      .filter((snap) => snap.exists())
      .map((snap) => snap.val() as Room)
      // ==================== THÊM DÒNG FILTER NÀY ====================
      .filter((room) => room.type !== 'ai')   // ← ẨN HOÀN TOÀN room AI
      // ============================================================
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

    const mapped = await Promise.all(
      rooms.map(async (room) => {
        const userRoomData = roomMap?.[room.roomId] || {};
        const unreadCount = userRoomData.unreadCount || 0;

        let name = room.name || "Nhóm không tên";
        if (room.type === "direct") {
          const otherUid = room.members.find((uid) => uid !== myUid) || "";
          const otherUser = otherUid ? await getUser(otherUid) : null;
          name = otherUser?.displayName || otherUser?.email || "Người dùng";
        } else if (room.type === "group") {
          name = room.name || "Nhóm chat";
        }else if (room.type === "ai") {
          name = "💬 Chat với Gemini AI";     // ← tên đẹp trong Inbox
        }

        return {
          id: room.roomId,
          roomId: room.roomId,
          type: room.type,
          name,
          lastMessage: room.lastMessage || "Chưa có tin nhắn",
          time: formatRoomTime(room.lastMessageAt),
          unreadCount,
        } as ChatListItem;
      }),
    );

    callback(mapped);
  });
}

export function subscribeRoom(
  roomId: string,
  callback: (room: Room | null) => void,
) {
  return onValue(ref(rtdb, `rooms/${roomId}`), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as Room) : null);
  });
}

export function subscribeMessages(
  roomId: string,
  callback: (items: Message[]) => void,
) {
  return onValue(ref(rtdb, `roomMessages/${roomId}`), (snapshot) => {
    const messages = snapshotToArray<Message>(snapshot).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    callback(messages);
  });
}

export async function sendMessage(
  roomId: string,
  text: string,
  senderId: string,
  senderName: string,
  senderPhotoURL: string   // ← THÊM tham số này
) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const msgRef = push(ref(rtdb, `roomMessages/${roomId}`));
  const messageId = msgRef.key as string;
  const createdAt = Date.now();

  const payload: Message = {
    id: messageId,
    text: trimmed,
    senderId,
    senderName,
    senderPhotoURL,           // ← SỬ DỤNG avatar thật
    type: "text",
    createdAt,
  };

  const updates: Record<string, any> = {
    [`roomMessages/${roomId}/${messageId}`]: payload,
    [`rooms/${roomId}/lastMessage`]: trimmed,
    [`rooms/${roomId}/lastMessageAt`]: createdAt,
    [`rooms/${roomId}/lastSenderId`]: senderId,
  };

  // === SỬA LỖI QUAN TRỌNG: Cập nhật cho TẤT CẢ thành viên (bao gồm người gửi) ===
  const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
  const roomData = roomSnap.val() as Room | null;

  if (roomData?.members?.length) {
    roomData.members.forEach((uid: string) => {
      // Tăng unread cho người khác
      if (uid !== senderId) {
        updates[`userRooms/${uid}/${roomId}/unreadCount`] = increment(1);
      }

      // Luôn cập nhật lastMessageAt cho mọi người → trigger inbox realtime
      updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
    });
  }

  await update(ref(rtdb), updates);
}

export async function sendImageMessage(
  roomId: string,
  uri: string,
  senderId: string,
  senderName: string,
  senderPhotoURL: string   // ← THÊM tham số này
) {
  // 1. Chuyển ảnh thành Base64
  const response = await fetch(uri);
  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // 2. Tạo message
  const msgRef = push(ref(rtdb, `roomMessages/${roomId}`));
  const messageId = msgRef.key as string;
  const createdAt = Date.now();

  const payload: Message = {
    id: messageId,
    imageBase64: base64,
    imageType: 'image/jpeg',
    senderId,
    senderName,
    senderPhotoURL,           // ← SỬ DỤNG avatar thật
    type: 'image',
    createdAt,
  };

  const updates: Record<string, any> = {
    [`roomMessages/${roomId}/${messageId}`]: payload,
    [`rooms/${roomId}/lastMessage`]: '📸 Hình ảnh',
    [`rooms/${roomId}/lastMessageAt`]: createdAt,
    [`rooms/${roomId}/lastSenderId`]: senderId,
  };

  // Cập nhật unread cho mọi người
  const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
  const roomData = roomSnap.val() as Room | null;
  if (roomData?.members?.length) {
    roomData.members.forEach((uid: string) => {
      if (uid !== senderId) {
        updates[`userRooms/${uid}/${roomId}/unreadCount`] =
          (updates[`userRooms/${uid}/${roomId}/unreadCount`] || 0) + 1;
      }
      updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
    });
  }

  await update(ref(rtdb), updates);
}

export async function markAsRead(myUid: string, roomId: string) {
  await update(ref(rtdb), {
    [`userRooms/${myUid}/${roomId}/unreadCount`]: 0,
  });
}

export async function saveMissedCall(
  roomId: string,
  fromUid: string,
  fromName: string,
  toUid: string
) {
  try {
    const messageRef = ref(rtdb, `roomMessages/${roomId}`);
    const newMsgRef = push(messageRef);

    await set(newMsgRef, {
      id: newMsgRef.key,
      senderId: fromUid,
      senderName: fromName,
      type: "missed_call",                    // loại đặc biệt
      text: `Cuộc gọi video nhỡ`,
      timestamp: Date.now(),
      isMissedCall: true,
      missedBy: toUid,                        // người bị nhỡ
    });

    console.log("✅ Đã lưu cuộc gọi nhỡ vào phòng chat");
  } catch (error) {
    console.error("❌ Lỗi lưu missed call:", error);
  }
}

// ==================== TYPING INDICATOR ====================
// Phần hiển thị "đang gõ..." - được đặt trong ChatService vì liên quan trực tiếp đến phòng chat

/**
 * Bật/Tắt trạng thái đang gõ của user trong room
 * @param roomId - ID của phòng chat
 * @param uid - UID của người đang gõ
 * @param isTyping - true = đang gõ, false = ngừng gõ
 */
export async function setTyping(
  roomId: string,
  uid: string,
  isTyping: boolean,
  displayName: string = "Người dùng"
): Promise<void> {
  if (!roomId || !uid) return;

  const typingRef = ref(rtdb, `rooms/${roomId}/typing/${uid}`);

  if (isTyping) {
    // Lưu timestamp để dễ quản lý và tự động xóa cũ
    await set(typingRef, { timestamp: Date.now(), displayName });
  } else {
    await remove(typingRef);
  }
}

/**
 * Lắng nghe danh sách người đang gõ trong phòng chat (realtime)
 * @param roomId - ID của phòng chat
 * @param callback - Hàm nhận dữ liệu { uid1: timestamp, uid2: timestamp, ... }
 */
export function subscribeTyping(
  roomId: string,
  callback: (typingUsers: Record<string, { timestamp: number; displayName: string }>) => void
) {
  const typingRef = ref(rtdb, `rooms/${roomId}/typing`);

  return onValue(typingRef, (snapshot) => {
    const data = snapshot.val() as Record<string, { timestamp: number; displayName: string }> | null;
    callback(data || {});
  });
}

/**
 * Tự động xóa trạng thái typing khi user rời khỏi room (onDisconnect)
 * @param roomId - ID của phòng chat
 * @param uid - UID của user
 */
export function removeTypingOnDisconnect(roomId: string, uid: string): void {
  const typingRef = ref(rtdb, `rooms/${roomId}/typing/${uid}`);
  onDisconnect(typingRef).remove();
}

export async function sendVoiceMessage(
  roomId: string,
  voiceBase64: string,
  duration: number,
  senderId: string,
  senderName: string,
  senderPhotoURL: string
) {
  const msgRef = push(ref(rtdb, `roomMessages/${roomId}`));
  const messageId = msgRef.key as string;
  const createdAt = Date.now();

  const payload: Message = {
    id: messageId,
    type: "voice",
    voiceBase64,
    voiceDuration: Math.round(duration),
    voiceMimeType: "audio/m4a",
    senderId,
    senderName,
    senderPhotoURL,
    createdAt,
  };

  const updates: Record<string, any> = {
    [`roomMessages/${roomId}/${messageId}`]: payload,
    [`rooms/${roomId}/lastMessage`]: "🎤 Tin nhắn thoại",
    [`rooms/${roomId}/lastMessageAt`]: createdAt,
    [`rooms/${roomId}/lastSenderId`]: senderId,
  };

  const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
  const roomData = roomSnap.val() as Room | null;

  if (roomData?.members?.length) {
    roomData.members.forEach((uid: string) => {
      if (uid !== senderId) {
        updates[`userRooms/${uid}/${roomId}/unreadCount`] =
          (updates[`userRooms/${uid}/${roomId}/unreadCount`] || 0) + 1;
      }
      updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
    });
  }

  await update(ref(rtdb), updates);
}

// ==================== GỬI THÔNG BÁO HỆ THỐNG VÀO CHAT ====================
export async function sendSystemMessage(
  roomId: string,
  text: string,
  senderName: string = "Hệ thống"
) {
  const msgRef = push(ref(rtdb, `roomMessages/${roomId}`));
  const messageId = msgRef.key as string;
  const createdAt = Date.now();

  const payload: Message = {
    id: messageId,
    type: "system",
    text,
    senderName,
    senderId: "system",
    createdAt,
  };

  const updates: Record<string, any> = {
    [`roomMessages/${roomId}/${messageId}`]: payload,
    [`rooms/${roomId}/lastMessage`]: text,
    [`rooms/${roomId}/lastMessageAt`]: createdAt,
    [`rooms/${roomId}/lastSenderId`]: "system",
  };

  await update(ref(rtdb), updates);
}

// ==================== THÊM THÀNH VIÊN (có thông báo) ====================
export async function addMembersToGroup(
  roomId: string,
  newMemberUids: string[],
  myUid: string
) {
  if (!newMemberUids.length) return;

  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);
  if (!roomSnap.exists()) {
    Alert.alert("Lỗi", "Không tìm thấy nhóm chat");
    return;
  }

  const room = roomSnap.val() as Room;
  if (room.type !== "group") {
    Alert.alert("Lỗi", "Chỉ có thể thêm thành viên vào nhóm chat");
    return;
  }

  const currentMembers = room.members || [];
  const membersToAdd = newMemberUids.filter(uid => !currentMembers.includes(uid));

  if (!membersToAdd.length) {
    Alert.alert("Thông báo", "Tất cả người đã là thành viên nhóm");
    return;
  }

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/members`] = [...currentMembers, ...membersToAdd];

  membersToAdd.forEach(uid => {
    updates[`userRooms/${uid}/${roomId}`] = { unreadCount: 0 };
  });

  await update(ref(rtdb), updates);

  // Gửi thông báo hệ thống
  const myUser = await getUser(myUid);
  const names = await Promise.all(membersToAdd.map(uid => getUser(uid)));
  const nameList = names.map(u => u?.displayName || "Người dùng").join(", ");

  await sendSystemMessage(
    roomId,
    `${myUser?.displayName || "Admin"} đã thêm ${nameList} vào nhóm`,
    "Hệ thống"
  );

  Alert.alert("Thành công", `Đã thêm ${membersToAdd.length} thành viên`);
}

// ==================== XÓA THÀNH VIÊN (có thông báo) ====================
export async function removeMemberFromGroup(
  roomId: string,
  memberUidToRemove: string,
  myUid: string
) {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);
  if (!roomSnap.exists()) {
    Alert.alert("Lỗi", "Không tìm thấy nhóm chat");
    return;
  }

  const room = roomSnap.val() as Room;
  if (room.type !== "group") {
    Alert.alert("Lỗi", "Chỉ áp dụng cho nhóm chat");
    return;
  }

  if (!room.admins.includes(myUid)) {
    Alert.alert("Lỗi", "Chỉ Admin mới được xóa thành viên");
    return;
  }

  if (memberUidToRemove === myUid) {
    Alert.alert("Lỗi", "Bạn không thể tự xóa chính mình");
    return;
  }

  const currentMembers = room.members || [];
  if (!currentMembers.includes(memberUidToRemove)) {
    Alert.alert("Thông báo", "Người này không còn trong nhóm");
    return;
  }

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/members`] = currentMembers.filter(
    (uid: string) => uid !== memberUidToRemove
  );
  updates[`userRooms/${memberUidToRemove}/${roomId}`] = null;

  await update(ref(rtdb), updates);

  const remover = await getUser(myUid);
  const removedUser = await getUser(memberUidToRemove);

  await sendSystemMessage(
    roomId,
    `${remover?.displayName || "Admin"} đã xóa ${removedUser?.displayName || "một thành viên"} khỏi nhóm`,
    "Hệ thống"
  );

  Alert.alert("Thành công", "Đã xóa thành viên khỏi nhóm");
}

// ==================== RỜI NHÓM (có thông báo) ====================
export async function leaveGroup(roomId: string, myUid: string) {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);
  if (!roomSnap.exists()) {
    Alert.alert("Lỗi", "Không tìm thấy nhóm");
    return;
  }

  const room = roomSnap.val() as Room;
  if (room.type !== "group") {
    Alert.alert("Lỗi", "Chỉ áp dụng cho nhóm chat");
    return;
  }

  if (!room.members.includes(myUid)) {
    Alert.alert("Lỗi", "Bạn không phải thành viên của nhóm");
    return;
  }

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/members`] = room.members.filter(
    (uid: string) => uid !== myUid
  );
  updates[`userRooms/${myUid}/${roomId}`] = null;

  await update(ref(rtdb), updates);

  const myUser = await getUser(myUid);
  await sendSystemMessage(
    roomId,
    `${myUser?.displayName || "Một thành viên"} đã rời khỏi nhóm`,
    "Hệ thống"
  );

  Alert.alert("Thành công", "Bạn đã rời khỏi nhóm");
}
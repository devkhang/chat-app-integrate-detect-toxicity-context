import {
  DataSnapshot,
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  set,
  update,
} from "firebase/database";
import { auth, rtdb } from "../firebase";
import type {
  AppUser,
  ChatListItem,
  FriendRequest,
  Friendship,
  Message,
  RequestItem,
  Room,
} from "../types";
import { DEFAULT_AVATAR_BASE64 } from "./../app/constants";
import { Alert } from 'react-native';

export const makeDirectRoomId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

export const makeFriendshipId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

const snapshotToArray = <T>(snapshot: DataSnapshot): T[] => {
  const value = snapshot.val();
  if (!value) return [];
  return Object.values(value) as T[];
};

export function formatRoomTime(timestamp?: number | null) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("vi-VN");
}

export async function createUserProfile(uid: string, email: string | null) {
  const user: AppUser = {
    uid,
    email: email || "",
    displayName: email?.split("@")[0] || "User",
    photoURL: DEFAULT_AVATAR_BASE64,   // ← avatar mặc định Base64
    createdAt: Date.now(),
  };

  await set(ref(rtdb, `users/${uid}`), user);
}

// ==================== Hàm upload avatar (Base64) ====================
export async function uploadProfilePhotoBase64(uid: string, uri: string): Promise<string> {
  // Chuyển ảnh thành Base64
  const response = await fetch(uri);
  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Cập nhật vào RTDB
  await update(ref(rtdb, `users/${uid}`), { photoURL: base64 });
  return base64;
}


export async function getUser(uid: string) {
  const snap = await get(ref(rtdb, `users/${uid}`));
  return snap.exists() ? (snap.val() as AppUser) : null;
}

export function subscribeUsers(
  myUid: string,
  callback: (users: AppUser[]) => void,
) {
  return onValue(ref(rtdb, "users"), (snapshot) => {
    const users = snapshotToArray<AppUser>(snapshot).filter(
      (user) => user.uid !== myUid,
    );
    callback(users);
  });
}

export function subscribeAcceptedFriendships(
  myUid: string,
  callback: (items: Friendship[]) => void,
) {
  return onValue(ref(rtdb, "friendships"), (snapshot) => {
    const items = snapshotToArray<Friendship>(snapshot).filter((item) => 
    (item.status === "accepted" || !item.status) && // chấp nhận cả trường hợp không có status
    (item.userIds || []).includes(myUid)
  );
    callback(items);
  });
}

export function subscribeRelatedPendingFriendRequests(
  myUid: string,
  callback: (items: FriendRequest[]) => void,
) {
  return onValue(ref(rtdb, "friendRequests"), (snapshot) => {
    const items = snapshotToArray<FriendRequest>(snapshot).filter(
      (item) =>
        item.status === "pending" &&
        (item.fromUid === myUid || item.toUid === myUid),
    );
    callback(items);
  });
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  // === KIỂM TRA ĐÃ KẾT BẠN CHƯA ===
  const friendshipId = makeFriendshipId(fromUid, toUid);
  const friendshipSnap = await get(ref(rtdb, `friendships/${friendshipId}`));

  if (friendshipSnap.exists()) {
    Alert.alert('Thông báo', 'Hai bạn đã là bạn bè rồi!');
    return;
  }

  // === KIỂM TRA ĐÃ GỬI LỜI MỜI CHƯA ===
  const pendingSnap = await get(ref(rtdb, "friendRequests"));
  const requests = snapshotToArray<FriendRequest>(pendingSnap);

  const alreadySentByMe = requests.some(
    (req) => req.status === "pending" &&
            req.fromUid === fromUid && req.toUid === toUid
  );

  const alreadySentToMe = requests.some(
    (req) => req.status === "pending" &&
            req.fromUid === toUid && req.toUid === fromUid
  );

  if (alreadySentByMe) {
    Alert.alert('Thông báo', 'Bạn đã gửi lời mời kết bạn rồi!');
    return;
  }

  if (alreadySentToMe) {
    Alert.alert(
      'Thông báo',
      'Người này đã gửi lời mời cho bạn.\nHãy vào màn Lời mời để chấp nhận.'
    );
    return;
  }
  // Gửi lời mời mới
  const requestRef = push(ref(rtdb, "friendRequests"));
  const requestId = requestRef.key as string;

  const payload: FriendRequest = {
    id: requestId,
    fromUid,
    toUid,
    status: "pending",
    createdAt: Date.now(),
  };

  await set(requestRef, payload);
}

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

export function subscribeIncomingPendingRequests(
  myUid: string,
  callback: (items: RequestItem[]) => void,
) {
  const requestQuery = query(
    ref(rtdb, "friendRequests"),
    orderByChild("toUid"),
  );

  return onValue(requestQuery, async (snapshot) => {
    const requests = snapshotToArray<FriendRequest>(snapshot).filter(
      (item) => item.toUid === myUid && item.status === "pending",
    );

    const mapped = await Promise.all(
      requests.map(async (req) => ({
        id: req.id,
        fromUid: req.fromUid,
        fromUser: await getUser(req.fromUid),
      })),
    );

    callback(mapped);
  });
}

export async function acceptFriendRequestAndOpenRoom(
  requestId: string,
  fromUid: string,
  myUid: string,
) {
  const pairId = makeFriendshipId(fromUid, myUid);
  const roomId = pairId;

  const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));

  const updates: Record<string, any> = {
    [`friendRequests/${requestId}/status`]: "accepted",
    [`friendships/${pairId}`]: {
      id: pairId,
      userIds: [fromUid, myUid].sort(),   // ← đổi thành userIds
      status: "accepted",                 // ← thêm status
      createdAt: Date.now(),
    },
    [`userRooms/${fromUid}/${roomId}`]: true,
    [`userRooms/${myUid}/${roomId}`]: true,
  };

  if (!roomSnap.exists()) {
    updates[`rooms/${roomId}`] = {
      id: roomId,
      roomId,
      type: "direct",
      members: [fromUid, myUid].sort(),
      createdBy: myUid,
      createdAt: Date.now(),
      lastMessage: "",
      lastMessageAt: 0,
      lastSenderId: "",
    };
  }

  await update(ref(rtdb), updates);

  return roomId;
}

export async function rejectFriendRequest(requestId: string) {
  await update(ref(rtdb), {
    [`friendRequests/${requestId}/status`]: "rejected",
  });
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

// ==================== GỬI HÌNH ẢNH (Base64) ====================
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

// ==================== CẬP NHẬT AVATAR CHO TẤT CẢ TIN NHẮN CŨ ====================
export async function updateAllMyMessagesAvatar(uid: string, newPhotoURL: string) {
  // Lấy tất cả room mà user tham gia
  const userRoomsSnap = await get(ref(rtdb, `userRooms/${uid}`));
  const userRooms = userRoomsSnap.val() as Record<string, any> | null;

  if (!userRooms) return;

  const updates: Record<string, any> = {};

  // Duyệt qua từng room
  for (const roomId of Object.keys(userRooms)) {
    const messagesSnap = await get(ref(rtdb, `roomMessages/${roomId}`));
    const messages = messagesSnap.val() as Record<string, Message> | null;

    if (!messages) continue;

    // Duyệt qua từng tin nhắn, nếu là của user thì cập nhật avatar
    for (const [msgId, msg] of Object.entries(messages)) {
      if (msg.senderId === uid) {
        updates[`roomMessages/${roomId}/${msgId}/senderPhotoURL`] = newPhotoURL;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(rtdb), updates);
  }
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
        const userRoomData = roomMap[room.roomId] || {};
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
        updates[`userRooms/${uid}/${roomId}/unreadCount`] = 
          (updates[`userRooms/${uid}/${roomId}/unreadCount`] || 0) + 1;
      }

      // Luôn cập nhật lastMessageAt cho mọi người → trigger inbox realtime
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

export function listenAuthUserProfile(
  callback: (user: AppUser | null) => void,
) {
  return auth.onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser?.uid) {
      callback(null);
      return;
    }

    const user = await getUser(firebaseUser.uid);
    callback(user);
  });
}
// ==================== PUSH NOTIFICATION (thêm vào cuối file rtdb.ts) ====================
export async function savePushToken(uid: string, pushToken: string) {
  await update(ref(rtdb, `users/${uid}`), { pushToken });
}


// ==================== GỌI VIDEO - GỬI THÔNG BÁO PUSH ====================
/**
 * Gửi thông báo push khi có cuộc gọi video
 * @param toUid     - ID của người được gọi (B)
 * @param fromUid   - ID của người gọi (A)
 * @param fromName  - Tên hiển thị của người gọi (A)
 */
export async function sendVideoCallPush(
  toUid: string, 
  fromUid: string, 
  fromName: string
) {
  
  // Bước 1: Lấy thông tin người nhận (B) từ Firebase
  const userSnap = await get(ref(rtdb, `users/${toUid}`));
  const user = userSnap.val() as AppUser | null;

  // Bước 2: Kiểm tra người B có pushToken chưa
  if (!user || !user.pushToken) {
    Alert.alert('Thông báo', 'Người này chưa nhận được thông báo push');
    console.log('❌ Người nhận chưa có pushToken');
    return;
  }

  console.log(`📤 Đang gửi cuộc gọi video đến: ${user.displayName || 'Người dùng'}`);

  // Bước 3: Tạo gói dữ liệu (payload) gửi cho Expo
  const payload = {
    to: user.pushToken,                    // ← Gửi đến ai? (bắt buộc)
    
    title: "📹 Cuộc gọi video",            // Tiêu đề thông báo
    
    body: `${fromName} đang gọi video cho bạn`,  // Nội dung thông báo
    
    // Dữ liệu ẩn gửi kèm (điện thoại B sẽ nhận được)
    data: {
      type: "video_call",                  // Loại thông báo (để B biết mở màn Incoming Call)
      fromUid: fromUid,                    // ID người gọi
      fromName: fromName,                  // Tên người gọi
      roomId: makeDirectRoomId(fromUid, toUid), // ID phòng video call
    },

    sound: "default",                      // Phát âm thanh thông báo mặc định
    priority: "high",                      // Ưu tiên cao (quan trọng cho cuộc gọi)
  };

  // Bước 4: Gửi yêu cầu đến server Expo
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('✅ Gửi push thành công:', result);

  } catch (error) {
    console.error('❌ Lỗi khi gửi push notification:', error);
    Alert.alert('Lỗi', 'Không thể gửi thông báo cuộc gọi');
  }
}
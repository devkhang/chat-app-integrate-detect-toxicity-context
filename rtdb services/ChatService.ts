import { ref, get, update, push, onValue,set,remove,onDisconnect,increment } from "firebase/database";
import { rtdb } from "../firebase";
import type { Room, Message, ChatListItem } from "../types";
import { snapshotToArray, makeDirectRoomId, formatRoomTime } from "@/functions/src/shared/utils";
import { getUser } from "./UserService";
import { Alert } from "react-native";
import { DEFAULT_AVATAR_BASE64 } from "@/app/constants";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';


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
  myUid: string, // Giữ biến này cho UI cũ khỏi lỗi, dù Server không dùng tới
  groupName: string,
  selectedUids: string[],
) {
  try {
    const createGroupFunc = httpsCallable(functions, 'createGroupRoom');
    const response = await createGroupFunc({ groupName, selectedUids });
    return (response.data as any).roomId;
  } catch (error: any) {
    console.error("❌ Lỗi tạo nhóm:", error);
    Alert.alert("Lỗi", error?.message || "Không thể tạo nhóm lúc này");
    throw error;
  }
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


// export function subscribeUserChatList(
//   myUid: string,
//   callback: (items: ChatListItem[]) => void,
// ) {
//   return onValue(ref(rtdb, `userRooms/${myUid}`), async (snapshot) => {
//     const roomMap = snapshot.val() as Record<string, any> | null;
//     const roomIds = roomMap ? Object.keys(roomMap) : [];

//     if (roomIds.length === 0) {
//       callback([]);
//       return;
//     }

//     const roomSnaps = await Promise.all(
//       roomIds.map((roomId) => get(ref(rtdb, `rooms/${roomId}`))),
//     );

//     const rooms = roomSnaps
//       .filter((snap) => snap.exists())
//       .map((snap) => snap.val() as Room);

//     // ==================== BẢO VỆ MỚI: KIỂM TRA THÀNH VIÊN ====================
//     const validRooms = rooms.filter((room) => {
//       // 1. Không phải room AI
//       if (room.type === 'ai') return false;

//       // 2. Phải là thành viên của room
//       if (!room.members || !room.members.includes(myUid)) {
//         console.log(`🚫 Lọc bỏ room lạ: ${room.roomId}`);
//         return false;
//       }

//       return true;
//     });
//     // =====================================================================

//     const mapped = await Promise.all(
//       validRooms.map(async (room) => {
//         const userRoomData = roomMap?.[room.roomId] || {};
//         const unreadCount = userRoomData.unreadCount || 0;

//         let photoURL = DEFAULT_AVATAR_BASE64;
//         let name = room.name || "Nhóm không tên";

//         if (room.type === "direct") {
//           const otherUid = room.members.find((uid) => uid !== myUid) || "";
//           const otherUser = otherUid ? await getUser(otherUid) : null;
//           name = otherUser?.displayName || otherUser?.email || "Người dùng";
//           photoURL = otherUser?.photoURL || DEFAULT_AVATAR_BASE64;
//         } else if (room.type === "group") {
//           name = room.name || "Nhóm chat";
//           photoURL = room.photoURL || DEFAULT_AVATAR_BASE64;
//         }

//         return {
//           id: room.roomId,
//           roomId: room.roomId,
//           type: room.type,
//           name,
//           lastMessage: room.lastMessage || "Chưa có tin nhắn",
//           photoURL,
//           time: formatRoomTime(room.lastMessageAt),
//           unreadCount,
//         } as ChatListItem;
//       }),
//     );

//     // Sắp xếp theo thời gian mới nhất
//     mapped.sort((a, b) => (b.time && a.time ? new Date(b.time).getTime() - new Date(a.time).getTime() : 0));

//     callback(mapped);
//   });
// }

export function subscribeUserChatList(
  myUid: string,
  callback: (items: ChatListItem[]) => void,
) {
  // Lắng nghe toàn bộ sự thay đổi ở node userRooms
  return onValue(ref(rtdb, `userRooms/${myUid}`), async (snapshot) => {
    const roomMap = snapshot.val() as Record<string, any> | null;
    const roomIds = roomMap ? Object.keys(roomMap) : [];

    if (roomIds.length === 0) {
      callback([]);
      return;
    }

    // Vẫn cần fetch dữ liệu bảng rooms để chạy kiểm tra thành viên
    const roomSnaps = await Promise.all(
      roomIds.map((roomId) => get(ref(rtdb, `rooms/${roomId}`))),
    );

    const rooms = roomSnaps
      .filter((snap) => snap.exists())
      .map((snap) => snap.val() as Room);

    // ==================== BẢO VỆ MỚI: KIỂM TRA THÀNH VIÊN ====================
    const validRooms = rooms.filter((room) => {
      // 1. Không phải room AI
      if (room.type === 'ai') return false;

      // 2. Phải là thành viên của room
      if (!room.members || !room.members.includes(myUid)) {
        console.log(`🚫 Lọc bỏ room lạ: ${room.roomId}`);
        return false;
      }

      return true;
    });
    // =====================================================================

    const mapped = await Promise.all(
      validRooms.map(async (room) => {
        const userRoomData = roomMap?.[room.roomId] || {};
        
        // 👉 ĐIỂM KHÁC BIỆT 1: Lấy thông tin tin nhắn từ userRoomData (Real-time nhất)
        const lastMessage = userRoomData.lastMessage || room.lastMessage || "Chưa có tin nhắn";
        const lastMessageAt = userRoomData.lastMessageAt || room.lastMessageAt || 0;
        const unreadCount = userRoomData.unreadCount || 0;

        let photoURL = DEFAULT_AVATAR_BASE64;
        let name = room.name || "Nhóm không tên";

        // Vẫn giữ logic lấy Tên và Ảnh của bạn (Tạm thời)
        if (room.type === "direct") {
          const otherUid = room.members.find((uid) => uid !== myUid) || "";
          const otherUser = otherUid ? await getUser(otherUid) : null;
          name = otherUser?.displayName || otherUser?.email || "Người dùng";
          photoURL = otherUser?.photoURL || DEFAULT_AVATAR_BASE64;
        } else if (room.type === "group") {
          name = room.name || "Nhóm chat";
          photoURL = room.photoURL || DEFAULT_AVATAR_BASE64;
        }

        // Ép kiểu mở rộng tạm thời để truyền `lastMessageAt` ra ngoài cho việc Sort
        return {
          id: room.roomId,
          roomId: room.roomId,
          type: room.type,
          name,
          lastMessage,                   // ✅ Đã cập nhật Real-time
          photoURL,
          time: formatRoomTime(lastMessageAt),
          lastMessageAt,                 // ✅ Thêm biến này phục vụ Sort
          unreadCount,
        } as ChatListItem & { lastMessageAt: number }; 
      }),
    );

    // 👉 ĐIỂM KHÁC BIỆT 2: Sắp xếp theo Timestamp (Số học) thay vì Chuỗi
    // Đảm bảo tin nhắn mới nhất luôn nằm trên cùng 100%
    mapped.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

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

// export async function sendMessage(
//   roomId: string,
//   text: string,
//   senderId: string,
//   senderName: string,
//   senderPhotoURL: string   // ← THÊM tham số này
// ) {
//   const trimmed = text.trim();
//   if (!trimmed) return;

//   const msgRef = push(ref(rtdb, `roomMessages/${roomId}`));
//   const messageId = msgRef.key as string;
//   const createdAt = Date.now();

//   const payload: Message = {
//     id: messageId,
//     text: trimmed,
//     senderId,
//     senderName,
//     senderPhotoURL,           // ← SỬ DỤNG avatar thật
//     type: "text",
//     createdAt,
//   };

//   const updates: Record<string, any> = {
//     [`roomMessages/${roomId}/${messageId}`]: payload,
//     [`rooms/${roomId}/lastMessage`]: trimmed,
//     [`rooms/${roomId}/lastMessageAt`]: createdAt,
//     [`rooms/${roomId}/lastSenderId`]: senderId,
//   };

//   // === SỬA LỖI QUAN TRỌNG: Cập nhật cho TẤT CẢ thành viên (bao gồm người gửi) ===
//   const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
//   const roomData = roomSnap.val() as Room | null;

//   if (roomData?.members?.length) {
//     roomData.members.forEach((uid: string) => {
//       // Tăng unread cho người khác
//       if (uid !== senderId) {
//         updates[`userRooms/${uid}/${roomId}/unreadCount`] = increment(1);
//       }

//       // Luôn cập nhật lastMessageAt cho mọi người → trigger inbox realtime
//       updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
//     });
//   }

//   await update(ref(rtdb), updates);
// }

// export async function sendImageMessage(
//   roomId: string,
//   uri: string,
//   senderId: string,
//   senderName: string,
//   senderPhotoURL: string   // ← THÊM tham số này
// ) {
//   // 1. Chuyển ảnh thành Base64
//   const response = await fetch(uri);
//   const blob = await response.blob();
//   const base64 = await new Promise<string>((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = () => resolve(reader.result as string);
//     reader.onerror = reject;
//     reader.readAsDataURL(blob);
//   });

//   // 2. Tạo message
//   const msgRef = push(ref(rtdb, `roomMessages/${roomId}`));
//   const messageId = msgRef.key as string;
//   const createdAt = Date.now();

//   const payload: Message = {
//     id: messageId,
//     imageBase64: base64,
//     imageType: 'image/jpeg',
//     senderId,
//     senderName,
//     senderPhotoURL,           // ← SỬ DỤNG avatar thật
//     type: 'image',
//     createdAt,
//   };

//   const updates: Record<string, any> = {
//     [`roomMessages/${roomId}/${messageId}`]: payload,
//     [`rooms/${roomId}/lastMessage`]: '📸 Hình ảnh',
//     [`rooms/${roomId}/lastMessageAt`]: createdAt,
//     [`rooms/${roomId}/lastSenderId`]: senderId,
//   };

//   // Cập nhật unread cho mọi người
//   const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
//   const roomData = roomSnap.val() as Room | null;
//   if (roomData?.members?.length) {
//     roomData.members.forEach((uid: string) => {
//       if (uid !== senderId) {
//         updates[`userRooms/${uid}/${roomId}/unreadCount`] =
//           (updates[`userRooms/${uid}/${roomId}/unreadCount`] || 0) + 1;
//       }
//       updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
//     });
//   }

//   await update(ref(rtdb), updates);
// }

// export async function sendVoiceMessage(
//   roomId: string,
//   voiceBase64: string,
//   duration: number,
//   senderId: string,
//   senderName: string,
//   senderPhotoURL: string
// ) {
//   const msgRef = push(ref(rtdb, `roomMessages/${roomId}`));
//   const messageId = msgRef.key as string;
//   const createdAt = Date.now();

//   const payload: Message = {
//     id: messageId,
//     type: "voice",
//     voiceBase64,
//     voiceDuration: Math.round(duration),
//     voiceMimeType: "audio/m4a",
//     senderId,
//     senderName,
//     senderPhotoURL,
//     createdAt,
//   };

//   const updates: Record<string, any> = {
//     [`roomMessages/${roomId}/${messageId}`]: payload,
//     [`rooms/${roomId}/lastMessage`]: "🎤 Tin nhắn thoại",
//     [`rooms/${roomId}/lastMessageAt`]: createdAt,
//     [`rooms/${roomId}/lastSenderId`]: senderId,
//   };

//   const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
//   const roomData = roomSnap.val() as Room | null;

//   if (roomData?.members?.length) {
//     roomData.members.forEach((uid: string) => {
//       if (uid !== senderId) {
//         updates[`userRooms/${uid}/${roomId}/unreadCount`] =
//           (updates[`userRooms/${uid}/${roomId}/unreadCount`] || 0) + 1;
//       }
//       updates[`userRooms/${uid}/${roomId}/lastMessageAt`] = createdAt;
//     });
//   }

//   await update(ref(rtdb), updates);
// }

export async function sendChatMessage(
  roomId: string,
  type: 'text' | 'image' | 'voice',
  content: string,  // Text hoặc Base64
  duration?: number // Chỉ dùng cho Voice
) {
  try {
    const sendMsgFunc = httpsCallable(functions, 'sendChatMessage');
    
    // Chỉ gửi những dữ liệu cần thiết, Server sẽ tự biết bạn là ai
    const response = await sendMsgFunc({
      roomId,
      type,
      content,
      duration
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Lỗi gửi tin nhắn (${type}):`, error);
    throw error;
  }
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
  toUid?: string // Có thể có hoặc không (dùng cho gọi nhóm)
) {
  try {
    // Gọi hàm Cloud Function tên là 'saveMissedCall'
    const saveMissedCallFunc = httpsCallable(functions, 'saveMissedCall');
    
    // Gửi data lên Server xử lý (Dù không dùng fromName để hiển thị nữa, bạn vẫn nên truyền lên log hoặc sau này dùng)
    await saveMissedCallFunc({ 
      roomId, 
      fromUid, 
      fromName, 
      toUid 
    });

    console.log(`✅ Đã gửi yêu cầu lưu missed call lên Server cho room ${roomId}`);
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
  myUid: string // Giữ cho UI cũ khỏi lỗi
) {
  if (!newMemberUids.length) return;
  try {
    const addMembersFunc = httpsCallable(functions, 'addMembersToGroup');
    await addMembersFunc({ roomId, newMemberUids });
    Alert.alert("Thành công", `Đã thêm ${newMemberUids.length} thành viên`);
  } catch (error: any) {
    console.error("❌ Lỗi thêm thành viên:", error);
    Alert.alert("Lỗi", error?.message || "Không thể thêm thành viên");
  }
}
// ==================== XÓA THÀNH VIÊN (có thông báo) ====================
export async function removeMemberFromGroup(
  roomId: string,
  memberUidToRemove: string,
  myUid: string // Giữ cho UI cũ khỏi lỗi
) {
  try {
    const removeMemberFunc = httpsCallable(functions, 'removeMemberFromGroup');
    await removeMemberFunc({ roomId, memberUidToRemove });
    Alert.alert("Thành công", "Đã xóa thành viên khỏi nhóm");
  } catch (error: any) {
    console.error("❌ Lỗi xóa thành viên:", error);
    Alert.alert("Lỗi", error?.message || "Không thể xóa thành viên lúc này");
  }
}

// ==================== RỜI NHÓM (có thông báo) ====================
export async function leaveGroup(roomId: string, myUid: string) {
  try {
    const leaveGroupFunc = httpsCallable(functions, 'leaveGroup');
    await leaveGroupFunc({ roomId });
    Alert.alert("Thành công", "Bạn đã rời khỏi nhóm");
  } catch (error: any) {
    console.error("❌ Lỗi rời nhóm:", error);
    Alert.alert("Lỗi", error?.message || "Không thể rời nhóm");
  }
}


// ==================== ĐỔI TÊN NHÓM CHAT (BẤT KỲ THÀNH VIÊN NÀO CŨNG ĐƯỢC) ====================
export async function updateGroupName(
  roomId: string,
  newName: string,
  myUid: string
) {
  if (!newName || newName.trim() === '') {
    Alert.alert('Lỗi', 'Tên nhóm không được để trống');
    return;
  }

  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);

  if (!roomSnap.exists()) {
    Alert.alert('Lỗi', 'Không tìm thấy nhóm');
    return;
  }

  const room = roomSnap.val() as Room;

  if (room.type !== 'group') {
    Alert.alert('Lỗi', 'Chỉ áp dụng cho nhóm chat');
    return;
  }

  // KIỂM TRA CHỈ CẦN LÀ THÀNH VIÊN CỦA NHÓM (KHÔNG CẦN LÀ ADMIN)
  if (!room.members.includes(myUid)) {
    Alert.alert('Lỗi', 'Bạn không phải thành viên của nhóm');
    return;
  }

  await update(ref(rtdb), {
    [`rooms/${roomId}/name`]: newName.trim(),
    [`userRooms/${myUid}/${roomId}/lastUpdate`]: Date.now(),
  });

  Alert.alert('Thành công', 'Đã đổi tên nhóm');
}

// ==================== CHỈNH SỬA ẢNH NHÓM ====================
export async function updateGroupPhoto(
  roomId: string,
  photoBase64: string,
  myUid: string
) {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);

  if (!roomSnap.exists()) {
    Alert.alert('Lỗi', 'Không tìm thấy nhóm');
    return;
  }

  const room = roomSnap.val() as Room;

  if (room.type !== 'group') {
    Alert.alert('Lỗi', 'Chỉ áp dụng cho nhóm chat');
    return;
  }

  // Bất kỳ thành viên nào cũng được đổi ảnh nhóm
  if (!room.members.includes(myUid)) {
    Alert.alert('Lỗi', 'Bạn không phải thành viên của nhóm');
    return;
  }

  await update(ref(rtdb), {
    [`rooms/${roomId}/photoURL`]: photoBase64,
  });

  Alert.alert('Thành công', 'Đã cập nhật ảnh nhóm');
}
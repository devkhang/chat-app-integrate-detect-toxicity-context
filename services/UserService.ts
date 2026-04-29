import { ref, get, set, update, onValue } from "firebase/database";
import { auth, rtdb } from "../firebase";
import type { AppUser } from "../types";
import { DEFAULT_AVATAR_BASE64 } from "./../app/constants";
import { snapshotToArray,makeFriendshipId } from "@/functions/src/shared/utils";
import type {
  Message,
} from "../types";

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
import { ref, get, update, onValue, query, orderByChild , push ,set } from "firebase/database";
import { rtdb } from "../firebase";
import type { Friendship, FriendRequest, RequestItem } from "../types";
import { snapshotToArray,makeFriendshipId } from "@/functions/src/shared/utils";
import { Alert } from 'react-native';
import { getUser } from "./UserService";

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
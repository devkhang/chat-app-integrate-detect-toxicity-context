import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { auth } from '../firebase';
import {
  createGroupRoom,
  ensureDirectRoom,
} from '../services/ChatService';
import { subscribeUsers} from '../services/UserService';
import { subscribeAcceptedFriendships, subscribeRelatedPendingFriendRequests, sendFriendRequest } from '../services/FriendService';
import type { AppUser, FriendRequest, Friendship } from '../types';
import { useEffect } from 'react';
export function useContactsScreen() {
  const myUid = auth.currentUser?.uid || '';

  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!myUid) return;

    const unsubUsers = subscribeUsers(myUid, setAllUsers);
    const unsubFriendships = subscribeAcceptedFriendships(myUid, setFriendships);
    const unsubRequests = subscribeRelatedPendingFriendRequests(myUid, setFriendRequests);

    return () => {
      unsubUsers();
      unsubFriendships();
      unsubRequests();
    };
  }, [myUid]);

  const friendUidSet = useMemo(() => {
    const ids = friendships
      .map((f) => f.userIds.find((uid) => uid !== myUid))
      .filter(Boolean) as string[];

    return new Set(ids);
  }, [friendships, myUid]);

  const sentRequestUidSet = useMemo(() => {
    return new Set(
      friendRequests.filter((req) => req.fromUid === myUid).map((req) => req.toUid)
    );
  }, [friendRequests, myUid]);

  const receivedRequestUidSet = useMemo(() => {
    return new Set(
      friendRequests.filter((req) => req.toUid === myUid).map((req) => req.fromUid)
    );
  }, [friendRequests, myUid]);

  const friends = useMemo(
    () => allUsers.filter((user) => friendUidSet.has(user.uid)),
    [allUsers, friendUidSet]
  );

  const otherUsers = useMemo(
    () => allUsers.filter((user) => !friendUidSet.has(user.uid)),
    [allUsers, friendUidSet]
  );

  const openDirectChat = async (otherUid: string) => {
    if (!myUid) return;
    const roomId = await ensureDirectRoom(myUid, otherUid);
    router.push(`/chat/${roomId}`);
  };

  const handleSendFriendRequest = async (toUid: string) => {
    if (!myUid || toUid === myUid) return;

    if (friendUidSet.has(toUid)) {
      Alert.alert('Thông báo', 'Hai người đã là bạn bè.');
      return;
    }

    if (sentRequestUidSet.has(toUid)) {
      Alert.alert('Thông báo', 'Bạn đã gửi lời mời trước đó rồi.');
      return;
    }

    if (receivedRequestUidSet.has(toUid)) {
      Alert.alert(
        'Thông báo',
        'Người này đã gửi lời mời cho bạn. Hãy vào màn lời mời để chấp nhận.'
      );
      return;
    }

    try {
      await sendFriendRequest(myUid, toUid);
      Alert.alert('Thành công', 'Đã gửi lời mời kết bạn.');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể gửi lời mời kết bạn');
    }
  };

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const startCreateGroupMode = () => {
    setIsCreatingGroup(true);
    setSelectedUids([]);
    setGroupName('');
  };

  const cancelCreateGroupMode = () => {
    setIsCreatingGroup(false);
    setSelectedUids([]);
    setGroupName('');
  };

  const handleCreateGroup = async () => {
    if (!myUid) return;

    if (!groupName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm.');
      return;
    }

    if (selectedUids.length < 2) {
      Alert.alert('Lỗi', 'Chọn ít nhất 2 người bạn để tạo nhóm.');
      return;
    }

    try {
      const roomId = await createGroupRoom(myUid, groupName, selectedUids);
      cancelCreateGroupMode();
      router.push(`/chat/${roomId}`);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo nhóm');
    }
  };

  return {
    friends,
    otherUsers,
    isCreatingGroup,
    selectedUids,
    groupName,
    setGroupName,
    sentRequestUidSet,
    receivedRequestUidSet,
    toggleSelect,
    startCreateGroupMode,
    cancelCreateGroupMode,
    handleCreateGroup,
    openDirectChat,
    handleSendFriendRequest,
  };
}

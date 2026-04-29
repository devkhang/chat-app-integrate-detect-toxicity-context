import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { auth } from '../firebase';
import {
  acceptFriendRequestAndOpenRoom,
  rejectFriendRequest,
  subscribeIncomingPendingRequests,
} from '../services/FriendService';
import type { RequestItem } from '../types';

export function useFriendRequestsScreen() {
  const myUid = auth.currentUser?.uid || '';
  const [requests, setRequests] = useState<RequestItem[]>([]);

  useEffect(() => {
    if (!myUid) return;
    const unsubscribe = subscribeIncomingPendingRequests(myUid, setRequests);
    return unsubscribe;
  }, [myUid]);

  const handleAccept = async (requestId: string, fromUid: string) => {
    if (!myUid) return;

    try {
      await acceptFriendRequestAndOpenRoom(requestId, fromUid, myUid);
      Alert.alert('Thành công', 'Đã chấp nhận lời mời kết bạn.');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể chấp nhận lời mời');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      Alert.alert('Thông báo', 'Đã từ chối lời mời kết bạn.');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể từ chối lời mời');
    }
  };

  return {
    requests,
    handleAccept,
    handleReject,
  };
}

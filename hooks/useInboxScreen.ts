import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { auth } from '../firebase';
import { subscribeUserChatList , ensureAIRoom } from '../services/rtdb';
import type { ChatListItem } from '../types';

export function useInboxScreen() {
  const myUid = auth.currentUser?.uid || '';
  const [chatList, setChatList] = useState<ChatListItem[]>([]);

  useEffect(() => {
    if (!myUid) return;

    ensureAIRoom(myUid);   // ← đảm bảo room AI luôn tồn tại
  }, [myUid]);

  useEffect(() => {
    if (!myUid) return;
    const unsubscribe = subscribeUserChatList(myUid, setChatList);
    return unsubscribe;
  }, [myUid]);

  const handleOpenChat = (item: ChatListItem) => {
    router.push(`/chat/${item.roomId}`);
  };

  return {
    chatList,
    handleOpenChat,
  };
}

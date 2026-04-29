import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { subscribeMessages, subscribeRoom, markAsRead,subscribeTyping, removeTypingOnDisconnect } from '../services/ChatService';
import type { Message, Room } from '../types';
import { getUser } from '@/services/UserService';

export function useChatRoomScreen(roomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, { timestamp: number; displayName: string }>>({});
  const myUid = auth.currentUser?.uid || '';

  // ==================== LẤY TÊN THẬT TỪ REALTIME DATABASE ====================
  const [myName, setMyName] = useState<string>('Bạn');

  // Lấy displayName từ database
  useEffect(() => {
    if (!myUid) return;

    const loadMyName = async () => {
      const user = await getUser(myUid);
      if (user?.displayName) {
        setMyName(user.displayName);
      }
    };

    loadMyName();
  }, [myUid]);
  // === MARK AS READ khi vào room ===
  useEffect(() => {
    if (!roomId || !myUid) return;
    markAsRead(myUid, roomId);
  }, [roomId, myUid]);

  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeRoom(roomId, setRoom);
    return unsubscribe;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeMessages(roomId, setMessages);
    return unsubscribe;
  }, [roomId]);
// ==================== SUBSCRIBE TYPING (NƠI SỬ DỤNG CHÍNH) ====================
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeTyping(roomId, setTypingUsers);

    return unsubscribe;
  }, [roomId]);

  // ==================== XÓA TYPING KHI RỜI ROOM ====================
  useEffect(() => {
    if (!roomId || !myUid) return;

    removeTypingOnDisconnect(roomId, myUid);

    // Cleanup khi component unmount
    return () => {
      removeTypingOnDisconnect(roomId, myUid); // đảm bảo xóa
    };
  }, [roomId, myUid]);

  return {
    myName,
    room,
    messages,
    text,
    setText,
    myUid,
    typingUsers,
  };
}
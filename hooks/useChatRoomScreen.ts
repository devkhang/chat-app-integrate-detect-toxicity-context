import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { sendMessage, subscribeMessages, subscribeRoom, markAsRead } from '../services/rtdb';
import type { Message, Room } from '../types';

export function useChatRoomScreen(roomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');

  const myUid = auth.currentUser?.uid || '';
  const myName = auth.currentUser?.email || 'User';

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


  return {
    room,
    messages,
    text,
    setText,
    myUid,
  };
}
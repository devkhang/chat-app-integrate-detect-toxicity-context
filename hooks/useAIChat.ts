import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { sendMessage, subscribeMessages, ensureAIRoom } from '../services/ChatService';  // ← thêm ensureAIRoom
import type { Message } from '../types';
import { DEFAULT_AVATAR_BASE64 } from '@/app/constants';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const myUid = auth.currentUser?.uid || '';
  const myName = 'Bạn';

  // ==================== THAY ĐỔI Ở ĐÂY ====================
  const [roomId, setRoomId] = useState<string>('');

  useEffect(() => {
    if (!myUid) return;

    // Tạo / lấy room AI riêng
    ensureAIRoom(myUid).then((id) => {
      setRoomId(id);
    });
  }, [myUid]);

  // Chỉ subscribe khi đã có roomId
  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeMessages(roomId, setMessages);
    return unsubscribe;
  }, [roomId]);
  // =======================================================

  const handleSend = async () => {
    if (!text.trim() || !myUid || !roomId || isLoading) return;

    const userMessage = text.trim();
    setText('');
    setIsLoading(true);

    try {
      await sendMessage(roomId, userMessage, myUid, myName,DEFAULT_AVATAR_BASE64);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 65535 },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          }),
        }
      );

      const data = await response.json();
      console.log('🔍 FULL Response từ Gemini 3 Flash:', JSON.stringify(data, null, 2));
      let replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!replyText) {
        replyText = "Xin lỗi, Gemini không thể trả lời câu hỏi này do bị chặn.";
      }

      await sendMessage(roomId, replyText, 'grok-ai', 'Gemini AI', DEFAULT_AVATAR_BASE64);
    } catch (error) {
      console.error('🚨 Lỗi Gemini API:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, text, setText, handleSend, isLoading, myUid };
}
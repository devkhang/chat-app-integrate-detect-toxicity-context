import { useState, useEffect } from 'react';
import { auth, rtdb } from '../firebase'; // Thêm rtdb vào import
import { ref, push, update } from 'firebase/database'; // Import các hàm để tự đẩy tin nhắn
import { sendChatMessage, subscribeMessages, ensureAIRoom } from '../rtdb services/ChatService';
import type { Message } from '../types';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // <--- Thêm dòng này
  const myUid = auth.currentUser?.uid || '';
  const [roomId, setRoomId] = useState<string>('');

  // Tạo / lấy room AI riêng
  useEffect(() => {
    if (!myUid) return;
    ensureAIRoom(myUid).then((id) => {
      setRoomId(id);
    });
  }, [myUid]);

  // Lắng nghe tin nhắn khi đã có roomId
  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeMessages(roomId, setMessages);
    return unsubscribe;
  }, [roomId]);

  const handleSend = async () => {
    if (!text.trim() || !myUid || !roomId || isLoading) return;

    const userMessage = text.trim();
    setText(''); // Làm trống ô nhập ngay lập tức cho mượt
    setIsLoading(true);

    try {
      // 1. Gửi tin nhắn của người dùng (Nằm bên PHẢI)
      await sendChatMessage(roomId, 'text', userMessage);
      setIsTyping(true);
      // Gọi API Gemini
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
      let replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!replyText) {
        replyText = "Xin lỗi, Gemini không thể trả lời câu hỏi này do bị chặn hoặc quá tải.";
      }

      // ==================== QUAN TRỌNG: LƯU TIN NHẮN CỦA AI ====================
      // 2. Tạo object tin nhắn cho AI với senderId cứng là 'gemini-ai'
      const aiMessage = {
        senderId: 'gemini-ai', // Giúp UI tự nhận diện và đẩy sang bên TRÁI
        senderName: 'Gemini AI',
        text: replyText,
        timestamp: Date.now(),
        type: 'text',
      };

      // Đẩy thẳng tin nhắn của AI vào nhánh messages của phòng chat hiện tại
      await push(ref(rtdb, `roomMessages/${roomId}`), aiMessage);

      // Cập nhật lại thông tin phòng chat để bên ngoài danh sách chat hiện đúng tin nhắn mới nhất
      await update(ref(rtdb, `rooms/${roomId}`), {
        lastMessage: replyText,
        lastMessageTime: Date.now(),
      });
      // =========================================================================

    } catch (error) {
      console.error('🚨 Lỗi Gemini API:', error);
    } finally {
      setIsLoading(false);
      setIsTyping(false); // Tắt dấu ...
    }
  };

  return { messages, text, setText, handleSend, isLoading, myUid , isTyping}; // <--- Trả về isTyping để UI sử dụng
}
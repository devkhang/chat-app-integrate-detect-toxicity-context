import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { useInboxScreen } from '../../hooks/useInboxScreen';
import type { ChatListItem } from '../../types';
import { DEFAULT_AVATAR_BASE64 } from '../constants';
import { ref, onValue } from 'firebase/database';     // ✅ Import thư viện Firebase
import { rtdb } from '../../firebase';                // ✅ Import file cấu hình Firebase

// ======================================================================
// COMPONENT CON: Hiển thị 1 dòng Chat và TỰ ĐỘNG LẮNG NGHE ẢNH/TÊN REAL-TIME
// ======================================================================
const InboxItem = ({ item, myUid, onPress }: { item: ChatListItem, myUid: string, onPress: () => void }) => {
  // Khởi tạo state bằng dữ liệu cũ để tránh chớp trắng màn hình khi vừa load
  const [name, setName] = useState(item.name);
  const [photoURL, setPhotoURL] = useState(item.photoURL || DEFAULT_AVATAR_BASE64);

  useEffect(() => {
    let unsubUser = () => {};

    // 1. Lắng nghe Room để lấy thông tin nhóm hoặc lấy ID thành viên
    const roomRef = ref(rtdb, `rooms/${item.roomId}`);
    const unsubRoom = onValue(roomRef, (snap) => {
      const roomData = snap.val();
      if (!roomData) return;

      if (roomData.type === 'group') {
        // Nếu là Group chat -> cập nhật tên và ảnh nhóm Real-time
        setName(roomData.name || 'Nhóm chat');
        setPhotoURL(roomData.photoURL || DEFAULT_AVATAR_BASE64);
      } else if (roomData.type === 'direct') {
        // Nếu là Chat 1-1 -> Tìm ID của người kia
        const otherUid = roomData.members?.find((uid: string) => uid !== myUid);
        
        if (otherUid) {
          unsubUser(); // Xóa luồng lắng nghe user cũ (nếu có)
          
          // 2. Lắng nghe trực tiếp Profile của người kia Real-time
          const userRef = ref(rtdb, `users/${otherUid}`);
          unsubUser = onValue(userRef, (userSnap) => {
            const userData = userSnap.val();
            if (userData) {
              setName(userData.displayName || userData.email || 'Người dùng');
              setPhotoURL(userData.photoURL || DEFAULT_AVATAR_BASE64);
            }
          });
        }
      }
    });

    // 3. Dọn dẹp bộ nhớ (Cleanup) khi người dùng lướt qua để không bị tràn RAM
    return () => {
      unsubRoom();
      unsubUser();
    };
  }, [item.roomId, myUid]);

  return (
    <TouchableOpacity
      className="mx-3 mb-2 flex-row items-center rounded-2xl bg-white px-4 py-4 shadow-sm"
      onPress={onPress}
    >
      {/* Ảnh đại diện (Đã được cập nhật Real-time) */}
      <Image
        source={{ uri: photoURL }}
        className="mr-4 h-12 w-12 rounded-full"
        style={{ resizeMode: 'cover' }}
      />

      {/* Nội dung chat */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className={`text-base font-semibold text-gray-900 ${
              (item.unreadCount ?? 0) > 0 ? 'font-bold' : ''
            }`}
          >
            {/* Tên hiển thị (Đã được cập nhật Real-time) */}
            {name}
          </Text>
          <Text className="ml-3 text-xs text-gray-400">{item.time}</Text>
        </View>

        <Text
          className={`mt-1 text-sm ${
            (item.unreadCount ?? 0) > 0 ? 'font-semibold text-gray-900' : 'text-gray-500'
          }`}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>

        <Text className="mt-1 text-xs text-gray-400">
          {item.type === 'direct' ? 'Chat cá nhân' : 'Chat nhóm'}
        </Text>
      </View>

      {/* Badge tin chưa đọc */}
      {(item.unreadCount ?? 0) > 0 && (
        <View className="ml-2 h-6 w-6 items-center justify-center rounded-full bg-red-500">
          <Text className="text-xs font-bold text-white">
            {item.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ======================================================================
// COMPONENT CHÍNH: Màn hình Inbox
// ======================================================================
export default function InboxScreen() {
  const { myUid, chatList, handleOpenChat } = useInboxScreen();

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={chatList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }: { item: ChatListItem }) => (
          // Gọi Component con thay vì render trực tiếp
          <InboxItem 
            item={item} 
            myUid={myUid} 
            onPress={() => handleOpenChat(item)} 
          />
        )}
        ListEmptyComponent={
          <View className="py-10">
            <Text className="text-center text-sm text-gray-400">Chưa có đoạn chat nào</Text>
          </View>
        }
        ListFooterComponent={
          <View className="py-6">
            <Text className="text-center text-sm text-gray-400">Hết danh sách</Text>
          </View>
        }
      />
    </View>
  );
}
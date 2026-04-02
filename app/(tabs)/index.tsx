import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useInboxScreen } from '../../hooks/useInboxScreen';
import type { ChatListItem } from '../../types';

export default function InboxScreen() {
  const { chatList, handleOpenChat } = useInboxScreen();

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={chatList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }: { item: ChatListItem }) => (
          <TouchableOpacity
            className="mx-3 mb-2 flex-row items-center rounded-2xl bg-white px-4 py-4 shadow-sm"
            onPress={() => handleOpenChat(item)}
          >
            {/* Avatar */}
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Text className="text-lg font-bold text-blue-700">
                {item.name?.[0] || '?'}
              </Text>
            </View>

            {/* Nội dung chat */}
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-base font-semibold text-gray-900 ${
                    (item.unreadCount ?? 0) > 0 ? 'font-bold' : ''
                  }`}
                >
                  {item.name}
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

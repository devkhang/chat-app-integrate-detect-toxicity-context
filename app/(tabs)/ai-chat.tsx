import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAIChat } from '../../hooks/useAIChat';
import type { Message } from '../../types';

export default function AIChatScreen() {
  const { messages, text, setText, handleSend, isLoading, myUid ,isTyping } = useAIChat();
  const flatListRef = useRef<FlatList>(null); 
  const TypingIndicator = () => {
    return (
      <View className="flex-row items-center p-3 bg-gray-200 self-start rounded-2xl ml-3 mb-2">
        <View className="flex-row space-x-1">
          <View className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <View className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <View className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </View>
      </View>
    );
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <View style={styles.headerBotIcon}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>Gemini AI</Text>
        </View>

        {/* CHAT LIST */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
          contentContainerStyle={styles.list}
          // Tự động cuộn xuống cuối khi có tin nhắn
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }: { item: Message }) => {
            const isMine = item.senderId === myUid;
            const isAI = item.senderId === 'gemini-ai'; // Nhận diện ID của AI

            return (
              <View style={[styles.messageWrapper, isMine ? styles.messageWrapperMine : styles.messageWrapperOther]}>
                
                {/* Hiển thị Avatar cho AI */}
                {!isMine && isAI && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                  </View>
                )}

                <View
                  style={[
                    styles.bubble,
                    isMine ? styles.myBubble : styles.aiBubble,
                  ]}
                >
                  <Text style={[styles.messageText, isMine ? styles.myText : styles.aiText]}>
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Bắt đầu cuộc trò chuyện với Gemini AI</Text>
            </View>
          }
          ListFooterComponent={() => (
            isTyping ? <TypingIndicator /> : <View className="h-4" />
          )}
        />

        {/* INPUT AREA */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Hỏi Gemini bất cứ điều gì..."
            placeholderTextColor="#999"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isLoading || !text.trim()} 
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" style={styles.sendIcon} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#F7F7F8' 
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerBotIcon: {
    backgroundColor: '#10a37f',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  list: { 
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexGrow: 1,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  messageWrapperMine: {
    justifyContent: 'flex-end',
  },
  messageWrapperOther: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#10a37f',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: { 
    backgroundColor: '#0084ff', 
    borderBottomRightRadius: 4, 
  },
  aiBubble: { 
    backgroundColor: '#fff', 
    borderBottomLeftRadius: 4, 
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myText: { 
    color: '#fff',
  },
  aiText: { 
    color: '#333',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 12,
    color: '#888',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12, 
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    marginRight: 10,
    minHeight: 44,
    maxHeight: 120, 
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#10a37f',
    width: 44,
    height: 44,
    borderRadius: 22, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#A0D8C8', 
  },
  sendIcon: {
    marginLeft: 4, 
  },
});
import React from 'react';
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
import { useAIChat } from '../../hooks/useAIChat';
import type { Message } from '../../types';

export default function AIChatScreen() {
  const { messages, text, setText, handleSend, isLoading, myUid } = useAIChat();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ==================== ĐÃ SỬA TÊN Ở ĐÂY ==================== */}
      <Text style={styles.header}>💬 Chat với Gemini AI</Text>
      {/* ======================================================== */}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: Message }) => {
          const isMine = item.senderId === myUid;
          const isAI = item.senderId === 'grok-ai';   // giữ senderId cũ để không phá logic

          return (
            <View
              style={[
                styles.bubble,
                isMine ? styles.myBubble : isAI ? styles.aiBubble : styles.otherBubble,
              ]}
            >
              {!isMine && <Text style={styles.sender}>{item.senderName}</Text>}
              <Text style={isMine ? styles.myText : styles.otherText}>{item.text}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Hỏi Gemini bất cứ điều gì..."
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendText}>Gửi</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    fontSize: 20,
    fontWeight: '700',
    padding: 16,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  list: { padding: 16 },
  bubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#007bff' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#10a37f' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#f1f1f1' },
  myText: { color: '#fff' },
  otherText: { color: '#111' },
  sender: { fontSize: 12, color: '#666', marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: '#10a37f',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '600' },
});
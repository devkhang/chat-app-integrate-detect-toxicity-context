import { StyleSheet } from 'react-native';


export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 18, fontWeight: '700', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee', textAlign: 'left' },
  list: { padding: 16, flexGrow: 1, paddingBottom: 20 },

  messageContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, maxWidth: '85%' },
  myMessageContainer: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  otherMessageContainer: { alignSelf: 'flex-start' },
  senderAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },

  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18 },
  myBubble: { backgroundColor: '#0084ff', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#f1f1f1', borderBottomLeftRadius: 4 },
  myText: { color: '#fff', fontSize: 16 },
  otherText: { color: '#222', fontSize: 16 },

  chatImage: { width: 220, height: 220, borderRadius: 12, marginVertical: 4 },

  inputArea: { padding: 10, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  imageButton: { width: 40, height: 48, backgroundColor: '#f0f0f0', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  imageButtonText: { fontSize: 26 },
  input: { flex: 1, minHeight: 48, maxHeight: 160, borderWidth: 1, borderColor: '#ddd', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, backgroundColor: '#f9f9f9' },
  inputToxic: { borderColor: '#ef4444', borderWidth: 2, backgroundColor: '#fef2f2' },
  sendButton: { backgroundColor: '#0084ff', height: 48, paddingHorizontal: 24, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  modelLoadingText: { color: '#10a37f', fontSize: 13, marginBottom: 6, textAlign: 'center' },
  analyzingText: { color: '#10a37f', fontSize: 13, marginBottom: 6, textAlign: 'center' },
  warningRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', padding: 10, borderRadius: 8, marginBottom: 8 },
  warningIcon: { fontSize: 18, marginRight: 8 },
  warningText: { color: '#d97706', fontSize: 14, flex: 1 },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },

  videoCallButton: {
    width: 40,
    height: 40,
    backgroundColor: '#28a745',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  videoCallText: {
    fontSize: 22,
    color: '#fff',
  },
  missedCallContainer: {
    alignSelf: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 8,
    maxWidth: '80%',
  },

  missedCallText: {
    color: '#d97706',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },

  missedCallTime: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '400',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  typingText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  voiceButtonActive: {
    backgroundColor: '#fee2e2',
    transform: [{ scale: 1.1 }],
  },
    addMemberButton: {
    width: 40,
    height: 40,
    backgroundColor: '#28a745',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addMemberText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 28,
  },
    membersButton: {
    width: 40,
    height: 40,
    backgroundColor: '#007bff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  membersText: {
    fontSize: 22,
    color: '#fff',
  },
    systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 8,
    maxWidth: '80%',
  },
  systemMessageText: {
    color: '#555',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  audioCallButton: {
    width: 40,
    height: 40,
    backgroundColor: '#10a37f',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  audioCallText: {
    fontSize: 22,
    color: '#fff',
  },
  infoButton: {
  width: 36,
  height: 36,
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 10,
},

  infoIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',     // Màu tím giống ảnh
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
// Emoji 1 cái
  singleEmojiButton: {
    width: 52,
    height: 52,
    backgroundColor: '#f0f0f0',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  singleEmojiText: { fontSize: 28 },
  emojiBubble: {
  backgroundColor: '#fff',     // Màu nền nhạt hơn
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
},

  emojiText: {
    fontSize: 28,                    // To hơn
    lineHeight: 32,
  },
});
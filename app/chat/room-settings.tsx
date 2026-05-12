import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { rtdb } from '../../firebase';
import { ref, set, get } from 'firebase/database';

const ALL_EMOJIS = [
  // === EMOJI REACTION / LIKE (ưu tiên) ===
  '👍','👎','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝',
  '🔥','👏','🙌','🙏','💪','🤝','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️',
  '🖖','👋','🤙','💯','✅','❌','⭐','🌟','✨','💫','🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','🏅','🎖️',

  // Mặt cười & cảm xúc
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😙','😚',
  '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥',
  '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓',
  '🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
  '😞','😓','😩','😫','🥱','😤','😡','🤬','😈','👿','💀','☠️','👻','👽','👾','🤖','💩','😺','😸','😹',

  // Động vật
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒',
  '🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜',

  // Đồ ăn & Đồ uống
  '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦',
  '🥬','🥒','🌶️','🌽','🥕','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖',
  '🌭','🍔','🍟','🍕','🥪','🥙','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍱','🍣','🍤','🍙','🍚','🍘',

  // Hoạt động & Thể thao
  '⚽','🏀','🏈','⚾','🥎','🏐','🏉','🥏','🎾','🥍','🏏','🏑','🏒','🥅','⛳','🏹','🎣','🥊','🥋','🎽',
  '⛸️','🥌','🛷','🛹','🎿','⛷️','🏂','🏋️','🤼','🤸','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗',

  // Biểu tượng & Khác
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
  '✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐',
  '♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️',
];

export default function RoomSettingsScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [selectedEmoji, setSelectedEmoji] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Load emoji chính của phòng
  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      const snap = await get(ref(rtdb, `rooms/${roomId}/quickEmojis`));
      if (snap.exists()) {
        setSelectedEmoji(snap.val()[0] || ''); // Lấy emoji đầu tiên
      } else {
        setSelectedEmoji('👍');
      }
    };
    load();
  }, [roomId]);

  // Tự động lưu khi chọn
  useEffect(() => {
    if (!roomId || !selectedEmoji) return;
    set(ref(rtdb, `rooms/${roomId}/quickEmojis`), [selectedEmoji]);
  }, [selectedEmoji, roomId]);

  const selectEmoji = (emoji: string) => {
    setSelectedEmoji(emoji);
    setShowEmojiPicker(false); // Tự động đóng modal sau khi chọn
  };

  const filteredEmojis = ALL_EMOJIS.filter(emoji =>
    emoji.includes(searchText)
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tùy chỉnh phòng</Text>

      {/* HIỂN THỊ EMOJI HIỆN TẠI */}
      <View style={styles.currentSection}>
        <Text style={styles.label}>Emoji chính hiện tại:</Text>
        <TouchableOpacity 
          style={styles.currentEmojiBox}
          onPress={() => setShowEmojiPicker(true)}
        >
          <Text style={styles.currentEmoji}>{selectedEmoji || 'Chưa chọn'}</Text>
          <Text style={styles.changeText}>Thay đổi</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL CHỌN EMOJI */}
      <Modal visible={showEmojiPicker} animationType="slide">
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Chọn emoji chính</Text>
          <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Ô tìm kiếm */}
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm emoji..."
          placeholderTextColor="#888"
          value={searchText}
          onChangeText={setSearchText}
        />

        {/* Danh sách emoji */}
        <FlatList
          data={filteredEmojis}
          numColumns={5}
          key="emoji-grid-5"                    // ← THÊM DÒNG NÀY
          keyExtractor={(item, index) => index.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.emojiGridItem,
                selectedEmoji === item && styles.emojiGridItemSelected
              ]}
              onPress={() => selectEmoji(item)}
            >
              <Text style={styles.emojiGridText}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 30 },

  currentSection: { marginBottom: 30 },
  label: { color: '#aaa', fontSize: 14, marginBottom: 10 },
  currentEmojiBox: {
    backgroundColor: '#1f1f1f',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentEmoji: { fontSize: 48 },
  changeText: { color: '#10a37f', fontSize: 16, fontWeight: '600' },

  modalContainer: { flex: 1, backgroundColor: '#000', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeButton: { color: '#fff', fontSize: 24 },
  searchInput: {
    backgroundColor: '#1f1f1f',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  emojiGridItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    margin: 4,
    borderRadius: 12,
  },
  emojiGridItemSelected: { backgroundColor: '#10a37f' },
  emojiGridText: { fontSize: 28 },
});
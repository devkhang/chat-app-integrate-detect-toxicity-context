import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import type { AppUser } from '../../types';
import { useContactsScreen } from '../../hooks/useContactsScreen';

export default function ContactsScreen() {
  const {
    friends,
    otherUsers,
    isCreatingGroup,
    selectedUids,
    groupName,
    setGroupName,
    sentRequestUidSet,
    receivedRequestUidSet,
    toggleSelect,
    startCreateGroupMode,
    cancelCreateGroupMode,
    handleCreateGroup,
    openDirectChat,
    handleSendFriendRequest,
  } = useContactsScreen();

  const renderFriendItem = ({ item }: { item: AppUser }) => {
    const selected = selectedUids.includes(item.uid);

    return (
      <TouchableOpacity
        style={[styles.item, isCreatingGroup && selected && styles.itemSelected]}
        onPress={() => {
          if (isCreatingGroup) {
            toggleSelect(item.uid);
            return;
          }

          openDirectChat(item.uid);
        }}
      >
        <Text style={styles.name}>{item.displayName || 'Không tên'}</Text>
        <Text style={styles.email}>{item.email}</Text>

        {isCreatingGroup ? (
          <Text style={styles.selectHint}>{selected ? 'Đã chọn' : 'Bấm để chọn'}</Text>
        ) : (
          <Text style={styles.friendHint}>Bấm để chat</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderOtherUserItem = ({ item }: { item: AppUser }) => {
    const isSent = sentRequestUidSet.has(item.uid);
    const isReceived = receivedRequestUidSet.has(item.uid);

    // === KIỂM TRA ĐÃ LÀ BẠN BÈ CHƯA ===
    const isAlreadyFriend = friends.some(friend => friend.uid === item.uid);

    if (isAlreadyFriend) {
      return null; // Ẩn hoàn toàn người này khỏi phần "Người dùng khác"
    }

    return (
      <View style={styles.item}>
        <Text style={styles.name}>{item.displayName || 'Không tên'}</Text>
        <Text style={styles.email}>{item.email}</Text>

        {isSent ? (
          <Text style={styles.pendingText}>Đã gửi lời mời</Text>
        ) : isReceived ? (
          <Text style={styles.pendingText}>Đang chờ bạn chấp nhận</Text>
        ) : (
          <TouchableOpacity
            style={styles.addFriendButton}
            onPress={() => handleSendFriendRequest(item.uid)}
          >
            <Text style={styles.addFriendButtonText}>Kết bạn</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!isCreatingGroup ? (
        <TouchableOpacity style={styles.groupButton} onPress={startCreateGroupMode}>
          <Text style={styles.groupButtonText}>Tạo nhóm từ bạn bè</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.groupPanel}>
          <Text style={styles.groupTitle}>Tạo nhóm chat</Text>

          <TextInput
            style={styles.input}
            placeholder="Nhập tên nhóm"
            value={groupName}
            onChangeText={setGroupName}
          />

          <Text style={styles.selectedText}>Đã chọn: {selectedUids.length} người</Text>

          <View style={styles.groupActionRow}>
            <TouchableOpacity style={styles.confirmButton} onPress={handleCreateGroup}>
              <Text style={styles.confirmButtonText}>Xác nhận tạo nhóm</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={cancelCreateGroupMode}>
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Bạn bè</Text>
      <FlatList
        data={friends}
        keyExtractor={(item) => `friend-${item.uid}`}
        renderItem={renderFriendItem}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có bạn bè nào</Text>}
      />

      {!isCreatingGroup && (
        <>
          <Text style={styles.sectionTitle}>Người dùng khác</Text>
          <FlatList
            data={otherUsers}
            keyExtractor={(item) => `other-${item.uid}`}
            renderItem={renderOtherUserItem}
            ListEmptyComponent={<Text style={styles.empty}>Không còn người dùng nào</Text>}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  groupButton: {
    backgroundColor: '#007bff',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  groupPanel: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    height: 46,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  selectedText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  groupActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#28a745',
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderRadius: 10,
  },
  itemSelected: {
    backgroundColor: '#eef5ff',
    borderColor: '#007bff',
    borderWidth: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  email: {
    color: '#666',
    marginTop: 4,
  },
  friendHint: {
    marginTop: 8,
    color: '#28a745',
    fontSize: 13,
    fontWeight: '600',
  },
  selectHint: {
    marginTop: 8,
    color: '#007bff',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingText: {
    marginTop: 8,
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
  },
  addFriendButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addFriendButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    color: '#777',
  },
});

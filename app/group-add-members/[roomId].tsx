// app/group-add-members/[roomId].tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useContactsScreen } from '../../hooks/useContactsScreen';
import { addMembersToGroup } from '../../services/ChatService';
import { auth } from '../../firebase';
import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase';
import type { Room } from '../../types';

export default function AddGroupMembersScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const myUid = auth.currentUser?.uid;

  const [roomMembers, setRoomMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    friends,                    // ← Chỉ lấy danh sách bạn bè
    selectedUids,
    toggleSelect,
    cancelCreateGroupMode,
  } = useContactsScreen();

  // Lấy danh sách thành viên hiện tại của group
  useEffect(() => {
    const fetchRoomMembers = async () => {
      if (!roomId) return;
      try {
        const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
        if (roomSnap.exists()) {
          const room = roomSnap.val() as Room;
          setRoomMembers(room.members || []);
        }
      } catch (err) {
        console.error("Lỗi lấy thành viên:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoomMembers();
  }, [roomId]);

  // ==================== CHỈ ĐỀ XUẤT NGƯỜI ĐÃ KẾT BẠN ====================
  const availableUsers = useMemo(() => {
    return friends.filter(user => 
      !roomMembers.includes(user.uid) && user.uid !== myUid
    );
  }, [friends, roomMembers, myUid]);

  const handleAddMembers = async () => {
    if (!roomId || !myUid || selectedUids.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 1 người');
      return;
    }

    try {
      await addMembersToGroup(roomId as string, selectedUids, myUid);
      cancelCreateGroupMode();   // reset selection
      router.replace(`/chat/${roomId}`);             // đóng modal
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể thêm thành viên');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Đang tải danh sách bạn bè...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Modal */}
      <View style={styles.modalHeader}>
        <Text style={styles.title}>Thêm thành viên vào nhóm</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Bạn bè có thể thêm: {availableUsers.length} người
      </Text>

      <FlatList
        data={availableUsers}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => {
          const selected = selectedUids.includes(item.uid);
          return (
            <TouchableOpacity
              style={[styles.item, selected && styles.itemSelected]}
              onPress={() => toggleSelect(item.uid)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.displayName || 'Không tên'}</Text>
                <Text style={styles.email}>{item.email}</Text>
              </View>
              {selected && <Text style={styles.selectedMark}>✓</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Bạn chưa có bạn bè nào để thêm vào nhóm</Text>
        }
      />

      {selectedUids.length > 0 && (
        <TouchableOpacity style={styles.addButton} onPress={handleAddMembers}>
          <Text style={styles.addButtonText}>
            Thêm {selectedUids.length} người vào nhóm
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Hủy</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 10 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 20, fontWeight: '700' },
  closeButton: { fontSize: 28, fontWeight: '700', color: '#dc3545' },
  subtitle: { 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    fontSize: 16, 
    color: '#28a745',
    fontWeight: '600'
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemSelected: { backgroundColor: '#e3f2fd' },
  name: { fontSize: 16, fontWeight: '600' },
  email: { color: '#666', marginTop: 2 },
  selectedMark: { fontSize: 24, color: '#28a745', fontWeight: '700' },
  addButton: {
    backgroundColor: '#28a745',
    height: 52,
    margin: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  cancelButton: { marginHorizontal: 16, marginBottom: 30, alignItems: 'center' },
  cancelText: { color: '#dc3545', fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 100, color: '#888', fontSize: 16 },
  loadingText: { textAlign: 'center', marginTop: 100, fontSize: 16, color: '#666' },
});
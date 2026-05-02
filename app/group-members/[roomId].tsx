// app/group-members/[roomId].tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase';
import { auth } from '../../firebase';
import type { Room, AppUser } from '../../types';
import { getUser } from '../../services/UserService';
import { DEFAULT_AVATAR_BASE64 } from '../constants';
import { removeMemberFromGroup, leaveGroup } from '../../services/ChatService';

export default function GroupMembersScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const myUid = auth.currentUser?.uid;

  const [room, setRoom] = useState<Room | null>(null);
  const [membersData, setMembersData] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoomAndMembers = async () => {
    if (!roomId) return;
    try {
      const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
      if (roomSnap.exists()) {
        const roomData = roomSnap.val() as Room;
        setRoom(roomData);

        const userPromises = roomData.members.map(uid => getUser(uid));
        const users = (await Promise.all(userPromises)).filter(Boolean) as AppUser[];
        setMembersData(users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomAndMembers();
  }, [roomId]);

  // Xóa thành viên (chỉ Admin)
  const handleRemoveMember = async (memberUid: string, memberName: string) => {
    if (!room || !myUid) return;
    Alert.alert('Xác nhận xóa', `Xóa ${memberName} khỏi nhóm?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMemberFromGroup(roomId as string, memberUid, myUid);
            await fetchRoomAndMembers();
          } catch (err: any) {
            Alert.alert('Lỗi', err.message || 'Không thể xóa');
          }
        },
      },
    ]);
  };

  // RỜI NHÓM - Nút cố định ở dưới
  const handleLeaveGroup = async () => {
    if (!roomId || !myUid) return;

    Alert.alert(
      'Rời khỏi nhóm',
      'Bạn có chắc muốn rời khỏi nhóm này?\nBạn sẽ không còn thấy nhóm nữa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(roomId as string, myUid);
              router.back();           // đóng modal
              router.replace('/(tabs)'); // về trang Inbox
            } catch (err: any) {
              Alert.alert('Lỗi', err.message || 'Không thể rời nhóm');
            }
          },
        },
      ]
    );
  };

  const handleAddMember = () => {
    router.push(`/group-add-members/${roomId}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Đang tải danh sách...</Text>
      </View>
    );
  }

  const isCurrentUserAdmin = room?.admins?.includes(myUid) || false;

  return (
    <View style={styles.container}>
      <View style={styles.modalHeader}>
        <Text style={styles.title}>
          Thành viên nhóm ({membersData.length})
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddMember}>
        <Text style={styles.addButtonText}>➕ Thêm thành viên</Text>
      </TouchableOpacity>

      <FlatList
        data={membersData}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => {
          const isMe = item.uid === myUid;
          const isAdmin = room?.admins?.includes(item.uid) || false;

          return (
            <View style={styles.memberItem}>
              <Image
                source={{ uri: item.photoURL || DEFAULT_AVATAR_BASE64 }}
                style={styles.avatar}
              />
              <View style={styles.info}>
                <Text style={styles.name}>
                  {item.displayName || 'Không tên'} {isMe && '(Bạn)'}
                </Text>
                <Text style={styles.email}>{item.email}</Text>
              </View>

              {isAdmin && <Text style={styles.adminBadge}>Admin</Text>}

              {/* NÚT XÓA - Chỉ Admin mới thấy */}
              {isCurrentUserAdmin && !isMe && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveMember(item.uid, item.displayName || item.email)}
                >
                  <Text style={styles.removeText}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* ==================== NÚT RỜI NHÓM - CỐ ĐỊNH Ở DƯỚI ==================== */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.leaveGroupButton} onPress={handleLeaveGroup}>
          <Text style={styles.leaveGroupText}>🚪 Rời khỏi nhóm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 20, fontWeight: '700' },
  closeButton: { fontSize: 28, fontWeight: '700', color: '#dc3545' },
  addButton: {
    backgroundColor: '#28a745',
    margin: 16,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  email: { color: '#666', marginTop: 2, fontSize: 14 },
  adminBadge: {
    backgroundColor: '#007bff',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  removeButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  removeText: { fontSize: 22, color: '#dc3545' },

  // Footer nút rời nhóm
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  leaveGroupButton: {
    backgroundColor: '#dc3545',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveGroupText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  loadingText: { textAlign: 'center', marginTop: 100, fontSize: 16, color: '#666' },
});
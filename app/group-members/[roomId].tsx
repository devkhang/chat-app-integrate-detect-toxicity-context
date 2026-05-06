// app/group-members/[roomId].tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Image, 
  Modal, 
  TextInput 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase';
import { auth } from '../../firebase';
import type { Room, AppUser } from '../../types';
import { getUser } from '../../rtdb services/UserService';
import { DEFAULT_AVATAR_BASE64 } from '../constants';
import { 
  removeMemberFromGroup, 
  leaveGroup, 
  updateGroupName, 
  updateGroupPhoto 
} from '../../rtdb services/ChatService';

export default function GroupMembersScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const myUid = auth.currentUser?.uid;

  const [room, setRoom] = useState<Room | null>(null);
  const [membersData, setMembersData] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal đổi tên nhóm
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const fetchRoomAndMembers = async () => {
    if (!roomId) return;
    try {
      const roomSnap = await get(ref(rtdb, `rooms/${roomId}`));
      if (roomSnap.exists()) {
        const roomData = roomSnap.val() as Room;
        setRoom(roomData);
        setNewGroupName(roomData.name || '');

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

  // ==================== CHỈNH SỬA ẢNH NHÓM ====================
  const pickAndUpdateGroupPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        await updateGroupPhoto(roomId as string, base64, myUid!);
        await fetchRoomAndMembers(); // refresh avatar
      } catch (err) {
        Alert.alert('Lỗi', 'Không thể cập nhật ảnh nhóm');
      }
    }
  };

  // ==================== ĐỔI TÊN NHÓM ====================
  const handleRenameGroup = async () => {
    if (!roomId || !myUid || !newGroupName.trim()) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }
    try {
      await updateGroupName(roomId as string, newGroupName.trim(), myUid);
      setShowRenameModal(false);
      await fetchRoomAndMembers();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể đổi tên nhóm');
    }
  };

  // ==================== XÓA THÀNH VIÊN (CHỈ ADMIN) ====================
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

  // ==================== RỜI NHÓM ====================
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
              router.back();
              router.replace('/(tabs)');
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
        <Text style={styles.loadingText}>Đang tải danh sách thành viên...</Text>
      </View>
    );
  }

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

      {/* Avatar nhóm + Nút chỉnh sửa ảnh */}
      <View style={styles.groupAvatarContainer}>
        <Image
          source={{ uri: room?.photoURL || DEFAULT_AVATAR_BASE64 }}
          style={styles.groupAvatar}
        />
        <TouchableOpacity style={styles.editPhotoButton} onPress={pickAndUpdateGroupPhoto}>
          <Text style={styles.editPhotoText}>📸</Text>
        </TouchableOpacity>
      </View>

      {/* Nút đổi tên nhóm - Mọi thành viên đều dùng được */}
      <TouchableOpacity style={styles.renameButton} onPress={() => setShowRenameModal(true)}>
        <Text style={styles.renameButtonText}>✏️ Đổi tên nhóm</Text>
      </TouchableOpacity>

      {/* Nút thêm thành viên */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddMember}>
        <Text style={styles.addButtonText}>➕ Thêm thành viên</Text>
      </TouchableOpacity>

      {/* Danh sách thành viên */}
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

              {/* Nút xóa - Chỉ admin mới thấy */}
              {room?.admins?.includes(myUid) && !isMe && (
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

      {/* Footer - Nút rời nhóm */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.leaveGroupButton} onPress={handleLeaveGroup}>
          <Text style={styles.leaveGroupText}>🚪 Rời khỏi nhóm</Text>
        </TouchableOpacity>
      </View>

      {/* Modal đổi tên nhóm */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameModal}>
            <Text style={styles.renameTitle}>Đổi tên nhóm</Text>
            <TextInput
              style={styles.renameInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Nhập tên nhóm mới"
              autoFocus
            />
            <View style={styles.renameActions}>
              <TouchableOpacity style={styles.cancelRenameBtn} onPress={() => setShowRenameModal(false)}>
                <Text style={styles.cancelRenameText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRenameBtn} onPress={handleRenameGroup}>
                <Text style={styles.confirmRenameText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Avatar nhóm
  groupAvatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  groupAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#007bff',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#28a745',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  editPhotoText: { fontSize: 18, color: '#fff' },

  // Nút đổi tên
  renameButton: {
    backgroundColor: '#007bff',
    marginHorizontal: 16,
    marginBottom: 8,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  addButton: {
    backgroundColor: '#28a745',
    marginHorizontal: 16,
    marginBottom: 8,
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

  // Modal đổi tên
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameModal: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 16,
    padding: 20,
  },
  renameTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  renameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  renameActions: { flexDirection: 'row', gap: 12 },
  cancelRenameBtn: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelRenameText: { color: '#666', fontWeight: '600' },
  confirmRenameBtn: {
    flex: 1,
    backgroundColor: '#28a745',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmRenameText: { color: '#fff', fontWeight: '700' },

  loadingText: { textAlign: 'center', marginTop: 100, fontSize: 16, color: '#666' },
});
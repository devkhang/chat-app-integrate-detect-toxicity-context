import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFriendRequestsScreen } from '../hooks/useFriendRequestsScreen';

export default function FriendRequestsScreen() {
  const { requests, handleAccept, handleReject } = useFriendRequestsScreen();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lời mời kết bạn</Text>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Không có lời mời nào</Text>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.name}>{item.fromUser?.displayName || 'Người dùng'}</Text>
            <Text style={styles.email}>{item.fromUser?.email || 'Không có email'}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAccept(item.id, item.fromUid)}
              >
                <Text style={styles.acceptText}>Chấp nhận</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleReject(item.id)}
              >
                <Text style={styles.rejectText}>Từ chối</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  item: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    marginBottom: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  email: {
    marginTop: 4,
    color: '#666',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#28a745',
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontWeight: '700',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectText: {
    color: '#fff',
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    marginTop: 30,
    color: '#888',
  },
});

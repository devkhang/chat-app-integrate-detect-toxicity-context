import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './../firebase';
import '../utils/streamPolyfill';

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user === undefined) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';
    const inFriendRequestsScreen = segments[0] === 'friend-requests';
    const inChatScreen = segments[0] === 'chat';

    // === THÊM KIỂM TRA EDIT PROFILE ===
    const inEditProfileScreen = segments.join('/') === 'edit-profile';

    if (!user && !inAuthScreen) {
      router.replace('/login');
      return;
    }

    if (user && inAuthScreen) {
      router.replace('/');
      return;
    }

    // Chỉ redirect về trang chủ nếu KHÔNG phải các màn hình hợp lệ
    if (
      user &&
      !inTabsGroup &&
      !inFriendRequestsScreen &&
      !inChatScreen &&
      !inEditProfileScreen
    ) {
      router.replace('/');
    }
  }, [user, segments]);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="friend-requests" options={{ title: 'Lời mời kết bạn' }} />
      <Stack.Screen name="chat/[roomId]" options={{ title: 'Đang chat' }} />

      {/* === ROUTE CHO EDIT PROFILE (đã di chuyển ra ngoài chat) === */}
      <Stack.Screen 
        name="edit-profile" 
        options={{ 
          title: 'Chỉnh sửa hồ sơ',
          headerShown: true,
        }} 
      />

      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
    </Stack>
  );
}
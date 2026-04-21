import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Alert } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './../firebase';
import '../utils/streamPolyfill';
import * as Notifications from 'expo-notifications';
import { savePushToken } from '../services/rtdb';   // ← thêm dòng này

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const segments = useSegments();

  // ==================== 1. ĐĂNG KÝ PUSH TOKEN ====================
  useEffect(() => {
    const registerPushNotifications = async () => {
      try {
        // 1. Kiểm tra quyền
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('Người dùng từ chối quyền thông báo');
          return;
        }

        // 2. Lấy token (Bọc kỹ chỗ này)
        // Thêm projectId nếu bạn dùng Expo SDK mới (49+)
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '1d1eac74-6d01-4c95-8368-72b71db89c91' 
        });
        
        const pushToken = tokenData.data;
        console.log('✅ Expo Push Token:', pushToken);

        if (auth.currentUser?.uid) {
          await savePushToken(auth.currentUser.uid, pushToken);
        }
      } catch (error) {
        console.log('❌ Lỗi không lấy được Push Token:', error.message);
        // Bạn có thể hiện thông báo nhẹ nhàng cho user ở đây thay vì để app crash
      }
    };

    registerPushNotifications();
  }, []);
  // ============================================================

  // ==================== 2. LẮNG NGHE PUSH NOTIFICATION ====================
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;

      if (data?.type === 'video_call') {
        // Tự động mở màn Incoming Call khi nhận cuộc gọi
        router.push({
          pathname: '/incoming-call',
          params: {
            fromUid: data.fromUid,
            fromName: data.fromName,
            roomId: data.roomId,
          },
        });
      }
    });

    return () => subscription.remove(); // dọn dẹp khi component unmount
  }, []);
  // ============================================================

  // ==================== PHẦN CODE CŨ (không thay đổi) ====================
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
    const inEditProfileScreen = segments.join('/') === 'edit-profile';
    const inVideoCallScreen = segments[0] === 'video-call';
    const inIncomingCallScreen = segments[0] === 'incoming-call';

    if (!user && !inAuthScreen) {
      router.replace('/login');
      return;
    }

    if (user && inAuthScreen) {
      router.replace('/');
      return;
    }

    if (
      user &&
      !inTabsGroup &&
      !inFriendRequestsScreen &&
      !inChatScreen &&
      !inEditProfileScreen &&
      !inVideoCallScreen &&          // ← thêm
      !inIncomingCallScreen          // ← thêm
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
      <Stack.Screen name="edit-profile" options={{ title: 'Chỉnh sửa hồ sơ', headerShown: true }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />

      {/* Route mới cho Incoming Call */}
      <Stack.Screen 
        name="incoming-call" 
        options={{ 
          title: 'Cuộc gọi đến',
          headerShown: false,        // ẩn header để giao diện full màn hình
          presentation: 'modal',     // hiện kiểu modal (đẹp hơn)
        }} 
      />

      {/* Route cho Video Call */}
      <Stack.Screen 
        name="video-call/[roomId]" 
        options={{ 
          title: 'Video Call',
          headerShown: false,
        }} 
      />
    </Stack>
  );
}
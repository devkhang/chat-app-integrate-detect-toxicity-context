import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Alert } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './../firebase';
import '../utils/streamPolyfill';
import * as Notifications from 'expo-notifications';
import { savePushToken } from '../services/rtdb';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,      // hiện thông báo ngay cả khi app đang mở
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,     // ← BẮT BUỘC thêm
    shouldShowList: true,       // ← BẮT BUỘC thêm
  }),
});

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const segments = useSegments();

  // ==================== 1. ĐĂNG KÝ PUSH TOKEN ====================
  useEffect(() => {
    const registerPushNotifications = async () => {
      try {
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

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '1d1eac74-6d01-4c95-8368-72b71db89c91',
        });

        const pushToken = tokenData.data;
        console.log('✅ Expo Push Token:', pushToken);

        if (auth.currentUser?.uid) {
          await savePushToken(auth.currentUser.uid, pushToken);
        }
      } catch (error: any) {
        console.log('❌ Lỗi lấy Push Token:', error.message);
      }
    };

    registerPushNotifications();
  }, []);

  // ==================== 2. LẮNG NGHE PUSH NOTIFICATION (ĐÃ TỐI ƯU) ====================
  useEffect(() => {
    console.log('🟢 Notification listeners đã được mount');

    // Foreground: app đang mở
    const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      console.log('📨 [Foreground] Nhận push data:', data);

      if (data?.type === 'video_call') {
        console.log('📹 [Foreground] Chuyển sang incoming-call');
        router.replace({
          pathname: '/incoming-call',
          params: {
            fromUid: data.fromUid,
            fromName: data.fromName,
            roomId: data.roomId,
          },
        });
      }
    });

    // User bấm vào thông báo (background hoặc killed)
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('👆 [Tap Notification] Data:', data);

      if (data?.type === 'video_call') {
        console.log('📹 [Tap] Chuyển sang incoming-call');
        router.replace({
          pathname: '/incoming-call',
          params: {
            fromUid: data.fromUid,
            fromName: data.fromName,
            roomId: data.roomId,
          },
        });
      }
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
      console.log('🔴 Notification listeners đã remove');
    };
  }, []);

  // ==================== 3. LẮNG NGHE TRẠNG THÁI ĐĂNG NHẬP ====================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  // ==================== 4. ĐIỀU HƯỚNG TỰ ĐỘNG ====================
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
      !inVideoCallScreen &&
      !inIncomingCallScreen
    ) {
      router.replace('/');
    }
  }, [user, segments]);

  // ==================== HIỂN THỊ LOADING KHI CHƯA XÁC ĐỊNH USER ====================
  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ==================== CÁC ROUTE CỦA ỨNG DỤNG ====================
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="friend-requests" options={{ title: 'Lời mời kết bạn' }} />
      <Stack.Screen name="chat/[roomId]" options={{ title: 'Đang chat' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Chỉnh sửa hồ sơ', headerShown: true }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />

      {/* Màn hình Incoming Call */}
      <Stack.Screen 
        name="incoming-call" 
        options={{ 
          title: 'Cuộc gọi đến',
          headerShown: false,
          presentation: 'modal',
        }} 
      />

      {/* Màn hình Video Call */}
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
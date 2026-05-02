import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './../firebase';
import '../utils/streamPolyfill';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { savePushToken } from '../services/NotificationService';

// import { AppState} from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('⚡ [HANDLER] Gọi tới!', notification.request.content.data);
    return {
      shouldShowAlert: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: true,
    };
  },
});

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const segments = useSegments();

  // Đăng ký Push Token
  useEffect(() => {
    const register = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('urgent_v2', {
            name: 'Tin nhắn & Cuộc gọi',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        if (Device.isDevice) {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') return;

          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '026d3c63-e1c3-48e6-ba08-3f5587c66de5',
          });

          const pushToken = tokenData.data;
          console.log('✅ Expo Push Token:', pushToken);

          if (auth.currentUser?.uid) {
            await savePushToken(auth.currentUser.uid, pushToken);
          }
        }
      } catch (e: any) {
        console.log('❌ Lỗi register push:', e.message);
      }
    };
    register();
  }, []);

  //   useEffect(() => {
  //   const handleAppStateChange = (nextAppState: string) => {
  //     console.log('🔄 AppState thay đổi:', nextAppState);

  //     if (nextAppState === 'active') {
  //       console.log('✅ ỨNG DỤNG ĐANG Ở FOREGROUND (người dùng đang nhìn thấy)');
  //     } 
  //     else if (nextAppState === 'background') {
  //       console.log('📴 ỨNG DỤNG ĐANG Ở BACKGROUND');
  //     } 
  //     else if (nextAppState === 'inactive') {
  //       console.log('⏸️ ỨNG DỤNG ĐANG INACTIVE (ví dụ: chuyển app khác)');
  //     }
  //   };

  //   const subscription = AppState.addEventListener('change', handleAppStateChange);

  //   // Kiểm tra trạng thái hiện tại ngay khi mount
  //   console.log('📍 Trạng thái App lúc khởi động:', AppState.currentState);

  //   return () => {
  //     subscription.remove();
  //   };
  // }, []);
  // Listener chính
  useEffect(() => {
    console.log('🟢 Notification listeners đã mount');
    const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      console.log('🔥 [FOREGROUND] Nhận push data:', JSON.stringify(data, null, 2));


      if (data?.type === 'video_call') {
        console.log('✅ [FOREGROUND] Cuộc gọi video');
        router.replace({
          pathname: '/incoming-call',
          params: data,
        });
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('👆 [TAP] Data:', JSON.stringify(data, null, 2));

      if (data?.type === 'new_message' && data.roomId) {
        router.replace(`/chat/${data.roomId}`);
      }
      if (data?.type === 'video_call') {
        router.replace({
          pathname: '/incoming-call',
          params: data,
        });
      }
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, []);

  // Phần auth & navigation (giữ nguyên)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    const inAuth = segments[0] === 'login' || segments[0] === 'register';
    if (!user && !inAuth) router.replace('/login');
    if (user && inAuth) router.replace('/');
  }, [user, segments]);

  if (user === undefined) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[roomId]" options={{ title: 'Đang chat' }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="incoming-call" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="video-call/[roomId]" options={{ headerShown: false }} />
      <Stack.Screen 
        name="group-add-members/[roomId]" 
        options={{ 
          title: 'Thêm thành viên vào nhóm',
          presentation: 'modal',           // ← Modal đẹp
          animation: 'slide_from_bottom',
        }} 
      />
      <Stack.Screen 
        name="group-members/[roomId]" 
        options={{ 
          title: 'Thành viên nhóm',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }} 
      />
    </Stack>
  );
}
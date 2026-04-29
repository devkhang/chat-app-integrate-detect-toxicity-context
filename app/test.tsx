import * as Notifications from 'expo-notifications';
import { Button, View } from 'react-native';

export default function TestScreen() {
  const handleTestLocalNotification = async () => {
    console.log("🔔 Đang thử kích hoạt thông báo cục bộ...");
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Local Notification 🔴",
        body: "Nếu bạn thấy dòng này và Alert, listener đã chạy!",
        data: { 
          type: 'video_call', 
          roomId: 'test-123-abc',
          fromName: 'Người gửi thử nghiệm'
        },
        sound: 'default',
      },
      trigger: null, // Gửi ngay lập tức
    });
  };

  return (
    <View style={{ marginTop: 100, padding: 20 }}>
      <Button title="Bấm để Test Listener" onPress={handleTestLocalNotification} color="#ff5c5c" />
    </View>
  );
}
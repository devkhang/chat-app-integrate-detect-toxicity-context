import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tintColor = colorScheme === 'dark' ? '#fff' : '#0084ff';

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: tintColor }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Đoạn chat',
          tabBarLabel: 'Tin nhắn',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} color={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Danh bạ',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} color={color} size={24} />
          ),
        }}
      />

      {/* ==================== TAB AI MỚI ==================== */}
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'AI Chat',
          tabBarLabel: 'AI',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'sparkles' : 'sparkles-outline'} 
              color={color} 
              size={24} 
            />
          ),
        }}
      />
      {/* ==================================================== */}

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Cài đặt',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
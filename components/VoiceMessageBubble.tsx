// app/components/VoiceMessageBubble.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av'; 
import type { Message } from '../types';

interface Props {
  item: Message;
  isMine: boolean;
}

export default function VoiceMessageBubble({ item, isMine }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let newSound: Audio.Sound | null = null;

    const loadSound = async () => {
      if (!item.voiceBase64) return;
      try {
        // 1. Khởi tạo file âm thanh
        const { sound: createdSound } = await Audio.Sound.createAsync(
          { uri: item.voiceBase64 },
          { shouldPlay: false }
        );
        
        // 2. Đăng ký listener xử lý trạng thái phát bằng biến createdSound
        createdSound.setOnPlaybackStatusUpdate(async (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;

          // Cập nhật thanh progress
          if (status.durationMillis) {
            setProgress(status.positionMillis / status.durationMillis);
          }

          // XỬ LÝ KHI PHÁT HẾT ÂM THANH
          if (status.didJustFinish) {
            setIsPlaying(false);
            setProgress(0);
            
            // Dùng stopAsync() để ngắt hẳn file âm thanh và đưa con trỏ về 0.
            // Điều này giúp nút Play ở lần bấm tiếp theo hoạt động trơn tru ngay lập tức.
            await createdSound.stopAsync(); 
          } else {
            // Đồng bộ trạng thái play/pause
            setIsPlaying(status.isPlaying);
          }
        });

        newSound = createdSound;
        setSound(createdSound);
      } catch (err) {
        console.error("Lỗi load voice:", err);
      }
    };

    loadSound();

    return () => {
      if (newSound) newSound.unloadAsync();
    };
  }, [item.voiceBase64]);

  // Hàm xử lý khi bấm nút Play / Pause
  const togglePlay = async () => {
    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      // Khi đã dùng stopAsync() ở trên, bạn chỉ cần gọi playAsync() là nó sẽ tự chạy từ đầu
      await sound.playAsync();
    }
  };

  return (
    <View style={[styles.bubble, isMine ? styles.myBubble : styles.otherBubble]}>
      <TouchableOpacity style={styles.voiceContainer} onPress={togglePlay} activeOpacity={0.7}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={24}
          color={isMine ? "#fff" : "#0084ff"}
        />

        <View style={styles.rightContent}>
          <View style={styles.infoRow}>
            <Text style={[styles.titleText, isMine ? styles.myText : styles.otherText]}>
              Voice message
            </Text>
            {!!item.voiceDuration && (
              <Text style={[styles.durationText, isMine ? styles.myText : styles.otherText]}>
                {item.voiceDuration}s
              </Text>
            )}
          </View>

          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${progress * 100}%`, backgroundColor: isMine ? '#fff' : '#0084ff' }
              ]} 
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: 220,               
    paddingVertical: 8,       
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: '#0084ff',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#f1f1f1',
    borderBottomLeftRadius: 4,
  },
  voiceContainer: {
    flexDirection: 'row',     
    alignItems: 'center',
  },
  rightContent: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  durationText: {
    fontSize: 11,
    opacity: 0.8,
  },
  myText: { color: '#fff' },
  otherText: { color: '#222' },
  progressBarContainer: {
    height: 3,                
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
});
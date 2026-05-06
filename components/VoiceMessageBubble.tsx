// app/components/VoiceMessageBubble.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av'; // Thêm AVPlaybackStatus
import type { Message } from '../types';

interface Props {
  item: Message;
  isMine: boolean;
}

export default function VoiceMessageBubble({ item, isMine }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // 1. Hàm xử lý trạng thái phát (Quan trọng nhất để Replay)
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    // Cập nhật thanh progress
    if (status.durationMillis) {
      setProgress(status.positionMillis / status.durationMillis);
    }

    // KHI PHÁT HẾT: Reset mọi thứ về trạng thái ban đầu
    if (status.didJustFinish) {
      setIsPlaying(false);
      setProgress(0);
      // Đưa thanh cuộn về 0 để lần sau bấm Play là nó chạy từ đầu
      sound?.setPositionAsync(0); 
    }
  };

  useEffect(() => {
    let newSound: Audio.Sound | null = null;

    const loadSound = async () => {
      if (!item.voiceBase64) return;
      try {
        const { sound: createdSound } = await Audio.Sound.createAsync(
          { uri: item.voiceBase64 },
          { shouldPlay: false },
          onPlaybackStatusUpdate // Đăng ký listener ngay khi load
        );
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

  const togglePlay = async () => {
    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      // Nếu đang ở cuối file (progress gần bằng 1 hoặc đã hết), phát lại từ đầu
      if (progress >= 0.99) {
        await sound.setPositionAsync(0);
      }
      await sound.playAsync();
      setIsPlaying(true);
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

// ... styles giữ nguyên như code của bạn

const styles = StyleSheet.create({
  bubble: {
    width: 220,               // Cố định chiều rộng để thanh bubble dài ra
    paddingVertical: 8,       // Giảm padding dọc để lùn xuống
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
    flexDirection: 'row',     // Sắp xếp icon và info nằm ngang
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
    height: 3,                // Thanh progress mỏng hơn
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
});
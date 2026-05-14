// components/CameraScreen.tsx
import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

interface CameraScreenProps {
  onClose: () => void;
  onSendPhoto: (uri: string) => void;
  onOpenGallery: () => void; // Thêm prop để mở thư viện ảnh
}

type CameraFacing = 'front' | 'back';
type FlashMode = 'off' | 'on';

export default function CameraScreen({ onClose, onSendPhoto, onOpenGallery }: CameraScreenProps) {
  // Dùng hook mới của Expo để xin quyền
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [photo, setPhoto] = useState<any>(null);
  const cameraRef = useRef<CameraView | null>(null);

  // Đang tải quyền
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Chưa cấp quyền
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color: 'white', marginTop: 100, fontSize: 16 }}>
          Ứng dụng cần quyền truy cập camera để chụp ảnh
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Cấp quyền Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photoData = await cameraRef.current.takePictureAsync();
      setPhoto(photoData);
    }
  };

  const switchCamera = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  // ================= MÀN HÌNH XEM LẠI ẢNH ĐÃ CHỤP =================
  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo.uri }} style={styles.preview} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.retakeButton} onPress={() => setPhoto(null)}>
            <Text style={styles.text}>Chụp lại</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.usePhotoButton} 
            onPress={() => onSendPhoto(photo.uri)}
          >
            <Text style={styles.text}>Gửi ảnh này</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ================= GIAO DIỆN CAMERA CHÍNH =================
  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing={facing} 
        enableTorch={flash === 'on'} 
        ref={cameraRef}
      >
        <View style={styles.buttonContainer}>
          {/* Nút Đóng */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={34} color="white" />
          </TouchableOpacity>
          
          {/* Cụm nút trên cùng (Flash, Lật camera) */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off'}
                size={28}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.flipButton} onPress={switchCamera}>
              <Ionicons name="camera-reverse" size={30} color="white" />
            </TouchableOpacity>
          </View>

          {/* Cụm nút dưới cùng (Kho ảnh, Chụp) */}
          <View style={styles.bottomControls}>
            {/* Nút Kho Ảnh bên trái */}
            <TouchableOpacity style={styles.galleryButton} onPress={onOpenGallery}>
              <Ionicons name="images" size={28} color="white" />
            </TouchableOpacity>

            {/* Nút Chụp Ảnh ở giữa */}
            <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
              <View style={styles.innerShutter} />
            </TouchableOpacity>

            {/* Khối trống bên phải để cân bằng bố cục giúp nút chụp nằm chính giữa */}
            <View style={{ width: 50 }} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'black' 
  },
  camera: { 
    flex: 1 
  },
  buttonContainer: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    flexDirection: 'row', 
    margin: 20, 
    justifyContent: 'space-between' 
  },
  closeButton: { 
    position: 'absolute', 
    top: 30, 
    left: 10, 
    padding: 5, 
    zIndex: 10 
  },
  topControls: { 
    position: 'absolute', 
    top: 30, 
    right: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 20 
  },
  flashButton: { padding: 5 },
  flipButton: { padding: 5 },
  
  bottomControls: { 
    position: 'absolute', 
    bottom: 30, 
    left: 10, 
    right: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButton: { 
    borderWidth: 4, 
    borderColor: 'white', 
    borderRadius: 50, 
    height: 80, 
    width: 80, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  innerShutter: { 
    height: 65, 
    width: 65, 
    borderRadius: 32.5, 
    backgroundColor: 'white' 
  },
  
  preview: { 
    flex: 1, 
    width: '100%', 
    height: '100%' 
  },
  previewActions: { 
    position: 'absolute', 
    bottom: 50, 
    left: 20, 
    right: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  retakeButton: { 
    paddingVertical: 15, 
    paddingHorizontal: 25,
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 25 
  },
  usePhotoButton: { 
    paddingVertical: 15, 
    paddingHorizontal: 25,
    backgroundColor: '#0084ff', 
    borderRadius: 25 
  },
  text: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  permissionButton: { 
    padding: 15, 
    backgroundColor: '#0084ff', 
    borderRadius: 10, 
    alignSelf: 'center', 
    marginTop: 20 
  },
});
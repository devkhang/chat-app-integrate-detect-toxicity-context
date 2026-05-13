import { setGlobalOptions } from "firebase-functions";
import * as admin from "firebase-admin";

// 1. KHỞI TẠO APP (Chỉ gọi 1 lần duy nhất ở đây)
admin.initializeApp();

// 2. CẤU HÌNH TOÀN CỤC
setGlobalOptions({
  region: "asia-southeast1",
  timeoutSeconds: 30,
  memory: "256MiB",
});

// 3. IMPORT CÁC MODULE CON
import * as agoraModule from "./agora";
import * as notificationsModule from "./notifications";
import * as voiceCallModule from "./voice-call";
// 4. EXPORT CÁC API CHO CLIENT GỌI
// API cho Video Call
export const generateAgoraToken = agoraModule.generateAgoraToken;

// API cho Push Notifications
export const savePushToken = notificationsModule.savePushToken;
export const sendCallPush = notificationsModule.sendCallPush; // <-- Đổi tên hàm export cho phù hợp với chức năng chung (gọi cả audio và video)
export const sendMessagePush = notificationsModule.sendMessagePush;
export const removePushToken = notificationsModule.removePushToken;
// API cho Voice Call (mapping Agora UID ↔ Firebase UID)
export const startVoiceCall = voiceCallModule.startVoiceCall;
export const endVoiceCall = voiceCallModule.endVoiceCall;
export const saveMissedCall = voiceCallModule.saveMissedCall;

export * from "./messages/sendMessages"; // Export trực tiếp hàm gửi tin nhắn để client gọi
export * from "./messages/groups"; // Export trực tiếp hàm quản lý nhóm để client gọi
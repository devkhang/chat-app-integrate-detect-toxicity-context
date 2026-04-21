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

// 4. EXPORT CÁC API CHO CLIENT GỌI
// API cho Video Call
export const generateAgoraToken = agoraModule.generateAgoraToken;

// API cho Push Notifications
export const savePushToken = notificationsModule.savePushToken;
export const sendVideoCallPush = notificationsModule.sendVideoCallPush;
export const sendMessagePush = notificationsModule.sendMessagePush;
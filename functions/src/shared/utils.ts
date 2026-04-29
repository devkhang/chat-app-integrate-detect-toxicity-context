import {
  DataSnapshot
} from "firebase/database";

export const snapshotToArray = <T>(snapshot: DataSnapshot): T[] => {
  const value = snapshot.val();
  if (!value) return [];
  return Object.values(value) as T[];
};

export function formatRoomTime(timestamp?: number | null) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("vi-VN");
}
// Chỉ là logic xử lý dữ liệu, không dính đến môi trường
export const makeDirectRoomId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join("_");
};

export const stringToNumberId = (uid: string): number => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash) + uid.charCodeAt(i);
    hash |= 0; 
  }
  return Math.abs(hash);
};

export const makeFriendshipId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};
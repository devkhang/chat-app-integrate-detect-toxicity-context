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
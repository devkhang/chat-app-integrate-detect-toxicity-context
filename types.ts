export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: number;
  pushToken?: string;
};

export type FriendRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
};

export type Friendship = {
  id: string;
  userIds: string[];
  status: 'accepted';
  createdAt: number;
};

export type Room = {
  roomId: string;
  type: 'direct' | 'group';
  name: string;
  members: string[];
  admins: string[];
  createdBy: string;
  createdAt: number;
  lastMessage: string;
  lastMessageAt: number | null;
  lastSenderId: string;
};

export type Message = {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  imageBase64?: string;    // ← Base64 của ảnh
  imageType?: string;      // ← ví dụ: "image/jpeg"
  imageUrl?: string;        // nếu bạn dùng ảnh chat
  senderPhotoURL?: string;  // ← THÊM DÒNG NÀY
  type: 'text' | 'image' | 'file';
  createdAt: number;
};

export type ChatListItem = {
  id: string;
  roomId: string;
  type: 'direct' | 'group' | 'ai';
  name: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;     // ← thêm dòng này
};

export type RequestItem = {
  id: string;
  fromUid: string;
  fromUser: AppUser | null;
};

import { DrawingState } from './drawing-state.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    this.colorIndex = 0;
  }

  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        drawingState: new DrawingState(),
        nextUserId: 1
      });
    }
    return this.rooms.get(roomId);
  }

  addUser(roomId, ws, username) {
    const room = this.getOrCreateRoom(roomId);
    const userId = room.nextUserId++;
    const color = this.userColors[this.colorIndex % this.userColors.length];
    this.colorIndex++;

    const user = {
      id: userId,
      username: username || `User ${userId}`,
      color: color,
      ws: ws,
      cursor: null
    };

    room.users.set(userId, user);
    return { user, room };
  }

  removeUser(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.users.delete(userId);

    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  updateUserCursor(roomId, userId, cursor) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const user = room.users.get(userId);
    if (!user) return false;

    user.cursor = cursor;
    return true;
  }

  getUserList(room) {
    return Array.from(room.users.values()).map(u => ({
      id: u.id,
      username: u.username,
      color: u.color
    }));
  }

  broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.users.forEach((user, userId) => {
      if (userId !== excludeUserId && user.ws.readyState === 1) {
        user.ws.send(JSON.stringify(message));
      }
    });
  }
}

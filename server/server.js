import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RoomManager } from './rooms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(join(__dirname, '../client')));

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();

wss.on('connection', (ws) => {
  let currentUserId = null;
  let currentRoomId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join': {
          currentRoomId = message.roomId || 'default';
          const { user, room } = roomManager.addUser(currentRoomId, ws, message.username);
          currentUserId = user.id;

          ws.send(JSON.stringify({
            type: 'joined',
            userId: user.id,
            color: user.color,
            username: user.username,
            operations: room.drawingState.getVisibleOperations(),
            users: roomManager.getUserList(room)
          }));

          roomManager.broadcastToRoom(currentRoomId, {
            type: 'user-joined',
            user: {
              id: user.id,
              username: user.username,
              color: user.color
            },
            users: roomManager.getUserList(room)
          }, currentUserId);

          break;
        }

        case 'draw-start':
        case 'draw-move':
        case 'draw-end': {
          const room = roomManager.getRoom(currentRoomId);
          if (!room) break;

          const operation = {
            type: message.type,
            userId: currentUserId,
            tool: message.tool,
            color: message.color,
            lineWidth: message.lineWidth,
            x: message.x,
            y: message.y,
            timestamp: Date.now()
          };

          if (message.type === 'draw-end') {
            const opIndex = room.drawingState.addOperation(operation);
            operation.operationId = opIndex;
          }

          roomManager.broadcastToRoom(currentRoomId, {
            type: 'draw',
            operation: operation
          }, currentUserId);

          break;
        }

        case 'cursor-move': {
          roomManager.updateUserCursor(currentRoomId, currentUserId, {
            x: message.x,
            y: message.y
          });

          roomManager.broadcastToRoom(currentRoomId, {
            type: 'cursor-update',
            userId: currentUserId,
            x: message.x,
            y: message.y
          }, currentUserId);

          break;
        }

        case 'undo': {
          const room = roomManager.getRoom(currentRoomId);
          if (!room) break;

          const result = room.drawingState.undo();
          if (result.success) {
            roomManager.broadcastToRoom(currentRoomId, {
              type: 'undo',
              currentIndex: result.currentIndex,
              operations: result.operations
            });

            ws.send(JSON.stringify({
              type: 'undo',
              currentIndex: result.currentIndex,
              operations: result.operations
            }));
          }

          break;
        }

        case 'redo': {
          const room = roomManager.getRoom(currentRoomId);
          if (!room) break;

          const result = room.drawingState.redo();
          if (result.success) {
            roomManager.broadcastToRoom(currentRoomId, {
              type: 'redo',
              currentIndex: result.currentIndex,
              operations: result.operations
            });

            ws.send(JSON.stringify({
              type: 'redo',
              currentIndex: result.currentIndex,
              operations: result.operations
            }));
          }

          break;
        }

        case 'clear': {
          const room = roomManager.getRoom(currentRoomId);
          if (!room) break;

          room.drawingState.clear();

          roomManager.broadcastToRoom(currentRoomId, {
            type: 'clear'
          });

          ws.send(JSON.stringify({
            type: 'clear'
          }));

          break;
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentUserId) {
      const room = roomManager.removeUser(currentRoomId, currentUserId);
      if (room) {
        roomManager.broadcastToRoom(currentRoomId, {
          type: 'user-left',
          userId: currentUserId,
          users: roomManager.getUserList(room)
        });
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

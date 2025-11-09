import { CanvasDrawing } from './canvas.js';
import { WebSocketClient } from './websocket.js';

class CollaborativeCanvas {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.canvasDrawing = new CanvasDrawing(this.canvas);
    this.wsClient = new WebSocketClient();

    this.currentTool = 'brush';
    this.currentColor = '#000000';
    this.currentLineWidth = 3;

    this.remoteCursors = new Map();
    this.users = new Map();
    this.drawThrottle = null;
    this.cursorThrottle = null;

    this.userInfo = null;

    this.setupModal();
  }

  setupModal() {
    const modal = document.getElementById('join-modal');
    const form = document.getElementById('join-form');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const roomId = document.getElementById('room-id').value.trim() || 'default';

      try {
        await this.initialize(roomId, username);
        modal.style.display = 'none';
      } catch (error) {
        alert('Failed to connect: ' + error.message);
      }
    });
  }

  async initialize(roomId, username) {
    try {
      const joinData = await this.wsClient.connect(roomId, username);

      this.userInfo = {
        id: joinData.userId,
        username: joinData.username,
        color: joinData.color
      };

      document.getElementById('room-name').textContent = `Room: ${roomId}`;

      this.canvasDrawing.redrawFromOperations(joinData.operations);

      this.updateUserList(joinData.users);

      this.setupEventListeners();
      this.setupWebSocketHandlers();
      this.setupKeyboardShortcuts();

    } catch (error) {
      console.error('Initialization error:', error);
      throw error;
    }
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));

    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.selectTool(tool);
      });
    });

    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        this.selectColor(color);
      });
    });

    const strokeWidth = document.getElementById('stroke-width');
    const strokeValue = document.getElementById('stroke-value');
    strokeWidth.addEventListener('input', (e) => {
      const width = parseInt(e.target.value);
      this.currentLineWidth = width;
      this.canvasDrawing.setLineWidth(width);
      strokeValue.textContent = `${width}px`;
    });

    document.getElementById('undo-btn').addEventListener('click', () => {
      this.wsClient.sendUndo();
    });

    document.getElementById('redo-btn').addEventListener('click', () => {
      this.wsClient.sendRedo();
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This affects all users.')) {
        this.wsClient.sendClear();
      }
    });
  }

  setupWebSocketHandlers() {
    this.wsClient.on('draw', (message) => {
      this.canvasDrawing.drawRemotePath(message.operation);
    });

    this.wsClient.on('cursor-update', (message) => {
      this.updateRemoteCursor(message.userId, message.x, message.y);
    });

    this.wsClient.on('user-joined', (message) => {
      this.updateUserList(message.users);
    });

    this.wsClient.on('user-left', (message) => {
      this.updateUserList(message.users);
      this.removeRemoteCursor(message.userId);
    });

    this.wsClient.on('undo', (message) => {
      this.canvasDrawing.redrawFromOperations(message.operations);
    });

    this.wsClient.on('redo', (message) => {
      this.canvasDrawing.redrawFromOperations(message.operations);
    });

    this.wsClient.on('clear', () => {
      this.canvasDrawing.clear();
    });

    this.wsClient.on('connection-status', (data) => {
      const indicator = document.getElementById('connection-indicator');
      const text = document.getElementById('connection-text');

      if (data.connected) {
        indicator.className = 'status-dot connected';
        text.textContent = 'Connected';
      } else {
        indicator.className = 'status-dot disconnected';
        text.textContent = 'Reconnecting...';
      }
    });

    this.wsClient.on('error', (data) => {
      console.error('WebSocket error:', data.message);
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.wsClient.sendUndo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          this.wsClient.sendRedo();
        }
      }
    });
  }

  handleMouseDown(e) {
    const coords = this.canvasDrawing.getCanvasCoordinates(e);
    this.canvasDrawing.startDrawing(coords.x, coords.y);

    this.wsClient.sendDrawStart(
      coords.x,
      coords.y,
      this.currentTool,
      this.currentColor,
      this.currentLineWidth
    );
  }

  handleMouseMove(e) {
    const coords = this.canvasDrawing.getCanvasCoordinates(e);

    if (this.canvasDrawing.isDrawing) {
      this.canvasDrawing.draw(coords.x, coords.y);

      if (!this.drawThrottle) {
        this.wsClient.sendDrawMove(
          coords.x,
          coords.y,
          this.currentTool,
          this.currentColor,
          this.currentLineWidth
        );

        this.drawThrottle = setTimeout(() => {
          this.drawThrottle = null;
        }, 16);
      }
    }

    if (!this.cursorThrottle) {
      this.wsClient.sendCursorMove(coords.x, coords.y);

      this.cursorThrottle = setTimeout(() => {
        this.cursorThrottle = null;
      }, 50);
    }
  }

  handleMouseUp(e) {
    if (this.canvasDrawing.stopDrawing()) {
      const coords = this.canvasDrawing.getCanvasCoordinates(e);

      this.wsClient.sendDrawEnd(
        coords.x,
        coords.y,
        this.currentTool,
        this.currentColor,
        this.currentLineWidth
      );
    }
  }

  handleMouseLeave(e) {
    this.handleMouseUp(e);
  }

  selectTool(tool) {
    this.currentTool = tool;
    this.canvasDrawing.setTool(tool);

    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
  }

  selectColor(color) {
    this.currentColor = color;
    this.canvasDrawing.setColor(color);

    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-color="${color}"]`).classList.add('active');
  }

  updateUserList(users) {
    const userList = document.getElementById('user-list');
    const userCount = document.getElementById('user-count');

    userList.innerHTML = '';

    users.forEach(user => {
      this.users.set(user.id, user);

      const userItem = document.createElement('div');
      userItem.className = 'user-item';

      const colorDot = document.createElement('div');
      colorDot.className = 'user-color';
      colorDot.style.backgroundColor = user.color;

      const username = document.createElement('span');
      username.textContent = user.username + (user.id === this.userInfo.id ? ' (You)' : '');

      userItem.appendChild(colorDot);
      userItem.appendChild(username);
      userList.appendChild(userItem);
    });

    userCount.textContent = `Users: ${users.length}`;
  }

  updateRemoteCursor(userId, x, y) {
    if (userId === this.userInfo.id) return;

    const overlay = document.getElementById('cursors-overlay');
    const canvasRect = this.canvas.getBoundingClientRect();

    let cursor = this.remoteCursors.get(userId);

    if (!cursor) {
      cursor = document.createElement('div');
      cursor.className = 'remote-cursor';

      const label = document.createElement('div');
      label.className = 'cursor-label';

      const user = this.users.get(userId);
      if (user) {
        cursor.style.backgroundColor = user.color;
        label.textContent = user.username;
      }

      cursor.appendChild(label);
      overlay.appendChild(cursor);
      this.remoteCursors.set(userId, cursor);
    }

    const offsetX = canvasRect.left - overlay.getBoundingClientRect().left;
    const offsetY = canvasRect.top - overlay.getBoundingClientRect().top;

    cursor.style.left = `${x + offsetX}px`;
    cursor.style.top = `${y + offsetY}px`;
  }

  removeRemoteCursor(userId) {
    const cursor = this.remoteCursors.get(userId);
    if (cursor) {
      cursor.remove();
      this.remoteCursors.delete(userId);
    }
    this.users.delete(userId);
  }
}

const app = new CollaborativeCanvas();

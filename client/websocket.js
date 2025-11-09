export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.handlers = new Map();
    this.connected = false;
    this.userId = null;
    this.roomId = null;
  }

  connect(roomId, username) {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);
        this.roomId = roomId;

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connection-status', { connected: true });

          this.send({
            type: 'join',
            roomId: roomId,
            username: username
          });
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'joined') {
              this.userId = message.userId;
              resolve(message);
            }

            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { message: 'Connection error occurred' });
          reject(error);
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit('connection-status', { connected: false });

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
              this.reconnectAttempts++;
              this.connect(this.roomId, username).catch(err => {
                console.error('Reconnection failed:', err);
              });
            }, this.reconnectDelay);
          }
        };

        setTimeout(() => {
          if (!this.userId) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(message) {
    const handler = this.handlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  on(eventType, callback) {
    this.handlers.set(eventType, callback);
  }

  emit(eventType, data) {
    const handler = this.handlers.get(eventType);
    if (handler) {
      handler(data);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendDrawStart(x, y, tool, color, lineWidth) {
    this.send({
      type: 'draw-start',
      x: x,
      y: y,
      tool: tool,
      color: color,
      lineWidth: lineWidth
    });
  }

  sendDrawMove(x, y, tool, color, lineWidth) {
    this.send({
      type: 'draw-move',
      x: x,
      y: y,
      tool: tool,
      color: color,
      lineWidth: lineWidth
    });
  }

  sendDrawEnd(x, y, tool, color, lineWidth) {
    this.send({
      type: 'draw-end',
      x: x,
      y: y,
      tool: tool,
      color: color,
      lineWidth: lineWidth
    });
  }

  sendCursorMove(x, y) {
    this.send({
      type: 'cursor-move',
      x: x,
      y: y
    });
  }

  sendUndo() {
    this.send({ type: 'undo' });
  }

  sendRedo() {
    this.send({ type: 'redo' });
  }

  sendClear() {
    this.send({ type: 'clear' });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

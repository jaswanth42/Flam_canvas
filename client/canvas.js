export class CanvasDrawing {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: false });
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.tool = 'brush';
    this.color = '#000000';
    this.lineWidth = 3;
    this.currentPath = [];

    this.setupCanvas();
    this.setupContextDefaults();
  }

  setupCanvas() {
    const container = this.canvas.parentElement;
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;

    this.canvas.width = Math.min(1200, maxWidth);
    this.canvas.height = Math.min(800, maxHeight);
  }

  setupContextDefaults() {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  startDrawing(x, y) {
    this.isDrawing = true;
    this.lastX = x;
    this.lastY = y;
    this.currentPath = [{ x, y }];
  }

  draw(x, y) {
    if (!this.isDrawing) return;

    this.ctx.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';
    this.ctx.strokeStyle = this.tool === 'eraser' ? 'rgba(0,0,0,1)' : this.color;
    this.ctx.lineWidth = this.lineWidth;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.currentPath.push({ x, y });
    this.lastX = x;
    this.lastY = y;
  }

  stopDrawing() {
    if (!this.isDrawing) return false;
    this.isDrawing = false;
    return true;
  }

  drawRemotePath(operation) {
    const { x, y, tool, color, lineWidth } = operation;

    this.ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    this.ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    this.ctx.lineWidth = lineWidth;

    if (operation.type === 'draw-start') {
      this.remoteLastX = x;
      this.remoteLastY = y;
    } else if (operation.type === 'draw-move' && this.remoteLastX !== undefined) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.remoteLastX, this.remoteLastY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.remoteLastX = x;
      this.remoteLastY = y;
    }
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.color = color;
  }

  setLineWidth(width) {
    this.lineWidth = width;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  redrawFromOperations(operations) {
    this.clear();

    const paths = new Map();

    operations.forEach(op => {
      const key = `${op.userId}-${op.timestamp}`;

      if (op.type === 'draw-start') {
        paths.set(key, {
          points: [{ x: op.x, y: op.y }],
          tool: op.tool,
          color: op.color,
          lineWidth: op.lineWidth
        });
      } else if (op.type === 'draw-move') {
        const path = paths.get(key);
        if (path) {
          path.points.push({ x: op.x, y: op.y });
        }
      } else if (op.type === 'draw-end') {
        const path = paths.get(key);
        if (path) {
          path.points.push({ x: op.x, y: op.y });
          this.drawPath(path);
          paths.delete(key);
        }
      }
    });

    paths.forEach(path => {
      if (path.points.length > 0) {
        this.drawPath(path);
      }
    });
  }

  drawPath(path) {
    if (path.points.length === 0) return;

    this.ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';
    this.ctx.strokeStyle = path.tool === 'eraser' ? 'rgba(0,0,0,1)' : path.color;
    this.ctx.lineWidth = path.lineWidth;

    this.ctx.beginPath();
    this.ctx.moveTo(path.points[0].x, path.points[0].y);

    for (let i = 1; i < path.points.length; i++) {
      this.ctx.lineTo(path.points[i].x, path.points[i].y);
    }

    this.ctx.stroke();
  }

  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}

export class DrawingState {
  constructor() {
    this.operations = [];
    this.currentIndex = -1;
  }

  addOperation(operation) {
    this.operations = this.operations.slice(0, this.currentIndex + 1);
    this.operations.push(operation);
    this.currentIndex++;
    return this.currentIndex;
  }

  undo() {
    if (this.currentIndex >= 0) {
      this.currentIndex--;
      return {
        success: true,
        currentIndex: this.currentIndex,
        operations: this.getVisibleOperations()
      };
    }
    return { success: false };
  }

  redo() {
    if (this.currentIndex < this.operations.length - 1) {
      this.currentIndex++;
      return {
        success: true,
        currentIndex: this.currentIndex,
        operations: this.getVisibleOperations()
      };
    }
    return { success: false };
  }

  getVisibleOperations() {
    return this.operations.slice(0, this.currentIndex + 1);
  }

  getAllOperations() {
    return this.operations;
  }

  clear() {
    this.operations = [];
    this.currentIndex = -1;
  }
}

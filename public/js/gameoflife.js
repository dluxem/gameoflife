class GameOfLife {
    constructor(width, height, grid) {
        this.width = width;
        this.height = height;
        this.grid = grid ? new Uint8Array(grid) : new Uint8Array(width * height);
    }

    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.grid[y * this.width + x];
    }

    set(x, y, value) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.grid[y * this.width + x] = value ? 1 : 0;
        }
    }

    toggle(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const idx = y * this.width + x;
            this.grid[idx] = this.grid[idx] ? 0 : 1;
        }
    }

    countNeighbors(x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    count += this.grid[ny * this.width + nx];
                }
            }
        }
        return count;
    }

    step() {
        const next = new Uint8Array(this.width * this.height);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const neighbors = this.countNeighbors(x, y);
                const alive = this.grid[y * this.width + x];
                if (alive) {
                    next[y * this.width + x] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
                } else {
                    next[y * this.width + x] = (neighbors === 3) ? 1 : 0;
                }
            }
        }
        this.grid = next;
    }

    population() {
        let count = 0;
        for (let i = 0; i < this.grid.length; i++) count += this.grid[i];
        return count;
    }

    clear() { this.grid.fill(0); }

    randomize(density = 0.3) {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = Math.random() < density ? 1 : 0;
        }
    }

    invert() {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = this.grid[i] ? 0 : 1;
        }
    }

    clone() {
        return new GameOfLife(this.width, this.height, this.grid);
    }
}

class GameRenderer {
    constructor(canvas, game, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.cellSize = options.cellSize || this._calcCellSize(options.maxWidth || 800);
        this.colorAlive = options.colorAlive || '#39ff14';
        this.colorDead = options.colorDead || '#181830';
        this.colorGrid = options.colorGrid || '#222244';
        this.showGrid = options.showGrid !== false;
        this._resize();
    }

    _calcCellSize(maxWidth) {
        return Math.max(2, Math.min(Math.floor(maxWidth / this.game.width), 20));
    }

    _resize() {
        this.canvas.width = this.game.width * this.cellSize;
        this.canvas.height = this.game.height * this.cellSize;
    }

    render() {
        const { ctx, game, cellSize } = this;
        ctx.fillStyle = this.colorDead;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.showGrid && cellSize > 3) {
            ctx.strokeStyle = this.colorGrid;
            ctx.lineWidth = 0.5;
            for (let x = 0; x <= game.width; x++) {
                ctx.beginPath();
                ctx.moveTo(x * cellSize, 0);
                ctx.lineTo(x * cellSize, this.canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y <= game.height; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * cellSize);
                ctx.lineTo(this.canvas.width, y * cellSize);
                ctx.stroke();
            }
        }

        ctx.fillStyle = this.colorAlive;
        const pad = this.showGrid && cellSize > 3 ? 0.5 : 0;
        for (let y = 0; y < game.height; y++) {
            for (let x = 0; x < game.width; x++) {
                if (game.get(x, y)) {
                    ctx.fillRect(
                        x * cellSize + pad, y * cellSize + pad,
                        cellSize - pad * 2, cellSize - pad * 2
                    );
                }
            }
        }
    }

    getCellAt(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((clientX - rect.left) * scaleX / this.cellSize);
        const y = Math.floor((clientY - rect.top) * scaleY / this.cellSize);
        if (x >= 0 && x < this.game.width && y >= 0 && y < this.game.height) {
            return { x, y };
        }
        return null;
    }
}

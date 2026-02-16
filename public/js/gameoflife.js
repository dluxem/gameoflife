/* Cell type constants */
const CELL_DEAD = 0;
const CELL_HERBIVORE = 1;
const CELL_SYMBIOTE = 2;

/* Game mode constants */
const GAME_MODE_CLASSIC = 0;
const GAME_MODE_SYMBIOTIC = 1;

class GameOfLife {
    constructor(width, height, grid, gameMode = GAME_MODE_CLASSIC) {
        this.width = width;
        this.height = height;
        this.grid = grid ? new Uint8Array(grid) : new Uint8Array(width * height);
        this.gameMode = gameMode;
    }

    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.grid[y * this.width + x];
    }

    set(x, y, value) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.grid[y * this.width + x] = value;
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
                    if (this.grid[ny * this.width + nx]) count++;
                }
            }
        }
        return count;
    }

    countNeighborsByType(x, y) {
        let herbivore = 0, symbiote = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const v = this.grid[ny * this.width + nx];
                    if (v === CELL_HERBIVORE) herbivore++;
                    else if (v === CELL_SYMBIOTE) symbiote++;
                }
            }
        }
        return { total: herbivore + symbiote, herbivore, symbiote };
    }

    step() {
        if (this.gameMode === GAME_MODE_SYMBIOTIC) {
            this._stepSymbiotic();
        } else {
            this._stepClassic();
        }
    }

    _stepClassic() {
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

    _stepSymbiotic() {
        const next = new Uint8Array(this.width * this.height);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y * this.width + x];
                const n = this.countNeighborsByType(x, y);

                if (cell === CELL_HERBIVORE) {
                    // Survives with 2-3 neighbors (any living type)
                    // OR 1-3 neighbors if at least one symbiote neighbor
                    const minSurvive = n.symbiote > 0 ? 1 : 2;
                    if (n.total >= minSurvive && n.total <= 3) {
                        next[y * this.width + x] = CELL_HERBIVORE;
                    }
                } else if (cell === CELL_SYMBIOTE) {
                    // Survives with at least 1 herbivore neighbor and fewer than 4 symbiote neighbors
                    if (n.herbivore >= 1 && n.symbiote < 4) {
                        next[y * this.width + x] = CELL_SYMBIOTE;
                    }
                } else {
                    // Dead cell — check for birth
                    // Herbivore born: exactly 3 herbivore neighbors
                    if (n.herbivore === 3) {
                        next[y * this.width + x] = CELL_HERBIVORE;
                    }
                    // Symbiote born: exactly 2 symbiote neighbors + at least 1 herbivore neighbor
                    else if (n.symbiote === 2 && n.herbivore >= 1) {
                        next[y * this.width + x] = CELL_SYMBIOTE;
                    }
                }
            }
        }
        this.grid = next;
    }

    population() {
        let count = 0;
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i]) count++;
        }
        return count;
    }

    populationByType() {
        let herbivore = 0, symbiote = 0;
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === CELL_HERBIVORE) herbivore++;
            else if (this.grid[i] === CELL_SYMBIOTE) symbiote++;
        }
        return { herbivore, symbiote };
    }

    clear() { this.grid.fill(0); }

    randomize(density = 0.3) {
        if (this.gameMode === GAME_MODE_SYMBIOTIC) {
            this._randomizeSymbiotic();
        } else {
            for (let i = 0; i < this.grid.length; i++) {
                this.grid[i] = Math.random() < density ? 1 : 0;
            }
        }
    }

    _randomizeSymbiotic() {
        // Place herbivores at ~25% density
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = Math.random() < 0.25 ? CELL_HERBIVORE : CELL_DEAD;
        }
        // Place symbiotes at ~8% density, only adjacent to herbivores
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y * this.width + x] !== CELL_DEAD) continue;
                if (Math.random() >= 0.08) continue;
                // Check if any neighbor is a herbivore
                let hasHost = false;
                for (let dy = -1; dy <= 1 && !hasHost; dy++) {
                    for (let dx = -1; dx <= 1 && !hasHost; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                            if (this.grid[ny * this.width + nx] === CELL_HERBIVORE) hasHost = true;
                        }
                    }
                }
                if (hasHost) this.grid[y * this.width + x] = CELL_SYMBIOTE;
            }
        }
    }

    invert() {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = this.grid[i] ? 0 : 1;
        }
    }

    clone() {
        const c = new GameOfLife(this.width, this.height, this.grid, this.gameMode);
        return c;
    }
}

class GameRenderer {
    constructor(canvas, game, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.cellSize = options.cellSize || this._calcCellSize(options.maxWidth || 800);
        this.colorAlive = options.colorAlive || '#39ff14';
        this.colorSymbiote = options.colorSymbiote || '#00e5ff';
        this.colorDead = options.colorDead || '#181830';
        this.colorGrid = options.colorGrid || '#3a3a5c';
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

        const pad = this.showGrid && cellSize > 3 ? 0.5 : 0;
        for (let y = 0; y < game.height; y++) {
            for (let x = 0; x < game.width; x++) {
                const v = game.get(x, y);
                if (v === CELL_HERBIVORE) {
                    ctx.fillStyle = this.colorAlive;
                    ctx.fillRect(
                        x * cellSize + pad, y * cellSize + pad,
                        cellSize - pad * 2, cellSize - pad * 2
                    );
                } else if (v === CELL_SYMBIOTE) {
                    ctx.fillStyle = this.colorSymbiote;
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

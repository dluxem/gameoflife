/* Cell type constants */
const CELL_DEAD = 0;
const CELL_GRAZER = 1;
const CELL_HUNTER = 2;
/* const CELL_APEX = 3; */   // reserved for a future third species (apex predator)

/* Game mode constants */
const GAME_MODE_CLASSIC = 0;
const GAME_MODE_PREDATOR = 1;
/* game-mode nibble values 2+ are reserved for future ecosystems */

class GameOfLife {
    static defaultRules() {
        return {
            /*
             * Grazer (green) — the prey, modelled as a space-filling "tissue".
             * It readily regrows into bare ground (low birth threshold, wide
             * survival range), so the gaps the hunters carve get refilled. That
             * constant supply of fresh prey is what keeps the predator/prey waves
             * from starving out and freezing the way strict Conway does.
             */
            grazerBirthMin: 2,      // empty cell becomes grazer with this many...
            grazerBirthMax: 8,      // ...to this many grazer neighbors
            grazerSurviveMin: 2,    // grazer survives with this many...
            grazerSurviveMax: 8,    // ...to this many grazer neighbors

            /* Predation — hunters convert the grazers they surround into new hunters. */
            huntMin: 3,             // a grazer with >= this many hunter neighbors is
                                    // caught and becomes a hunter next tick

            /* Hunter (cyan) — the predator. Cannot live without grazer prey. */
            hunterStarveMinHost: 1, // hunter starves (dies) below this many
                                    // grazer neighbors
            hunterOvercrowdMax: 4,  // hunter dies of competition with this many or more
                                    // hunter neighbors (keeps fronts thin and moving)
            hunterBirthMin: 2,      // empty cell becomes hunter with this many...
            hunterBirthMax: 3,      // ...to this many hunter neighbors,
            hunterBirthMinHost: 1,  // ...and at least this many grazer neighbors (food)
        };
    }

    constructor(width, height, grid, gameMode = GAME_MODE_CLASSIC) {
        this.width = width;
        this.height = height;
        this.grid = grid ? new Uint8Array(grid) : new Uint8Array(width * height);
        this.gameMode = gameMode;
        this.rules = GameOfLife.defaultRules();
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
        let grazer = 0, hunter = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const v = this.grid[ny * this.width + nx];
                    if (v === CELL_GRAZER) grazer++;
                    else if (v === CELL_HUNTER) hunter++;
                }
            }
        }
        return { total: grazer + hunter, grazer, hunter };
    }

    step() {
        if (this.gameMode === GAME_MODE_PREDATOR) {
            this._stepPredator();
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

    /*
     * Predator mode is a predator/prey system, not a mutualism. The coupling runs
     * in both directions and is deliberately unstable, which is what produces
     * travelling fronts and boom/bust cycles instead of the static still-lifes
     * that mutualism (or plain Conway) settles into:
     *
     *   - Grazers (green) grow into empty space by Conway's rules.
     *   - Hunters (cyan) cannot reproduce on their own; they spread by CONVERTING
     *     adjacent grazers, turning prey biomass into more predators.
     *   - A hunter with no grazer neighbour STARVES, so the pack dies back once it
     *     has eaten out a region, leaving bare space the grazers regrow into. That
     *     prey -> hunted -> empty -> regrown loop is an excitable medium: it
     *     sustains spiral/ring waves rather than freezing.
     *   - Hunters also die when packed too tightly, so they can never settle into a
     *     solid sterile block; the pack is forced to keep moving toward fresh prey.
     */
    _stepPredator() {
        const next = new Uint8Array(this.width * this.height);
        const r = this.rules;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                const cell = this.grid[idx];
                const n = this.countNeighborsByType(x, y);

                if (cell === CELL_GRAZER) {
                    if (n.hunter >= r.huntMin) {
                        next[idx] = CELL_HUNTER;              // caught by the pack
                    } else if (n.grazer >= r.grazerSurviveMin && n.grazer <= r.grazerSurviveMax) {
                        next[idx] = CELL_GRAZER;              // Conway survival
                    }                                         // else: dies of over/under-population
                } else if (cell === CELL_HUNTER) {
                    if (n.grazer >= r.hunterStarveMinHost && n.hunter < r.hunterOvercrowdMax) {
                        next[idx] = CELL_HUNTER;              // fed and uncrowded -> persists
                    }                                         // else: starves or overcrowds
                } else {
                    if (n.grazer >= r.grazerBirthMin && n.grazer <= r.grazerBirthMax) {
                        next[idx] = CELL_GRAZER;              // prey colonises empty space first
                    } else if (n.hunter >= r.hunterBirthMin && n.hunter <= r.hunterBirthMax
                               && n.grazer >= r.hunterBirthMinHost) {
                        next[idx] = CELL_HUNTER;              // pack seeds next to its prey
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
        let grazer = 0, hunter = 0;
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === CELL_GRAZER) grazer++;
            else if (this.grid[i] === CELL_HUNTER) hunter++;
        }
        return { grazer, hunter };
    }

    clear() { this.grid.fill(0); }

    randomize(density = 0.3) {
        if (this.gameMode === GAME_MODE_PREDATOR) {
            this._randomizePredator();
        } else {
            for (let i = 0; i < this.grid.length; i++) {
                this.grid[i] = Math.random() < density ? 1 : 0;
            }
        }
    }

    _randomizePredator() {
        // A field of grazers (prey) at moderate density...
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = Math.random() < 0.34 ? CELL_GRAZER : CELL_DEAD;
        }
        // ...plus a handful of small hunter "packs". Each pack is a 2x2 cluster so
        // the hunters already meet their birth/hunt thresholds and start a spreading
        // wave, instead of sitting inert as isolated dots.
        const packs = Math.max(3, Math.round((this.width * this.height) / 400));
        for (let f = 0; f < packs; f++) {
            const cx = Math.floor(Math.random() * (this.width - 1));
            const cy = Math.floor(Math.random() * (this.height - 1));
            for (let dy = 0; dy <= 1; dy++) {
                for (let dx = 0; dx <= 1; dx++) {
                    this.set(cx + dx, cy + dy, CELL_HUNTER);
                }
            }
        }
    }

    /*
     * A deterministic "interesting" starting board for predator mode: a field of
     * grazers carrying two counter-rotating broken waves. Each wave is a line of
     * hunters (excited) trailed by a short strip of bare ground (refractory); the
     * free end of a broken wave curls into a spiral, so on play the pair seeds the
     * whole board with sustained predator/prey waves. The two waves are offset by
     * one cell to avoid perfect symmetry. Used as the editor's opening pattern.
     */
    seedShowcase() {
        this.grid.fill(CELL_GRAZER);
        const my = this.height >> 1;
        const xm = this.width >> 1;
        for (let x = 0; x < xm; x++) {                 // upper wave, travels right
            this.set(x, my, CELL_HUNTER);
            this.set(x, my - 1, CELL_DEAD);
            this.set(x, my - 2, CELL_DEAD);
        }
        for (let x = xm + 1; x < this.width; x++) {    // lower wave, travels left
            this.set(x, my + 1, CELL_HUNTER);
            this.set(x, my + 2, CELL_DEAD);
            this.set(x, my + 3, CELL_DEAD);
        }
    }

    invert() {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = this.grid[i] ? 0 : 1;
        }
    }

    clone() {
        const c = new GameOfLife(this.width, this.height, this.grid, this.gameMode);
        c.rules = Object.assign({}, this.rules);
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
        this.colorHunter = options.colorHunter || '#00e5ff';
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
                if (v === CELL_GRAZER) {
                    ctx.fillStyle = this.colorAlive;
                    ctx.fillRect(
                        x * cellSize + pad, y * cellSize + pad,
                        cellSize - pad * 2, cellSize - pad * 2
                    );
                } else if (v === CELL_HUNTER) {
                    ctx.fillStyle = this.colorHunter;
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

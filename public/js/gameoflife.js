/* Cell type constants */
const CELL_DEAD = 0;
const CELL_GRAZER = 1;
const CELL_HUNTER = 2;
const CELL_APEX = 3;

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

            /*
             * Apex (red) — the top predator, one trophic level above the hunter.
             * It preys on hunters the way hunters prey on grazers: a hunter
             * surrounded by enough apex cells is caught and converted. With no
             * predator of its own, the apex is the one species robust enough to
             * settle down — among its own kind it follows Conway's Life exactly
             * (survive 2-3, born on 3, die otherwise). That gives it the full
             * Conway repertoire — a 2x2 apex block is a permanent still-life,
             * three in a row is a blinker, the glider crawls — so deliberate
             * stable (and oscillating) patterns are possible. Conway's own
             * overpopulation rule keeps apex from ever solidifying into a board-
             * filling mass, so the grazer/hunter waves keep churning underneath.
             */
            apexHuntMin: 3,         // a hunter with >= this many apex neighbors is
                                    // caught and becomes apex next tick
            apexSurviveMin: 2,      // apex survives with this many...
            apexSurviveMax: 3,      // ...to this many apex neighbors (Conway band)
            apexBirthMin: 3,        // empty cell becomes apex with this many...
            apexBirthMax: 3,        // ...to this many apex neighbors (Conway birth)

            /*
             * Predatory spread: next to hunter prey the apex also seeds at the
             * lower count of 2 apex neighbors (apexHuntBirthMin), the way hunters
             * seed beside grazers. This only fires when a hunter host is adjacent,
             * so an isolated apex colony still obeys pure Conway and stays a
             * still-life — but a colony sitting next to a field of hunters pushes
             * into it and consumes it. That is what keeps the apex a persistent,
             * active top predator instead of a transient that leaves one block.
             */
            apexHuntBirthMin: 2,    // beside a hunter host, empty cell becomes apex
                                    // with this many apex neighbors (<= Conway birth)
            apexBirthMinHost: 1,    // ...requiring at least this many hunter hosts
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
        let grazer = 0, hunter = 0, apex = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const v = this.grid[ny * this.width + nx];
                    if (v === CELL_GRAZER) grazer++;
                    else if (v === CELL_HUNTER) hunter++;
                    else if (v === CELL_APEX) apex++;
                }
            }
        }
        return { total: grazer + hunter + apex, grazer, hunter, apex };
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
     *   - Apex (red) sit one level higher again: they CONVERT adjacent hunters into
     *     more apex, just as hunters convert grazers. Having no predator of their
     *     own, apex don't starve or overcrowd-to-extinction on contact — among
     *     themselves they run plain Conway's Life, so they can consolidate into
     *     stable still-lifes and oscillators once an area is cleared, while Conway
     *     overpopulation stops them from ever filling the board.
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
                    if (n.apex >= r.apexHuntMin) {
                        next[idx] = CELL_APEX;               // caught by the apex pack
                    } else if (n.grazer >= r.hunterStarveMinHost && n.hunter < r.hunterOvercrowdMax) {
                        next[idx] = CELL_HUNTER;              // fed and uncrowded -> persists
                    }                                         // else: starves or overcrowds
                } else if (cell === CELL_APEX) {
                    if (n.apex >= r.apexSurviveMin && n.apex <= r.apexSurviveMax) {
                        next[idx] = CELL_APEX;               // Conway survival among apex
                    }                                         // else: under/over-population
                } else {
                    // Apex births are resolved first. They only ever fire next to
                    // existing apex, so this can't invade open grazer territory, but
                    // it stops grazers from stealing the empty cells the apex needs to
                    // reform into stable still-lifes — without this the apex's Conway
                    // structures never consolidate amid grazers and it dies out.
                    if (n.apex >= r.apexBirthMin && n.apex <= r.apexBirthMax) {
                        next[idx] = CELL_APEX;               // apex reproduces by Conway birth
                    } else if (n.apex >= r.apexHuntBirthMin && n.apex <= r.apexBirthMax
                               && n.hunter >= r.apexBirthMinHost) {
                        next[idx] = CELL_APEX;               // apex pushes into adjacent prey
                    } else if (n.grazer >= r.grazerBirthMin && n.grazer <= r.grazerBirthMax) {
                        next[idx] = CELL_GRAZER;             // prey colonises empty space
                    } else if (n.hunter >= r.hunterBirthMin && n.hunter <= r.hunterBirthMax
                               && n.grazer >= r.hunterBirthMinHost) {
                        next[idx] = CELL_HUNTER;             // pack seeds next to its prey
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
        let grazer = 0, hunter = 0, apex = 0;
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === CELL_GRAZER) grazer++;
            else if (this.grid[i] === CELL_HUNTER) hunter++;
            else if (this.grid[i] === CELL_APEX) apex++;
        }
        return { grazer, hunter, apex };
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
        // ...and a few apex "broods". Each is an R-pentomino — a tiny but famously
        // long-lived Conway pattern — so the apex doesn't sit inert: it churns and
        // expands for hundreds of generations, plowing through hunter packs and
        // converting them, before finally settling into stable apex still-lifes.
        // Each brood gets a small cleared nursery so its Conway ignition isn't
        // smothered by the surrounding grazer tissue before it can establish.
        const broods = Math.max(3, Math.round((this.width * this.height) / 800));
        const R_PENTOMINO = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]];
        for (let b = 0; b < broods; b++) {
            const cx = Math.floor(Math.random() * (this.width - 2));
            const cy = Math.floor(Math.random() * (this.height - 2));
            for (let dy = -2; dy <= 4; dy++) {
                for (let dx = -2; dx <= 4; dx++) {
                    this.set(cx + dx, cy + dy, CELL_DEAD);
                }
            }
            for (const [dx, dy] of R_PENTOMINO) {
                this.set(cx + dx, cy + dy, CELL_APEX);
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
        this.colorApex = options.colorApex || '#ff2d6b';
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
                } else if (v === CELL_APEX) {
                    ctx.fillStyle = this.colorApex;
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

(function () {
    let width = 30;
    let height = 30;
    let gameMode = GAME_MODE_CLASSIC;

    // If there's a hash code, load it as a starting point
    const hash = decodeURIComponent(window.location.hash.slice(1));
    let game;
    if (hash) {
        try {
            const data = MapCodec.decode(hash);
            width = data.width;
            height = data.height;
            gameMode = data.gameMode || GAME_MODE_CLASSIC;
            game = new GameOfLife(width, height, data.grid, gameMode);
            document.getElementById('mapWidth').value = width;
            document.getElementById('mapHeight').value = height;
        } catch (_) {
            game = new GameOfLife(width, height, undefined, gameMode);
        }
    } else {
        // Fresh visit: start with an empty board in Classic mode. Switch to
        // Predator with the MODE buttons; the board stays empty until you draw
        // cells or press RANDOM.
        width = 50;
        height = 34;
        gameMode = GAME_MODE_CLASSIC;
        game = new GameOfLife(width, height, undefined, gameMode);
        document.getElementById('mapWidth').value = width;
        document.getElementById('mapHeight').value = height;
    }

    const canvas = document.getElementById('editCanvas');
    let renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
    renderer.render();

    let isDrawing = false;
    let drawValue = null; // cell type to paint (0 = erase, 1 = grazer, 2 = hunter, 3 = apex)
    let drawCellType = CELL_GRAZER; // selected draw tool

    // Playback state
    let playing = false;
    let animId = null;
    let lastStep = 0;
    let gen = 0;
    let speed = 10;
    let snapshot = null; // saved grid state for reset

    const btnPlay = document.getElementById('btnPlay');
    const btnStep = document.getElementById('btnStep');
    const btnReset = document.getElementById('btnReset');
    const btnInvert = document.getElementById('btnInvert');
    const genCount = document.getElementById('genCount');
    const popCount = document.getElementById('popCount');
    const popBreakdown = document.getElementById('popBreakdown');
    const speedInput = document.getElementById('speed');
    const speedLabel = document.getElementById('speedLabel');
    const cellTypeSelector = document.getElementById('cellTypeSelector');
    const rulesContent = document.getElementById('rulesContent');

    function updateCounters() {
        genCount.textContent = gen;
        if (gameMode === GAME_MODE_PREDATOR) {
            const pop = game.populationByType();
            popCount.textContent = pop.grazer + pop.hunter + pop.apex;
            popBreakdown.innerHTML =
                ' (<span class="pop-grazer">' + pop.grazer + 'G</span>' +
                ' <span class="pop-hunter">' + pop.hunter + 'H</span>' +
                ' <span class="pop-apex">' + pop.apex + 'A</span>)';
        } else {
            popCount.textContent = game.population();
            popBreakdown.innerHTML = '';
        }
    }
    updateCounters();

    function isEditMode() {
        return !playing && gen === 0;
    }

    // --- Game mode selector ---
    const modeBtns = document.querySelectorAll('.mode-btn');

    function setGameMode(newMode, init) {
        if (!init && !isEditMode()) return;
        if (!init && newMode === gameMode) return;

        gameMode = newMode;
        game.gameMode = gameMode;

        // Strip predator-only cells (hunter + apex) when switching to classic
        if (!init && gameMode === GAME_MODE_CLASSIC) {
            for (let i = 0; i < game.grid.length; i++) {
                if (game.grid[i] === CELL_HUNTER || game.grid[i] === CELL_APEX) {
                    game.grid[i] = CELL_DEAD;
                }
            }
        }

        // Update mode button styles
        modeBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.mode) === gameMode);
        });

        // Show/hide cell type selector
        cellTypeSelector.classList.toggle('hidden', gameMode !== GAME_MODE_PREDATOR);

        // Show/hide invert button (not useful in predator mode)
        if (btnInvert) btnInvert.classList.toggle('hidden', gameMode === GAME_MODE_PREDATOR);

        // Reset draw type to grazer
        drawCellType = CELL_GRAZER;
        updateCellTypeBtns();

        updateRulesDisplay();
        renderer.render();
        updateCounters();
    }

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setGameMode(parseInt(btn.dataset.mode));
        });
    });

    // --- Cell type selector ---
    const cellTypeBtns = document.querySelectorAll('.cell-type-btn');

    function updateCellTypeBtns() {
        cellTypeBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.type) === drawCellType);
        });
    }

    cellTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            drawCellType = parseInt(btn.dataset.type);
            updateCellTypeBtns();
        });
    });

    // --- Rules display ---
    function rangeText(min, max) {
        return min === max ? String(min) : min + '-' + max;
    }

    function updateRulesDisplay() {
        if (gameMode === GAME_MODE_PREDATOR) {
            const r = game.rules;
            const grazerRange = rangeText(r.grazerBirthMin, r.grazerBirthMax);
            const hunterSpread = rangeText(r.hunterBirthMin, r.hunterBirthMax);
            const apexSurvive = rangeText(r.apexSurviveMin, r.apexSurviveMax);
            rulesContent.innerHTML =
                '<ul class="rules-list">' +
                '<li><span class="grazer">GRAZER</span> &mdash; prey. Grows &amp; lives on <span class="hl">' + grazerRange + '</span> grazers.</li>' +
                '<li><span class="hunter">HUNTER</span> &mdash; predator. Converts grazers touched by <span class="hl">' + r.huntMin + '+</span>.</li>' +
                '<li>Starves with no grazer; dies if <span class="hl">' + r.hunterOvercrowdMax + '+</span> crowd.</li>' +
                '<li>Spreads on bare ground: <span class="hl">' + hunterSpread + '</span> by a host.</li>' +
                '<li><span class="apex">APEX</span> &mdash; top predator. Converts hunters touched by <span class="hl">' + r.apexHuntMin + '+</span>.</li>' +
                '<li>Runs Conway among apex (survive <span class="hl">' + apexSurvive + '</span>), so it can form stable patterns.</li>' +
                '</ul>';
        } else {
            rulesContent.innerHTML =
                '<ul class="rules-list">' +
                '<li>Live cell with <span class="hl">2&ndash;3</span> neighbors survives.</li>' +
                '<li>Dead cell with exactly <span class="hl">3</span> is born.</li>' +
                '<li>All others die.</li>' +
                '</ul>';
        }
    }

    // --- Edit toolbar ---
    document.getElementById('btnClear').addEventListener('click', () => {
        if (!isEditMode()) return;
        game.clear();
        renderer.render();
        updateCounters();
    });

    document.getElementById('btnRandom').addEventListener('click', () => {
        if (!isEditMode()) return;
        game.randomize();
        renderer.render();
        updateCounters();
    });

    btnInvert.addEventListener('click', () => {
        if (!isEditMode()) return;
        game.invert();
        renderer.render();
        updateCounters();
    });

    document.getElementById('btnApplySize').addEventListener('click', () => {
        if (!isEditMode()) return;
        const newW = parseInt(document.getElementById('mapWidth').value, 10);
        const newH = parseInt(document.getElementById('mapHeight').value, 10);
        if (newW >= 3 && newW <= 160 && newH >= 3 && newH <= 160) {
            width = newW;
            height = newH;
            game = new GameOfLife(width, height, undefined, gameMode);
            renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
            renderer.render();
            updateCounters();
        }
    });

    // --- Drawing on canvas ---
    function handleDraw(e) {
        if (!isEditMode()) return;
        const pos = renderer.getCellAt(e.clientX, e.clientY);
        if (!pos) return;
        game.set(pos.x, pos.y, drawValue);
        renderer.render();
        updateCounters();
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!isEditMode()) return;
        const pos = renderer.getCellAt(e.clientX, e.clientY);
        if (!pos) return;
        const current = game.get(pos.x, pos.y);
        if (gameMode === GAME_MODE_PREDATOR) {
            // If cell matches the selected draw type, erase it; otherwise place selected type
            drawValue = (current === drawCellType) ? CELL_DEAD : drawCellType;
        } else {
            drawValue = current ? 0 : 1;
        }
        isDrawing = true;
        handleDraw(e);
    });
    canvas.addEventListener('mousemove', (e) => { if (isDrawing) handleDraw(e); });
    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    canvas.addEventListener('mouseleave', () => { isDrawing = false; });

    canvas.addEventListener('touchstart', (e) => {
        if (!isEditMode()) return;
        e.preventDefault();
        const fakeEvent = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        const pos = renderer.getCellAt(fakeEvent.clientX, fakeEvent.clientY);
        if (!pos) return;
        const current = game.get(pos.x, pos.y);
        if (gameMode === GAME_MODE_PREDATOR) {
            drawValue = (current === drawCellType) ? CELL_DEAD : drawCellType;
        } else {
            drawValue = current ? 0 : 1;
        }
        isDrawing = true;
        handleDraw(fakeEvent);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); if (!isDrawing) return;
        handleDraw({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    canvas.addEventListener('touchend', () => { isDrawing = false; });

    // --- Speed control ---
    speedInput.addEventListener('input', () => {
        speed = parseInt(speedInput.value, 10);
        speedLabel.textContent = speed;
    });

    // --- Playback controls ---
    function playLoop(timestamp) {
        if (!playing) return;
        if (timestamp - lastStep >= 1000 / speed) {
            game.step();
            gen++;
            updateCounters();
            renderer.render();
            lastStep = timestamp;
        }
        animId = requestAnimationFrame(playLoop);
    }

    btnPlay.addEventListener('click', () => {
        if (playing) {
            // Stop
            playing = false;
            if (animId) cancelAnimationFrame(animId);
            btnPlay.textContent = 'PLAY';
        } else {
            // Start playing — snapshot on first play from edit mode
            if (gen === 0) {
                snapshot = game.clone();
            }
            playing = true;
            btnPlay.textContent = 'STOP';
            lastStep = performance.now();
            animId = requestAnimationFrame(playLoop);
        }
    });

    btnStep.addEventListener('click', () => {
        if (playing) return;
        if (gen === 0) {
            snapshot = game.clone();
        }
        game.step();
        gen++;
        updateCounters();
        renderer.render();
    });

    btnReset.addEventListener('click', () => {
        playing = false;
        if (animId) cancelAnimationFrame(animId);
        btnPlay.textContent = 'PLAY';
        if (snapshot) {
            game = snapshot.clone();
            renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
            snapshot = null;
        }
        gen = 0;
        updateCounters();
        renderer.render();
    });

    // --- Share modal ---
    const shareModal = document.getElementById('shareModal');
    const shareResult = document.getElementById('shareResult');

    function closeShareModal() {
        shareModal.classList.add('hidden');
    }

    document.getElementById('btnCloseShare').addEventListener('click', closeShareModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !shareModal.classList.contains('hidden')) {
            closeShareModal();
        }
    });

    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) closeShareModal();
    });

    document.getElementById('btnShare').addEventListener('click', () => {
        // If running or stepped, use the snapshot (original drawing) for sharing
        const shareGame = snapshot || game;
        if (shareGame.population() === 0) {
            shareResult.innerHTML = '<p class="share-error">DRAW SOME CELLS FIRST</p>';
            shareModal.classList.remove('hidden');
            return;
        }

        const code = MapCodec.encode(shareGame.width, shareGame.height, shareGame.grid, shareGame.gameMode);
        const url = window.location.origin + '/play.html#' + encodeURIComponent(code);

        shareResult.innerHTML =
            '<div class="result-row"><span>MAP CODE:</span> ' +
            '<button class="arcade-btn small copy-btn" data-target="shareCodeBox">COPY</button></div>' +
            '<textarea id="shareCodeBox" class="arcade-input code-box" rows="3" readonly>' + escapeHtml(code) + '</textarea>' +
            '<div class="result-row"><span>URL:</span> ' +
            '<button class="arcade-btn small copy-btn" data-target="shareUrlBox">COPY</button></div>' +
            '<textarea id="shareUrlBox" class="arcade-input code-box" rows="3" readonly>' + escapeHtml(url) + '</textarea>';

        shareResult.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                navigator.clipboard.writeText(target.value).then(() => {
                    const orig = btn.textContent;
                    btn.textContent = 'COPIED!';
                    setTimeout(() => { btn.textContent = orig; }, 1500);
                });
            });
        });

        shareModal.classList.remove('hidden');
    });

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    // --- Initialize UI state from loaded game mode ---
    setGameMode(gameMode, true);
})();

(function () {
    let width = 30;
    let height = 30;

    // If there's a hash code, load it as a starting point (fork)
    const hash = decodeURIComponent(window.location.hash.slice(1));
    let game;
    if (hash) {
        try {
            const data = MapCodec.decode(hash);
            width = data.width;
            height = data.height;
            game = new GameOfLife(width, height, data.grid);
            document.getElementById('mapWidth').value = width;
            document.getElementById('mapHeight').value = height;
        } catch (_) {
            game = new GameOfLife(width, height);
        }
    } else {
        game = new GameOfLife(width, height);
    }

    const canvas = document.getElementById('editCanvas');
    let renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
    renderer.render();

    let isDrawing = false;
    let drawValue = null; // 1 = activating, 0 = deactivating (set on mousedown)

    // Playback state
    let playing = false;
    let animId = null;
    let lastStep = 0;
    let gen = 0;
    let snapshot = null; // saved grid state for reset

    const btnPlay = document.getElementById('btnPlay');
    const btnStep = document.getElementById('btnStep');
    const btnReset = document.getElementById('btnReset');
    const genCount = document.getElementById('genCount');

    function isEditMode() {
        return !playing && gen === 0;
    }

    // --- Edit toolbar ---
    document.getElementById('btnClear').addEventListener('click', () => {
        if (!isEditMode()) return;
        game.clear();
        renderer.render();
    });

    document.getElementById('btnRandom').addEventListener('click', () => {
        if (!isEditMode()) return;
        game.randomize();
        renderer.render();
    });

    document.getElementById('btnInvert').addEventListener('click', () => {
        if (!isEditMode()) return;
        game.invert();
        renderer.render();
    });

    document.getElementById('btnApplySize').addEventListener('click', () => {
        if (!isEditMode()) return;
        const newW = parseInt(document.getElementById('mapWidth').value, 10);
        const newH = parseInt(document.getElementById('mapHeight').value, 10);
        if (newW >= 3 && newW <= 160 && newH >= 3 && newH <= 160) {
            width = newW;
            height = newH;
            game = new GameOfLife(width, height);
            renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
            renderer.render();
        }
    });

    // --- Drawing on canvas — click toggles, drag continues in same mode ---
    function handleDraw(e) {
        if (!isEditMode()) return;
        const pos = renderer.getCellAt(e.clientX, e.clientY);
        if (!pos) return;
        game.set(pos.x, pos.y, drawValue);
        renderer.render();
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!isEditMode()) return;
        const pos = renderer.getCellAt(e.clientX, e.clientY);
        if (!pos) return;
        drawValue = game.get(pos.x, pos.y) ? 0 : 1;
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
        drawValue = game.get(pos.x, pos.y) ? 0 : 1;
        isDrawing = true;
        handleDraw(fakeEvent);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); if (!isDrawing) return;
        handleDraw({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    canvas.addEventListener('touchend', () => { isDrawing = false; });

    // --- Playback controls ---
    function playLoop(timestamp) {
        if (!playing) return;
        if (timestamp - lastStep >= 100) {
            game.step();
            gen++;
            genCount.textContent = gen;
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
        genCount.textContent = gen;
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
        genCount.textContent = '0';
        renderer.render();
    });

    // --- Share ---
    document.getElementById('btnShare').addEventListener('click', () => {
        // If running or stepped, use the snapshot (original drawing) for sharing
        const shareGame = snapshot || game;
        const resultEl = document.getElementById('saveResult');
        if (shareGame.population() === 0) {
            resultEl.className = 'save-result error';
            resultEl.textContent = 'DRAW SOME CELLS FIRST';
            return;
        }

        const code = MapCodec.encode(shareGame.width, shareGame.height, shareGame.grid);
        const url = window.location.origin + '/play.html#' + encodeURIComponent(code);

        resultEl.className = 'save-result success';
        resultEl.innerHTML =
            '<div class="result-row"><span>MAP CODE:</span> ' +
            '<button class="arcade-btn small copy-btn" data-target="saveCodeBox">COPY</button></div>' +
            '<textarea id="saveCodeBox" class="arcade-input code-box" rows="3" readonly>' + escapeHtml(code) + '</textarea>' +
            '<div class="result-row"><span>URL:</span> ' +
            '<button class="arcade-btn small copy-btn" data-target="saveUrlBox">COPY</button></div>' +
            '<textarea id="saveUrlBox" class="arcade-input code-box" rows="3" readonly>' + escapeHtml(url) + '</textarea>';

        resultEl.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                navigator.clipboard.writeText(target.value).then(() => {
                    const orig = btn.textContent;
                    btn.textContent = 'COPIED!';
                    setTimeout(() => { btn.textContent = orig; }, 1500);
                });
            });
        });
    });

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
})();

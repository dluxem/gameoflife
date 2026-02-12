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

    let currentTool = 'draw';
    let isDrawing = false;

    // Tool buttons
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTool = btn.dataset.tool;
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    document.getElementById('btnClear').addEventListener('click', () => {
        game.clear();
        renderer.render();
    });

    document.getElementById('btnRandom').addEventListener('click', () => {
        game.randomize();
        renderer.render();
    });

    document.getElementById('btnInvert').addEventListener('click', () => {
        game.invert();
        renderer.render();
    });

    document.getElementById('btnApplySize').addEventListener('click', () => {
        const newW = parseInt(document.getElementById('mapWidth').value, 10);
        const newH = parseInt(document.getElementById('mapHeight').value, 10);
        if (newW >= 3 && newW <= 256 && newH >= 3 && newH <= 256) {
            width = newW;
            height = newH;
            game = new GameOfLife(width, height);
            renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
            renderer.render();
        }
    });

    // Drawing on canvas
    function handleDraw(e) {
        const pos = renderer.getCellAt(e.clientX, e.clientY);
        if (!pos) return;
        if (currentTool === 'draw') {
            game.set(pos.x, pos.y, 1);
        } else {
            game.set(pos.x, pos.y, 0);
        }
        renderer.render();
    }

    canvas.addEventListener('mousedown', (e) => { isDrawing = true; handleDraw(e); });
    canvas.addEventListener('mousemove', (e) => { if (isDrawing) handleDraw(e); });
    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    canvas.addEventListener('mouseleave', () => { isDrawing = false; });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); isDrawing = true;
        handleDraw({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); if (!isDrawing) return;
        handleDraw({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    canvas.addEventListener('touchend', () => { isDrawing = false; });

    // Save
    document.getElementById('btnSave').addEventListener('click', () => {
        const resultEl = document.getElementById('saveResult');
        if (game.population() === 0) {
            resultEl.className = 'save-result error';
            resultEl.textContent = 'DRAW SOME CELLS FIRST';
            return;
        }

        const code = MapCodec.encode(game.width, game.height, game.grid);
        const url = window.location.origin + '/play.html#' + encodeURIComponent(code);

        resultEl.className = 'save-result success';
        resultEl.innerHTML =
            '<div class="result-row"><span>MAP CODE:</span> <strong>' + escapeHtml(code) + '</strong> ' +
            '<button class="arcade-btn small copy-btn" data-copy="' + escapeHtml(code) + '">COPY</button></div>' +
            '<div class="result-row"><span>URL:</span> <input type="text" class="arcade-input url-output" value="' + escapeHtml(url) + '" readonly /> ' +
            '<button class="arcade-btn small copy-btn" data-copy="' + escapeHtml(url) + '">COPY</button></div>';

        resultEl.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(btn.dataset.copy).then(() => {
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

    // Preview
    const previewModal = document.getElementById('previewModal');
    const previewCanvas = document.getElementById('previewCanvas');
    let previewGame = null;
    let previewRenderer = null;
    let previewRunning = false;
    let previewAnimId = null;
    let previewGen = 0;
    let previewLastStep = 0;

    document.getElementById('btnPreview').addEventListener('click', () => {
        previewGame = game.clone();
        previewRenderer = new GameRenderer(previewCanvas, previewGame, { maxWidth: 700 });
        previewRenderer.render();
        previewGen = 0;
        document.getElementById('previewGenCount').textContent = '0';
        previewRunning = false;
        document.getElementById('btnPreviewPlay').textContent = 'PLAY';
        previewModal.classList.remove('hidden');
    });

    document.getElementById('btnClosePreview').addEventListener('click', () => {
        previewModal.classList.add('hidden');
        previewRunning = false;
        if (previewAnimId) cancelAnimationFrame(previewAnimId);
    });

    function previewLoop(timestamp) {
        if (!previewRunning) return;
        if (timestamp - previewLastStep >= 100) {
            previewGame.step();
            previewGen++;
            document.getElementById('previewGenCount').textContent = previewGen;
            previewRenderer.render();
            previewLastStep = timestamp;
        }
        previewAnimId = requestAnimationFrame(previewLoop);
    }

    document.getElementById('btnPreviewPlay').addEventListener('click', () => {
        previewRunning = !previewRunning;
        document.getElementById('btnPreviewPlay').textContent = previewRunning ? 'PAUSE' : 'PLAY';
        if (previewRunning) {
            previewLastStep = performance.now();
            previewAnimId = requestAnimationFrame(previewLoop);
        }
    });

    document.getElementById('btnPreviewStep').addEventListener('click', () => {
        if (previewRunning || !previewGame) return;
        previewGame.step();
        previewGen++;
        document.getElementById('previewGenCount').textContent = previewGen;
        previewRenderer.render();
    });

    document.getElementById('btnPreviewReset').addEventListener('click', () => {
        previewRunning = false;
        if (previewAnimId) cancelAnimationFrame(previewAnimId);
        document.getElementById('btnPreviewPlay').textContent = 'PLAY';
        previewGame = game.clone();
        previewRenderer = new GameRenderer(previewCanvas, previewGame, { maxWidth: 700 });
        previewRenderer.render();
        previewGen = 0;
        document.getElementById('previewGenCount').textContent = '0';
    });
})();

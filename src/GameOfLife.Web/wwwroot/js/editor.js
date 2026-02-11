(function () {
    const mapDataEl = document.getElementById('mapData');
    if (!mapDataEl) return;

    const data = JSON.parse(mapDataEl.textContent);
    let width = data.width;
    let height = data.height;
    let game = new GameOfLife(width, height, data.cellData || null);

    const canvas = document.getElementById('editCanvas');
    let renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
    renderer.render();

    let currentTool = 'draw';
    let isDrawing = false;

    // Expose for HTMX save
    window.getEditorCellData = () => game.toCellData();
    window.getEditorWidth = () => game.width;
    window.getEditorHeight = () => game.height;

    // Tool buttons
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTool = btn.dataset.tool;
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const btnClear = document.getElementById('btnClear');
    const btnRandom = document.getElementById('btnRandom');
    const btnInvert = document.getElementById('btnInvert');
    const btnApplySize = document.getElementById('btnApplySize');

    btnClear.addEventListener('click', () => { game.clear(); renderer.render(); });
    btnRandom.addEventListener('click', () => { game.randomize(); renderer.render(); });
    btnInvert.addEventListener('click', () => { game.invert(); renderer.render(); });

    if (btnApplySize) {
        btnApplySize.addEventListener('click', () => {
            const newW = parseInt(document.getElementById('mapWidth').value, 10);
            const newH = parseInt(document.getElementById('mapHeight').value, 10);
            if (newW >= 3 && newW <= 200 && newH >= 3 && newH <= 200) {
                width = newW;
                height = newH;
                game = new GameOfLife(width, height);
                renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
                renderer.render();
            }
        });
    }

    // Drawing on canvas
    function handleDraw(e) {
        const pos = renderer.getCellAt(e.clientX, e.clientY);
        if (!pos) return;
        if (currentTool === 'draw') {
            game.set(pos.x, pos.y, 1);
        } else if (currentTool === 'erase') {
            game.set(pos.x, pos.y, 0);
        }
        renderer.render();
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        handleDraw(e);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) handleDraw(e);
    });

    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    canvas.addEventListener('mouseleave', () => { isDrawing = false; });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDrawing = true;
        const touch = e.touches[0];
        handleDraw({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const touch = e.touches[0];
        handleDraw({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    canvas.addEventListener('touchend', () => { isDrawing = false; });

    // Preview modal
    const previewModal = document.getElementById('previewModal');
    const previewCanvas = document.getElementById('previewCanvas');
    const btnPreview = document.getElementById('btnPreview');
    const btnClosePreview = document.getElementById('btnClosePreview');
    const btnPreviewPlay = document.getElementById('btnPreviewPlay');
    const btnPreviewStep = document.getElementById('btnPreviewStep');
    const btnPreviewReset = document.getElementById('btnPreviewReset');
    const previewGenCount = document.getElementById('previewGenCount');

    let previewGame = null;
    let previewRenderer = null;
    let previewRunning = false;
    let previewAnimId = null;
    let previewGen = 0;
    let previewLastStep = 0;

    btnPreview.addEventListener('click', () => {
        previewGame = game.clone();
        previewRenderer = new GameRenderer(previewCanvas, previewGame, { maxWidth: 700 });
        previewRenderer.render();
        previewGen = 0;
        previewGenCount.textContent = '0';
        previewRunning = false;
        btnPreviewPlay.textContent = 'PLAY';
        previewModal.classList.remove('hidden');
    });

    btnClosePreview.addEventListener('click', () => {
        previewModal.classList.add('hidden');
        previewRunning = false;
        if (previewAnimId) cancelAnimationFrame(previewAnimId);
    });

    function previewLoop(timestamp) {
        if (!previewRunning) return;
        if (timestamp - previewLastStep >= 100) {
            previewGame.step();
            previewGen++;
            previewGenCount.textContent = previewGen;
            previewRenderer.render();
            previewLastStep = timestamp;
        }
        previewAnimId = requestAnimationFrame(previewLoop);
    }

    btnPreviewPlay.addEventListener('click', () => {
        previewRunning = !previewRunning;
        btnPreviewPlay.textContent = previewRunning ? 'PAUSE' : 'PLAY';
        if (previewRunning) {
            previewLastStep = performance.now();
            previewAnimId = requestAnimationFrame(previewLoop);
        }
    });

    btnPreviewStep.addEventListener('click', () => {
        if (previewRunning || !previewGame) return;
        previewGame.step();
        previewGen++;
        previewGenCount.textContent = previewGen;
        previewRenderer.render();
    });

    btnPreviewReset.addEventListener('click', () => {
        previewRunning = false;
        if (previewAnimId) cancelAnimationFrame(previewAnimId);
        btnPreviewPlay.textContent = 'PLAY';
        previewGame = game.clone();
        previewRenderer = new GameRenderer(previewCanvas, previewGame, { maxWidth: 700 });
        previewRenderer.render();
        previewGen = 0;
        previewGenCount.textContent = '0';
    });

    // HTMX save handling
    const btnSave = document.getElementById('btnSave');
    const saveResult = document.getElementById('saveResult');

    btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        const name = document.getElementById('mapName').value.trim();
        if (!name) {
            saveResult.className = 'save-result error';
            saveResult.textContent = 'NAME IS REQUIRED';
            return;
        }

        const body = JSON.stringify({
            name: name,
            width: game.width,
            height: game.height,
            cellData: game.toCellData()
        });

        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['RequestVerificationToken'] = token;

        fetch('/Maps/Edit', {
            method: 'POST',
            headers: headers,
            body: body
        })
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                saveResult.className = 'save-result success';
                saveResult.innerHTML = `SAVED! SHARE CODE: <strong>${result.shareCode}</strong> - <a href="/Maps/Play/${result.shareCode}" class="map-code" style="color:var(--neon-cyan)">PLAY IT</a>`;
            } else {
                saveResult.className = 'save-result error';
                saveResult.textContent = result.message || 'SAVE FAILED';
            }
        })
        .catch(() => {
            saveResult.className = 'save-result error';
            saveResult.textContent = 'SAVE FAILED - NETWORK ERROR';
        });
    });
})();

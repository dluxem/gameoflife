(function () {
    const mapDataEl = document.getElementById('mapData');
    if (!mapDataEl) return;

    const data = JSON.parse(mapDataEl.textContent);
    const game = new GameOfLife(data.width, data.height, data.cellData);
    const initialState = data.cellData;

    const canvas = document.getElementById('gameCanvas');
    const renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
    renderer.render();

    let running = false;
    let animationId = null;
    let generation = 0;
    let speed = 10;
    let lastStepTime = 0;

    const btnPlay = document.getElementById('btnPlay');
    const btnStep = document.getElementById('btnStep');
    const btnReset = document.getElementById('btnReset');
    const speedInput = document.getElementById('speed');
    const speedLabel = document.getElementById('speedLabel');
    const genCount = document.getElementById('genCount');
    const popCount = document.getElementById('popCount');
    const btnCopyCode = document.getElementById('btnCopyCode');

    function updateCounters() {
        genCount.textContent = generation;
        popCount.textContent = game.population();
    }

    function gameLoop(timestamp) {
        if (!running) return;
        const interval = 1000 / speed;
        if (timestamp - lastStepTime >= interval) {
            game.step();
            generation++;
            renderer.render();
            updateCounters();
            lastStepTime = timestamp;
        }
        animationId = requestAnimationFrame(gameLoop);
    }

    btnPlay.addEventListener('click', () => {
        running = !running;
        btnPlay.textContent = running ? 'PAUSE' : 'PLAY';
        btnPlay.classList.toggle('active', running);
        if (running) {
            lastStepTime = performance.now();
            animationId = requestAnimationFrame(gameLoop);
        } else if (animationId) {
            cancelAnimationFrame(animationId);
        }
    });

    btnStep.addEventListener('click', () => {
        if (running) return;
        game.step();
        generation++;
        renderer.render();
        updateCounters();
    });

    btnReset.addEventListener('click', () => {
        running = false;
        btnPlay.textContent = 'PLAY';
        btnPlay.classList.remove('active');
        if (animationId) cancelAnimationFrame(animationId);
        game.loadCellData(initialState);
        generation = 0;
        renderer.render();
        updateCounters();
    });

    speedInput.addEventListener('input', () => {
        speed = parseInt(speedInput.value, 10);
        speedLabel.textContent = speed;
    });

    if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => {
            const code = btnCopyCode.dataset.code;
            navigator.clipboard.writeText(code).then(() => {
                const original = btnCopyCode.textContent;
                btnCopyCode.textContent = 'COPIED!';
                setTimeout(() => { btnCopyCode.textContent = original; }, 1500);
            });
        });
    }

    updateCounters();
})();

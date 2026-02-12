(function () {
    const errorView = document.getElementById('errorView');
    const playView = document.getElementById('playView');
    const errorMessage = document.getElementById('errorMessage');

    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) {
        errorMessage.textContent = 'NO MAP CODE PROVIDED';
        errorView.classList.remove('hidden');
        return;
    }

    let data;
    try {
        data = MapCodec.decode(hash);
    } catch (err) {
        errorMessage.textContent = 'INVALID CODE: ' + err.message.toUpperCase();
        errorView.classList.remove('hidden');
        return;
    }

    playView.classList.remove('hidden');

    const game = new GameOfLife(data.width, data.height, data.grid);
    const initialGrid = new Uint8Array(data.grid);

    const canvas = document.getElementById('gameCanvas');
    const renderer = new GameRenderer(canvas, game, { maxWidth: 860 });
    renderer.render();

    document.getElementById('sizeLabel').textContent = data.width + 'x' + data.height;
    document.getElementById('btnEdit').href = 'edit.html#' + encodeURIComponent(hash);

    let running = false;
    let animationId = null;
    let generation = 0;
    let speed = 10;
    let lastStepTime = 0;

    const btnPlay = document.getElementById('btnPlay');
    const genCount = document.getElementById('genCount');
    const popCount = document.getElementById('popCount');

    function updateCounters() {
        genCount.textContent = generation;
        popCount.textContent = game.population();
    }
    updateCounters();

    function gameLoop(timestamp) {
        if (!running) return;
        if (timestamp - lastStepTime >= 1000 / speed) {
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

    document.getElementById('btnStep').addEventListener('click', () => {
        if (running) return;
        game.step();
        generation++;
        renderer.render();
        updateCounters();
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        running = false;
        btnPlay.textContent = 'PLAY';
        btnPlay.classList.remove('active');
        if (animationId) cancelAnimationFrame(animationId);
        game.grid = new Uint8Array(initialGrid);
        generation = 0;
        renderer.render();
        updateCounters();
    });

    const speedInput = document.getElementById('speed');
    const speedLabel = document.getElementById('speedLabel');
    speedInput.addEventListener('input', () => {
        speed = parseInt(speedInput.value, 10);
        speedLabel.textContent = speed;
    });

    document.getElementById('btnCopyCode').addEventListener('click', function () {
        navigator.clipboard.writeText(hash).then(() => {
            const orig = this.textContent;
            this.textContent = 'COPIED!';
            setTimeout(() => { this.textContent = orig; }, 1500);
        });
    });

    document.getElementById('btnCopyUrl').addEventListener('click', function () {
        navigator.clipboard.writeText(window.location.href).then(() => {
            const orig = this.textContent;
            this.textContent = 'COPIED!';
            setTimeout(() => { this.textContent = orig; }, 1500);
        });
    });
})();

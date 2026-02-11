(function () {
    document.querySelectorAll('.map-card-preview').forEach(container => {
        const width = parseInt(container.dataset.width, 10);
        const height = parseInt(container.dataset.height, 10);
        const cellData = container.dataset.cells;
        if (!width || !height) return;

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const game = new GameOfLife(width, height, cellData);
        const maxDim = Math.max(width, height);
        const cellSize = Math.max(1, Math.floor(180 / maxDim));

        const renderer = new GameRenderer(canvas, game, {
            cellSize: cellSize,
            showGrid: false
        });
        renderer.render();
    });
})();

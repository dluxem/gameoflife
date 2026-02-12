# Game of Life

A browser-based [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) simulator with a map editor, shareable map codes, and an 80s arcade aesthetic. The entire application runs client-side — there is no backend or database.

## Rules

1. Any live cell with fewer than two live neighbors dies (underpopulation).
2. Any live cell with two or three live neighbors lives on to the next generation.
3. Any live cell with more than three live neighbors dies (overpopulation).
4. Any dead cell with exactly three live neighbors becomes a live cell (reproduction).

## Pages

| Page | Path | Purpose |
|------|------|---------|
| Home | `index.html` | Enter a map code to load, or navigate to the editor |
| Editor | `edit.html` | Create a new map, draw cells, save to get a shareable code |
| Player | `play.html#CODE` | Run the simulation for a map code embedded in the URL hash |

Forking a map from the player (`EDIT / FORK` button) opens the editor pre-loaded with that map's grid via `edit.html#CODE`.

## Map Code Encoding

Maps are shared as **base-62 encoded binary strings**. There is no server-side storage; the entire map state is carried in the code itself.

### Charset

```
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
```

62 characters: digits, uppercase A–Z, lowercase a–z. All URL-safe.

### Binary Layout

The code encodes a byte array with the following structure:

```
+--------+--------+--------------------+----------+
| Byte 0 | Byte 1 | Bytes 2 .. N       | Byte N+1 |
| Width  | Height | Cell data (packed)  | CRC-8    |
+--------+--------+--------------------+----------+
```

| Field | Size | Description |
|-------|------|-------------|
| Width | 1 byte (uint8) | Board width, valid range 3–200 |
| Height | 1 byte (uint8) | Board height, valid range 3–200 |
| Cell data | ⌈(width × height) / 8⌉ bytes | 1 bit per cell: `1` = alive, `0` = dead. Bits are packed MSB-first. Cells are ordered left-to-right, top-to-bottom. If the total cell count is not a multiple of 8, the final byte is zero-padded on the right. |
| Checksum | 1 byte | CRC-8 of all preceding bytes (polynomial `0x07`, init `0x00`) |

### Encoding Steps

1. Build the byte array: `[width, height, ...cellBits, crc8]`
2. Interpret the byte array as a single big-endian unsigned integer.
3. Convert that integer to base-62 using repeated division, mapping remainders to the charset.

### Decoding Steps

1. Convert the base-62 string back to a big integer.
2. Extract bytes from the integer (big-endian).
3. Pop the last byte as the CRC-8 checksum; verify it against the remaining bytes.
4. Read width and height from bytes 0 and 1.
5. Unpack the remaining bytes into a flat cell grid, 1 bit per cell, MSB-first.

### CRC-8

Standard CRC-8 with polynomial `0x07` and initial value `0x00`:

```
crc = 0
for each byte:
    crc ^= byte
    for 8 bits:
        if MSB set: crc = (crc << 1) XOR 0x07
        else:       crc = crc << 1
        crc &= 0xFF
```

### Example

A 5×5 grid with a glider pattern encodes to `6THLHCcnN` (9 characters).
A 100×100 random grid encodes to roughly 1,700 characters.

### Limitations

- Board dimensions are stored as single bytes, so the maximum size is 200×200 (enforced in the UI and codec).
- Very large boards produce long codes. A fully populated 200×200 grid ≈ 5,003 bytes ≈ ~6,700 base-62 characters.
- JavaScript `BigInt` is used for the base conversion, which is available in all modern browsers.

## Front-End Dependencies

| Dependency | Version | CDN | Purpose |
|------------|---------|-----|---------|
| [HTMX](https://htmx.org/) | 2.0.4 | `unpkg.com/htmx.org@2.0.4` | Included for progressive enhancement and future dynamic interactions. Currently the application is fully static. |
| [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) | — | Google Fonts | Pixel-style arcade font used for headings, buttons, and labels |
| [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) | — | Google Fonts | Monospace body font |

All application logic (Game of Life engine, codec, editor, player) is vanilla JavaScript with no framework or build step.

## Project Structure

```
public/
├── index.html              Home page
├── edit.html               Map editor
├── play.html               Simulation player
├── css/
│   └── site.css            80s arcade theme
└── js/
    ├── codec.js            Map code encode/decode (base-62, CRC-8)
    ├── gameoflife.js        Game engine + canvas renderer
    ├── editor.js            Editor page logic
    └── play.js              Player page logic
Dockerfile                  nginx:alpine for local testing
nginx.conf                  nginx config (port 8080)
docker-compose.yml          Docker Compose wrapper
wrangler.toml               Cloudflare Workers deployment config
```

## Running Locally

### Docker

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080).

### Without Docker

Serve the `public/` directory with any static file server:

```bash
npx serve public
```

## Deploying to Cloudflare

```bash
npx wrangler deploy
```

This uses the `[assets]` configuration in `wrangler.toml` to serve the contents of `public/` as a Cloudflare Worker.

## License

See [LICENSE](LICENSE).

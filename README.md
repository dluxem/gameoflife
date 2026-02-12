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

The encoder uses **adaptive encoding** — it tries four different encoding modes and picks whichever produces the smallest output. Typical Game of Life patterns are sparse, so coordinate and RLE modes usually beat raw bitmaps by 10–100×.

### Charset

```
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
```

62 characters: digits, uppercase A–Z, lowercase a–z. All URL-safe.

### Binary Layout

```
+----------+----------+------+------------------+-------+
| Byte 0   | Byte 1   | Byte 2 | Bytes 3 .. N   | Last  |
| Width-1  | Height-1 | Mode   | Payload          | CRC-8 |
+----------+----------+------+------------------+-------+
```

| Field | Size | Description |
|-------|------|-------------|
| Width | 1 byte (uint8) | Board width **minus 1**. Valid widths 3–256, stored as 2–255. |
| Height | 1 byte (uint8) | Board height **minus 1**. Same range. |
| Mode | 1 byte | Encoding mode (0–3, see below). |
| Payload | variable | Cell data in the format specified by *mode*. |
| Checksum | 1 byte | CRC-8 of all preceding bytes (polynomial `0x07`, init `0x00`). |

### Encoding Modes

#### Mode 0 — Raw Bitmap

1 bit per cell, MSB-first, left-to-right top-to-bottom. The final byte is zero-padded on the right if the total cell count is not a multiple of 8.

Best for small boards or boards near 50 % density.

#### Mode 1 — Run-Length Encoding (RLE)

Runs alternate between dead and alive cells, always starting with a dead run (which may be length 0). Each run length is encoded as a **varint**:

| First byte pattern | Bytes | Value range |
|--------------------|-------|-------------|
| `0x00`–`0x7F` | 1 | 0 – 127 |
| `0x80 \| hi6`, `lo8` | 2 | 128 – 16 383 |
| `0xC0 \| hi6`, `mid8`, `lo8` | 3 | 16 384 – 4 194 303 |

Best for structured patterns with long runs (lines, blocks, spaceships).

#### Mode 2 — Alive-Cell Coordinate List

Pairs of `(x, y)` bytes, one pair per alive cell. No count is stored; the number of pairs is inferred from the payload length.

Best for sparse boards (most cells dead).

#### Mode 3 — Dead-Cell Coordinate List

Same format as mode 2, but lists the *dead* cells. All unlisted cells are alive.

Best for very dense boards (most cells alive).

### Encoding Steps

1. Compute the payload under all four modes.
2. Build the full byte array for each: `[width-1, height-1, mode, ...payload, crc8]`.
3. Pick the shortest byte array.
4. Interpret it as a big-endian unsigned integer.
5. Convert to base-62 using repeated division, mapping remainders to the charset.

### Decoding Steps

1. Convert the base-62 string back to a big integer.
2. Extract bytes from the integer (big-endian).
3. Pop the last byte as the CRC-8 checksum; verify against the remaining bytes.
4. Read `width = byte[0] + 1`, `height = byte[1] + 1`.
5. Read `mode = byte[2]`.
6. Decode the remaining payload bytes according to the mode.

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

### Size Examples

| Board | Density | Mode chosen | Code length |
|-------|---------|-------------|-------------|
| 5×5 glider | 5 cells | bitmap | ~12 chars |
| 30×30 sparse | ~50 cells | coordinates | ~140 chars |
| 100×100 random 30 % | ~3 000 cells | bitmap | ~1 700 chars |
| 256×256 sparse | 200 cells | coordinates | ~550 chars |
| 256×256 empty | 0 cells | coordinates | ~7 chars |

### Limitations

- Board dimensions are stored as single bytes (width−1, height−1), so the maximum size is **256×256**.
- Random boards near 50 % density still produce long codes because no encoding mode can compress random data. A 256×256 random grid at 50 % ≈ ~11 000 base-62 characters.
- JavaScript `BigInt` is used for the base conversion, which is available in all modern browsers.

## Front-End Dependencies

| Dependency | CDN | Purpose |
|------------|-----|---------|
| [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) | Google Fonts | Pixel-style arcade font used for headings, buttons, and labels |
| [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) | Google Fonts | Monospace body font |

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
    ├── gameoflife.js       Game engine + canvas renderer
    ├── editor.js           Editor page logic
    └── play.js             Player page logic
Dockerfile                  nginx:alpine for local testing
nginx.conf                  nginx config (port 8080)
docker-compose.yml          Docker Compose wrapper
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

## License

See [LICENSE](LICENSE).

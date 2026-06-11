# Game of Life

A playable version is live at **<https://life.luxem.org>**.

A browser-based [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) simulator with a map editor, shareable map codes, and an 80s arcade aesthetic. The entire application runs client-side — there is no backend or database.

## Game Modes

### Classic

Standard Conway's Game of Life:

1. Any live cell with fewer than two live neighbors dies (underpopulation).
2. Any live cell with two or three live neighbors lives on to the next generation.
3. Any live cell with more than three live neighbors dies (overpopulation).
4. Any dead cell with exactly three live neighbors becomes a live cell (reproduction).

### Predator

Introduces two cell types — **grazers** (green) and **hunters** (cyan) — locked in a **predator/prey** relationship. Grazers are a renewable prey that spread like a tissue; hunters are a pack predator that sweeps through them and converts them.

Unlike a stable food web — which tends to settle into still-lifes just like plain Conway — this coupling is deliberately **unstable**, and that is what makes it interesting. The two species behave like an [excitable medium](https://en.wikipedia.org/wiki/Excitable_medium): grazers spread as a renewable tissue, hunters sweep through them as **hunting waves**, and the bare ground left behind regrows. The result is perpetual motion — travelling fronts, spirals, and boom/bust population cycles — instead of a frozen board.

The interaction runs in **both directions**:

- Grazers feed the hunters (and are caught by them).
- Hunters thin the grazers, opening space the grazers then recolonize.

A future third species — an **apex** predator that preys on the hunters — is reserved in the encoding and rules for later.

#### Grazer Rules (green) — the prey

- **Spreads** into bare ground with **2–8** grazer neighbors (a fast-regrowing tissue, so the gaps the hunters carve are quickly refilled).
- **Survives** with **2–8** grazer neighbors.
- **Is caught** — converted into a hunter — when touched by **3 or more** hunters (see Predation).

#### Hunter Rules (cyan) — the predator

- **Hunts:** any grazer with **3+** hunter neighbors becomes a hunter next tick (prey biomass is turned into more hunters — this is how cyan advances through green).
- **Spreads** to bare ground with **2–3** hunter neighbors *and* at least **1** adjacent grazer host.
- **Starves** (dies) with no adjacent grazer — so once a region is hunted out, the pack dies back, leaving bare ground for the grazers to reclaim.
- **Overcrowds** (dies) with **4+** hunter neighbors — so the pack can never solidify into a static block; its fronts stay thin and keep moving toward fresh prey.

## Pages

| Page | Path | Purpose |
|------|------|---------|
| Home | `index.html` | Enter a map code to load, or navigate to the editor |
| Editor / Player | `play.html` | Create a new map, draw cells, run the simulation, and share |

Opening `play.html` without a hash starts with an empty 50×34 board in Classic mode. Draw cells (or press **RANDOM**) to build a map, and use the **MODE** buttons to switch between Classic and Predator — the board stays empty until you draw. Opening `play.html#CODE` pre-loads the encoded map and automatically selects the correct game mode. Share URLs always point to `play.html#CODE`.

## Map Code Encoding

Maps are shared as **base-62 encoded binary strings**. There is no server-side storage; the entire map state is carried in the code itself.

The encoder uses **adaptive encoding** — it tries multiple encoding modes and picks whichever produces the smallest output.

### Charset

```
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
```

62 characters: digits, uppercase A–Z, lowercase a–z. All URL-safe.

### Binary Layout

```
+----------+----------+-----------+------------------+-------+
| Byte 0   | Byte 1   | Byte 2    | Bytes 3 .. N     | Last  |
| Width-1  | Height-1 | Mode byte | Payload          | CRC-8 |
+----------+----------+-----------+------------------+-------+
```

| Field | Size | Description |
|-------|------|-------------|
| Width | 1 byte (uint8) | Board width **minus 1**. Valid widths 3–256, stored as 2–255. |
| Height | 1 byte (uint8) | Board height **minus 1**. Same range. |
| Mode byte | 1 byte | Bits 0–3: encoding mode. Bits 4–7: game mode. |
| Payload | variable | Cell data in the format specified by the encoding mode. |
| Checksum | 1 byte | CRC-8 of all preceding bytes (polynomial `0x07`, init `0x00`). |

### Mode Byte

The mode byte encodes both the **game mode** and the **encoding mode**:

```
Bits 4-7:  game mode      (0 = Classic, 1 = Predator)
Bits 0-3:  encoding mode  (varies by game mode)
```

Existing Classic codes use mode byte values 0–3, which decode as game mode 0 with encoding modes 0–3 — fully backward compatible.

### Classic Encoding Modes (game mode 0)

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

### Predator Encoding Modes (game mode 1)

Cell values: `0` = dead, `1` = grazer, `2` = hunter.

#### Mode 0 — 2-Bit Bitmap

2 bits per cell, MSB-first. 4 cells per byte: bits [7–6] = cell 0, bits [5–4] = cell 1, bits [3–2] = cell 2, bits [1–0] = cell 3. Final byte zero-padded on the right.

#### Mode 1 — Multi-State RLE

Sequence of `(type_byte, varint_length)` pairs. Each pair encodes a run of N consecutive cells of the given type.

#### Mode 2 — Typed Coordinate List

Triplets of `(x, y, type)` for every non-dead cell. Cell count is inferred from `payload length / 3`.

Best for sparse boards.

### Encoding Steps

1. Compute the payload under all applicable modes for the game mode.
2. Build the full byte array for each: `[width-1, height-1, mode_byte, ...payload, crc8]`.
3. Pick the shortest byte array.
4. Interpret it as a big-endian unsigned integer.
5. Convert to base-62 using repeated division, mapping remainders to the charset.

### Decoding Steps

1. Convert the base-62 string back to a big integer.
2. Extract bytes from the integer (big-endian).
3. Pop the last byte as the CRC-8 checksum; verify against the remaining bytes.
4. Read `width = byte[0] + 1`, `height = byte[1] + 1`.
5. Read the mode byte: `game_mode = byte[2] >> 4`, `encoding_mode = byte[2] & 0x0F`.
6. Decode the remaining payload bytes according to the game mode and encoding mode.

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
├── play.html               Editor / player (single unified page)
├── css/
│   └── site.css            80s arcade theme
└── js/
    ├── codec.js            Map code encode/decode (base-62, CRC-8)
    ├── gameoflife.js       Game engine + canvas renderer
    └── play.js             Editor + player page logic
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

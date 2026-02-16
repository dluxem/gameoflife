/**
 * Map Code Codec
 *
 * Binary format:
 *   byte 0:       board width  minus 1  (uint8, so 3–256 → stored 2–255)
 *   byte 1:       board height minus 1  (uint8, same)
 *   byte 2:       mode byte
 *                   bits 0-3: encoding mode (0–3)
 *                   bits 4-7: game mode
 *                     0 = Classic Conway
 *                     1 = Symbiotic (herbivore + symbiote)
 *   bytes 3..N:   payload (depends on encoding mode and game mode)
 *   byte N+1:     CRC-8 checksum of all preceding bytes
 *
 * --- Classic game mode (game mode 0) ---
 *
 *   Encoding mode 0 — raw bitmap:
 *     1 bit per cell, MSB first, left-to-right top-to-bottom.
 *     Final byte zero-padded on the right.
 *
 *   Encoding mode 1 — RLE:
 *     Runs alternate dead / alive, starting with a dead run.
 *     Each run length is stored as a varint.
 *
 *   Encoding mode 2 — alive-cell coordinate list:
 *     Pairs of (x, y) bytes, one per alive cell.
 *
 *   Encoding mode 3 — dead-cell coordinate list:
 *     Pairs of (x, y) bytes, one per dead cell.
 *     All unlisted cells are alive.
 *
 * --- Symbiotic game mode (game mode 1) ---
 *
 *   Cell values: 0=dead, 1=herbivore, 2=symbiote
 *
 *   Encoding mode 0 — 2-bit bitmap:
 *     2 bits per cell, MSB first: bits[7-6]=cell0 .. bits[1-0]=cell3.
 *     4 cells per byte. Final byte zero-padded on the right.
 *
 *   Encoding mode 1 — multi-state RLE:
 *     Sequence of (type_byte, varint_length) pairs.
 *     Each pair encodes a run of N cells of a given type.
 *
 *   Encoding mode 2 — typed coordinate list:
 *     Triplets of (x, y, type) for every non-dead cell.
 *     Count inferred from payload length / 3.
 */
const MapCodec = (() => {
    const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const BASE = BigInt(CHARSET.length);
    const MIN_DIM = 3;
    const MAX_DIM = 256;

    /* ---- CRC-8 (polynomial 0x07, init 0x00) ---- */
    function crc8(bytes) {
        let crc = 0;
        for (const b of bytes) {
            crc ^= b;
            for (let i = 0; i < 8; i++) {
                crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
            }
        }
        return crc;
    }

    /* ---- Varint helpers ---- */
    function encodeVarint(value) {
        if (value < 0x80) return [value];
        if (value < 0x4000) return [0x80 | (value >> 8), value & 0xFF];
        return [0xC0 | (value >> 16), (value >> 8) & 0xFF, value & 0xFF];
    }

    function decodeVarint(bytes, offset) {
        const b0 = bytes[offset];
        if ((b0 & 0x80) === 0) return { value: b0, next: offset + 1 };
        if ((b0 & 0xC0) === 0x80) {
            return { value: ((b0 & 0x3F) << 8) | bytes[offset + 1], next: offset + 2 };
        }
        return {
            value: ((b0 & 0x3F) << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2],
            next: offset + 3,
        };
    }

    /* ==================================================================
     *  Classic encoding modes (game mode 0) — unchanged from original
     * ================================================================== */

    /* ---- Mode 0: raw bitmap ---- */
    function encodeBitmap(width, height, grid) {
        const totalCells = width * height;
        const payload = [];
        let cur = 0, bits = 0;
        for (let i = 0; i < totalCells; i++) {
            cur = (cur << 1) | (grid[i] ? 1 : 0);
            bits++;
            if (bits === 8) { payload.push(cur); cur = 0; bits = 0; }
        }
        if (bits > 0) { cur <<= (8 - bits); payload.push(cur); }
        return payload;
    }

    function decodeBitmap(payload, totalCells) {
        const grid = new Uint8Array(totalCells);
        let idx = 0;
        for (const b of payload) {
            for (let bit = 7; bit >= 0 && idx < totalCells; bit--) {
                grid[idx++] = (b >> bit) & 1;
            }
        }
        return grid;
    }

    /* ---- Mode 1: RLE ---- */
    function encodeRLE(width, height, grid) {
        const totalCells = width * height;
        const payload = [];
        let runVal = 0;   // start with dead run
        let runLen = 0;
        for (let i = 0; i < totalCells; i++) {
            const v = grid[i] ? 1 : 0;
            if (v === runVal) {
                runLen++;
            } else {
                payload.push(...encodeVarint(runLen));
                runVal = v;
                runLen = 1;
            }
        }
        payload.push(...encodeVarint(runLen));
        return payload;
    }

    function decodeRLE(payload, totalCells) {
        const grid = new Uint8Array(totalCells);
        let idx = 0, off = 0, val = 0;
        while (idx < totalCells && off < payload.length) {
            const { value: runLen, next } = decodeVarint(payload, off);
            off = next;
            for (let i = 0; i < runLen && idx < totalCells; i++) {
                grid[idx++] = val;
            }
            val ^= 1;
        }
        return grid;
    }

    /* ---- Mode 2 / 3: coordinate list ---- */
    function encodeCoords(width, height, grid, targetValue) {
        const payload = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if ((grid[y * width + x] ? 1 : 0) === targetValue) {
                    payload.push(x, y);
                }
            }
        }
        return payload;
    }

    function decodeCoords(payload, width, height, fillValue) {
        const totalCells = width * height;
        const grid = new Uint8Array(totalCells);
        if (fillValue) grid.fill(1);
        const targetValue = fillValue ? 0 : 1;
        for (let i = 0; i < payload.length; i += 2) {
            const x = payload[i], y = payload[i + 1];
            grid[y * width + x] = targetValue;
        }
        return grid;
    }

    /* ==================================================================
     *  Symbiotic encoding modes (game mode 1)
     * ================================================================== */

    /* ---- Encoding mode 0: 2-bit bitmap ---- */
    function encodeBitmap2bit(width, height, grid) {
        const totalCells = width * height;
        const payload = [];
        let cur = 0, cellsInByte = 0;
        for (let i = 0; i < totalCells; i++) {
            cur = (cur << 2) | (grid[i] & 0x03);
            cellsInByte++;
            if (cellsInByte === 4) { payload.push(cur); cur = 0; cellsInByte = 0; }
        }
        if (cellsInByte > 0) {
            cur <<= (4 - cellsInByte) * 2;
            payload.push(cur);
        }
        return payload;
    }

    function decodeBitmap2bit(payload, totalCells) {
        const grid = new Uint8Array(totalCells);
        let idx = 0;
        for (const b of payload) {
            for (let shift = 6; shift >= 0 && idx < totalCells; shift -= 2) {
                grid[idx++] = (b >> shift) & 0x03;
            }
        }
        return grid;
    }

    /* ---- Encoding mode 1: multi-state RLE ---- */
    function encodeMultiStateRLE(width, height, grid) {
        const totalCells = width * height;
        if (totalCells === 0) return [];
        const payload = [];
        let runType = grid[0];
        let runLen = 1;
        for (let i = 1; i < totalCells; i++) {
            if (grid[i] === runType) {
                runLen++;
            } else {
                payload.push(runType);
                payload.push(...encodeVarint(runLen));
                runType = grid[i];
                runLen = 1;
            }
        }
        payload.push(runType);
        payload.push(...encodeVarint(runLen));
        return payload;
    }

    function decodeMultiStateRLE(payload, totalCells) {
        const grid = new Uint8Array(totalCells);
        let idx = 0, off = 0;
        while (idx < totalCells && off < payload.length) {
            const cellType = payload[off++];
            const { value: runLen, next } = decodeVarint(payload, off);
            off = next;
            for (let i = 0; i < runLen && idx < totalCells; i++) {
                grid[idx++] = cellType;
            }
        }
        return grid;
    }

    /* ---- Encoding mode 2: typed coordinate list ---- */
    function encodeTypedCoords(width, height, grid) {
        const payload = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const v = grid[y * width + x];
                if (v !== 0) {
                    payload.push(x, y, v);
                }
            }
        }
        return payload;
    }

    function decodeTypedCoords(payload, width, height) {
        const totalCells = width * height;
        const grid = new Uint8Array(totalCells);
        for (let i = 0; i < payload.length; i += 3) {
            const x = payload[i], y = payload[i + 1], type = payload[i + 2];
            grid[y * width + x] = type;
        }
        return grid;
    }

    /* ---- Build full byte array for a mode ---- */
    function buildBytes(width, height, modeByte, payload) {
        const bytes = [width - 1, height - 1, modeByte, ...payload];
        bytes.push(crc8(bytes));
        return bytes;
    }

    /* ---- Bytes to base-62 string ---- */
    function bytesToBase62(bytes) {
        let num = 0n;
        for (const b of bytes) num = (num << 8n) | BigInt(b);
        if (num === 0n) return CHARSET[0];

        let result = '';
        while (num > 0n) {
            result = CHARSET[Number(num % BASE)] + result;
            num /= BASE;
        }
        return result;
    }

    /* ---- Base-62 string to bytes ---- */
    function base62ToBytes(code) {
        let num = 0n;
        for (const ch of code) {
            const idx = CHARSET.indexOf(ch);
            if (idx === -1) throw new Error(`Invalid character: ${ch}`);
            num = num * BASE + BigInt(idx);
        }

        const bytes = [];
        while (num > 0n) {
            bytes.unshift(Number(num & 0xFFn));
            num >>= 8n;
        }
        return bytes;
    }

    /* ---- Public encode ---- */
    function encode(width, height, grid, gameMode = 0) {
        if (gameMode === 1) {
            return encodeSymbiotic(width, height, grid);
        }
        return encodeClassic(width, height, grid);
    }

    function encodeClassic(width, height, grid) {
        const candidates = [
            buildBytes(width, height, 0, encodeBitmap(width, height, grid)),
            buildBytes(width, height, 1, encodeRLE(width, height, grid)),
            buildBytes(width, height, 2, encodeCoords(width, height, grid, 1)),
            buildBytes(width, height, 3, encodeCoords(width, height, grid, 0)),
        ];

        let best = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
            if (candidates[i].length < best.length) best = candidates[i];
        }

        return bytesToBase62(best);
    }

    function encodeSymbiotic(width, height, grid) {
        const gameModePrefix = 1 << 4; // game mode 1, shifted to upper nibble
        const candidates = [
            buildBytes(width, height, gameModePrefix | 0, encodeBitmap2bit(width, height, grid)),
            buildBytes(width, height, gameModePrefix | 1, encodeMultiStateRLE(width, height, grid)),
            buildBytes(width, height, gameModePrefix | 2, encodeTypedCoords(width, height, grid)),
        ];

        let best = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
            if (candidates[i].length < best.length) best = candidates[i];
        }

        return bytesToBase62(best);
    }

    /* ---- Public decode ---- */
    function decode(code) {
        if (!code || code.length === 0) throw new Error('Empty code');

        const bytes = base62ToBytes(code);
        if (bytes.length < 4) throw new Error('Code too short');

        const checksum = bytes.pop();
        if (crc8(bytes) !== checksum) throw new Error('Invalid checksum');

        const width = bytes[0] + 1;
        const height = bytes[1] + 1;

        if (width < MIN_DIM || width > MAX_DIM || height < MIN_DIM || height > MAX_DIM) {
            throw new Error('Invalid dimensions');
        }

        const modeByte = bytes[2];
        const gameMode = (modeByte >> 4) & 0x0F;
        const encodingMode = modeByte & 0x0F;
        const payload = bytes.slice(3);
        const totalCells = width * height;

        let grid;
        if (gameMode === 0) {
            switch (encodingMode) {
                case 0: grid = decodeBitmap(payload, totalCells); break;
                case 1: grid = decodeRLE(payload, totalCells); break;
                case 2: grid = decodeCoords(payload, width, height, 0); break;
                case 3: grid = decodeCoords(payload, width, height, 1); break;
                default: throw new Error('Unknown encoding mode');
            }
        } else if (gameMode === 1) {
            switch (encodingMode) {
                case 0: grid = decodeBitmap2bit(payload, totalCells); break;
                case 1: grid = decodeMultiStateRLE(payload, totalCells); break;
                case 2: grid = decodeTypedCoords(payload, width, height); break;
                default: throw new Error('Unknown encoding mode');
            }
        } else {
            throw new Error('Unknown game mode');
        }

        return { width, height, grid, gameMode };
    }

    return { encode, decode, crc8 };
})();

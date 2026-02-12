/**
 * Map Code Codec
 *
 * Binary format (v2 — adaptive encoding):
 *   byte 0:       board width  minus 1  (uint8, so 3–256 → stored 2–255)
 *   byte 1:       board height minus 1  (uint8, same)
 *   byte 2:       encoding mode
 *                   0 = raw bitmap
 *                   1 = run-length encoding (RLE)
 *                   2 = alive-cell coordinate list
 *                   3 = dead-cell coordinate list
 *   bytes 3..N:   payload (depends on mode)
 *   byte N+1:     CRC-8 checksum of all preceding bytes
 *
 * The encoder tries every mode and picks the one that produces the
 * smallest byte array.  The byte array is then encoded as a base-62
 * big-integer string using the charset 0-9 A-Z a-z.
 *
 * --- Mode 0: raw bitmap ---
 *   1 bit per cell, MSB first, left-to-right top-to-bottom.
 *   Final byte zero-padded on the right.
 *
 * --- Mode 1: RLE ---
 *   Runs alternate dead / alive, starting with a dead run.
 *   Each run length is stored as a varint:
 *     byte 0x00–0x7F  →  length 0–127              (1 byte)
 *     byte 0x80|hi7, lo8  →  (hi7<<8)|lo8 = 128–32767   (2 bytes)
 *     three-byte form for lengths up to 65535.
 *
 * --- Mode 2: alive-cell coordinate list ---
 *   Pairs of (x, y) bytes, one per alive cell.
 *
 * --- Mode 3: dead-cell coordinate list ---
 *   Pairs of (x, y) bytes, one per dead cell.
 *   All unlisted cells are alive.
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

    /* ---- Build full byte array for a mode ---- */
    function buildBytes(width, height, mode, payload) {
        const bytes = [width - 1, height - 1, mode, ...payload];
        bytes.push(crc8(bytes));
        return bytes;
    }

    /* ---- Public encode ---- */
    function encode(width, height, grid) {
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

        let num = 0n;
        for (const b of best) num = (num << 8n) | BigInt(b);
        if (num === 0n) return CHARSET[0];

        let result = '';
        while (num > 0n) {
            result = CHARSET[Number(num % BASE)] + result;
            num /= BASE;
        }
        return result;
    }

    /* ---- Public decode ---- */
    function decode(code) {
        if (!code || code.length === 0) throw new Error('Empty code');

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

        if (bytes.length < 4) throw new Error('Code too short');

        const checksum = bytes.pop();
        if (crc8(bytes) !== checksum) throw new Error('Invalid checksum');

        const width = bytes[0] + 1;
        const height = bytes[1] + 1;

        if (width < MIN_DIM || width > MAX_DIM || height < MIN_DIM || height > MAX_DIM) {
            throw new Error('Invalid dimensions');
        }

        const mode = bytes[2];
        const payload = bytes.slice(3);
        const totalCells = width * height;

        let grid;
        switch (mode) {
            case 0: grid = decodeBitmap(payload, totalCells); break;
            case 1: grid = decodeRLE(payload, totalCells); break;
            case 2: grid = decodeCoords(payload, width, height, 0); break;
            case 3: grid = decodeCoords(payload, width, height, 1); break;
            default: throw new Error('Unknown encoding mode');
        }

        return { width, height, grid };
    }

    return { encode, decode, crc8 };
})();

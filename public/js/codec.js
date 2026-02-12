/**
 * Map Code Codec
 *
 * Binary format:
 *   byte 0:       board width  (3-200)
 *   byte 1:       board height (3-200)
 *   bytes 2..N:   cell data, 1 bit per cell, MSB first, left-to-right top-to-bottom
 *                 last byte zero-padded on the right if needed
 *   byte N+1:     CRC-8 checksum of all preceding bytes
 *
 * The byte array is then encoded as a base-62 big-integer string
 * using the charset 0-9 A-Z a-z.
 */
const MapCodec = (() => {
    const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const BASE = BigInt(CHARSET.length);

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

    function encode(width, height, grid) {
        const bytes = [];
        bytes.push(width & 0xFF);
        bytes.push(height & 0xFF);

        const totalCells = width * height;
        let currentByte = 0;
        let bitCount = 0;

        for (let i = 0; i < totalCells; i++) {
            currentByte = (currentByte << 1) | (grid[i] ? 1 : 0);
            bitCount++;
            if (bitCount === 8) {
                bytes.push(currentByte);
                currentByte = 0;
                bitCount = 0;
            }
        }
        if (bitCount > 0) {
            currentByte <<= (8 - bitCount);
            bytes.push(currentByte);
        }

        bytes.push(crc8(bytes));

        let num = 0n;
        for (const b of bytes) {
            num = (num << 8n) | BigInt(b);
        }

        if (num === 0n) return CHARSET[0];

        let result = '';
        while (num > 0n) {
            result = CHARSET[Number(num % BASE)] + result;
            num /= BASE;
        }

        return result;
    }

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

        if (bytes.length < 3) throw new Error('Code too short');

        const checksum = bytes.pop();
        if (crc8(bytes) !== checksum) throw new Error('Invalid checksum');

        const width = bytes[0];
        const height = bytes[1];

        if (width < 3 || width > 200 || height < 3 || height > 200) {
            throw new Error('Invalid dimensions');
        }

        const totalCells = width * height;
        const cellBytes = bytes.slice(2);
        const grid = new Uint8Array(totalCells);
        let cellIndex = 0;

        for (const b of cellBytes) {
            for (let bit = 7; bit >= 0 && cellIndex < totalCells; bit--) {
                grid[cellIndex++] = (b >> bit) & 1;
            }
        }

        return { width, height, grid };
    }

    return { encode, decode, crc8 };
})();

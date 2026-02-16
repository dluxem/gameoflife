# Herbivore + Symbiote Game Mode — Implementation Plan

## Overview

Add a "Herbivore" game mode alongside the existing Classic Conway mode. In this mode, cells are either **herbivores** (green) or **symbiotes** (blue). Symbiotes depend on herbivore hosts; herbivores benefit from symbiote adjacency. A game mode selector on the editor page lets users choose which rule set to play. Existing encoded maps continue to work as Classic mode.

Only symbiotes are implemented now. The architecture supports adding predators (or other types) later.

---

## 1. Mode Byte Encoding Scheme (codec)

The existing binary format uses **byte 2** as the encoding mode (values 0–3, only 2 bits used). We split this byte:

```
Bits 0-3:  encoding mode (0–3, same as today)
Bits 4-7:  game mode     (0 = Classic, 1 = Herbivore, future: 2+ for predators etc.)
```

| Game mode | Encoding mode | Byte value | Description |
|-----------|---------------|------------|-------------|
| 0 (Classic) | 0 | 0x00 | Classic bitmap |
| 0 (Classic) | 1 | 0x01 | Classic RLE |
| 0 (Classic) | 2 | 0x02 | Classic alive-coords |
| 0 (Classic) | 3 | 0x03 | Classic dead-coords |
| 1 (Herbivore) | 0 | 0x10 | 2-bit bitmap |
| 1 (Herbivore) | 1 | 0x11 | Multi-state RLE |
| 1 (Herbivore) | 2 | 0x12 | Typed coordinate list |

**Backward compatibility:** Existing codes have mode byte 0–3, which decodes as gameMode=0 (Classic). No existing code breaks.

### Multi-State Encoding Formats (Herbivore Mode)

Cell values: 0=dead, 1=herbivore, 2=symbiote (future: 3=predator).

**Encoding mode 0 — 2-bit bitmap:**
- 4 cells per byte, MSB-first: bits[7-6]=cell0, bits[5-4]=cell1, bits[3-2]=cell2, bits[1-0]=cell3
- Final byte zero-padded on the right

**Encoding mode 1 — Multi-state RLE:**
- Sequence of (type_byte, varint_length) pairs
- Each pair says "the next N cells are type T"
- Consecutive runs of the same type are merged

**Encoding mode 2 — Typed coordinate list:**
- (x, y, type) triplets for every non-dead cell
- Cell count inferred from payload length / 3
- Best for sparse boards

The encoder tries all three and picks the smallest, same pattern as Classic mode.

---

## 2. Cell Type Constants

Define in `gameoflife.js`, used across all files:

```
CELL_DEAD = 0
CELL_HERBIVORE = 1
CELL_SYMBIOTE = 2
(future: CELL_PREDATOR = 3)

GAME_MODE_CLASSIC = 0
GAME_MODE_HERBIVORE = 1
```

---

## 3. Game Rules (Herbivore Mode)

### Herbivore (value 1, green)
- **Survives** with 2–3 neighbors (any living type counts), OR 1–3 neighbors if at least one neighbor is a symbiote
- **Born** in an empty cell with exactly 3 herbivore neighbors
- **Dies** otherwise (underpopulation/overpopulation)

### Symbiote (value 2, blue)
- **Survives** with 1–2 symbiote neighbors AND at least 1 herbivore neighbor
- **Born** in an empty cell with exactly 2 symbiote neighbors AND at least 1 herbivore neighbor
- **Dies** without an adjacent herbivore, or with 0 or 3+ symbiote neighbors

### Classic Mode (unchanged)
Standard Conway rules. Grid values are only 0 and 1.

---

## 4. File-by-File Changes

### `gameoflife.js` — Engine + Renderer

**GameOfLife class:**
- Add `gameMode` parameter to constructor (default: 0 = Classic)
- `set(x, y, value)` — accept values 0, 1, 2 (remove the `? 1 : 0` coercion)
- `toggle(x, y)` — cycle: in classic mode 0↔1; in herbivore mode, toggle based on the active draw type (handled by play.js, not here — toggle stays as 0↔1 for compatibility, drawing logic in play.js uses `set()` directly)
- Add `countNeighborsByType(x, y)` — returns `{ total, herbivore, symbiote }` counts
- `step()` — if classic mode, existing logic; if herbivore mode, new logic using countNeighborsByType and the rules above
- `randomize(density)` — in herbivore mode, place ~25% herbivore, ~8% symbiote (only adjacent to herbivores)
- `invert()` — only available in classic mode (play.js hides button in herbivore mode)
- `clone()` — preserve gameMode
- `population()` — works as-is (counts all non-zero cells)
- Add `populationByType()` — returns `{ herbivore, symbiote }` counts

**GameRenderer class:**
- Add `colorSymbiote` option (default: `#00e5ff`, neon cyan)
- `render()` — draw cells based on value: 1=herbivore (green), 2=symbiote (cyan)

### `codec.js` — Encode/Decode

- `encode(width, height, grid, gameMode = 0)` — adds gameMode parameter
  - Classic mode (gameMode=0): existing logic, unchanged
  - Herbivore mode (gameMode=1): try 2-bit bitmap, multi-state RLE, and typed coords; pick smallest; mode byte = `(1 << 4) | encodingMode`
- `decode(code)` — returns `{ width, height, grid, gameMode }`
  - Extract `gameMode = byte[2] >> 4` and `encodingMode = byte[2] & 0x0F`
  - Classic mode: existing decode logic
  - Herbivore mode: decode with multi-state decoders
- Add internal functions: `encodeBitmap2bit`, `decodeBitmap2bit`, `encodeMultiStateRLE`, `decodeMultiStateRLE`, `encodeTypedCoords`, `decodeTypedCoords`

### `play.html` — UI Structure

**Sidebar additions (inside `.edit-sidebar`, above the SIZE section):**
- Game mode selector: two buttons (CLASSIC / HERBIVORE), styled like arcade buttons
- Cell type draw selector (hidden in classic mode): HERBIVORE / SYMBIOTE buttons with colored indicators

**Rules section:**
- Keep existing `<div class="edit-rules">` structure
- Content will be dynamically updated by play.js based on game mode

**Toolbar:**
- INVERT button gets an id so play.js can hide it in herbivore mode

### `play.js` — Editor/Player Logic

**Game mode management:**
- Track `gameMode` variable (0 or 1)
- Track `drawCellType` variable (1=herbivore, 2=symbiote; default 1)
- Game mode buttons: click handler sets `gameMode`, recreates game with new mode, updates UI
- Only allow mode change in edit mode (gen === 0, not playing)
- When switching from herbivore→classic: strip symbiote cells (set to 0)
- When switching from classic→herbivore: no grid change needed (1=herbivore already)

**Drawing changes:**
- `mousedown`: set `drawValue` based on current cell and `drawCellType`
  - If cell matches drawCellType → erase (drawValue = 0)
  - Otherwise → place (drawValue = drawCellType)
- `handleDraw`: use `game.set(x, y, drawValue)` (already does this)
- Cell type selector buttons: update `drawCellType`, highlight active button

**Toolbar:**
- RANDOM: calls `game.randomize()` which respects game mode internally
- INVERT: hidden in herbivore mode
- CLEAR: works as-is

**Rules display:**
- `updateRulesDisplay()` function that swaps the rules list HTML based on game mode

**Counters:**
- In herbivore mode, show population breakdown: `POP: 5H 3S` or similar
- Or keep simple total, and add a tooltip/breakdown. Keep it simple for now — just total.

**Share/Load:**
- `encode` call passes `gameMode`
- `decode` reads `gameMode` from result, sets UI accordingly
- When loading a classic code, game mode selector shows CLASSIC
- When loading a herbivore code, game mode selector shows HERBIVORE

### `site.css` — Styling

- Add `--cell-symbiote: #00e5ff` CSS variable
- Game mode selector styles (button group, fits in sidebar)
- Cell type selector styles (colored button indicators)
- Responsive adjustments for new sidebar sections

### `index.html` — Home Page

- No changes needed. The LOAD flow validates the code and redirects to play.html#CODE. The play page handles game mode detection from the decoded data.

### `README.md` — Documentation

- Update Rules section to describe both game modes
- Update Binary Layout section to document the mode byte split
- Add new encoding modes documentation
- Update Size Examples if needed

---

## 5. Implementation Order

1. **Constants & engine** (`gameoflife.js`): game mode, cell types, countNeighborsByType, herbivore step logic, randomize, populationByType
2. **Renderer** (`gameoflife.js`): multi-color rendering
3. **Codec** (`codec.js`): mode byte split, multi-state encoders/decoders, updated encode/decode API
4. **HTML structure** (`play.html`): game mode selector, cell type selector, rules section ids
5. **CSS** (`site.css`): new component styles
6. **Editor logic** (`play.js`): game mode switching, draw type selection, rules display, share/load with game mode
7. **README** (`README.md`): documentation updates

---

## 6. Design Decisions for Future Predator Addition

These choices make adding predators straightforward later:

- Cell type constants are sequential integers (0, 1, 2, 3...)
- `countNeighborsByType` returns a breakdown object — easy to add `predator` field
- Game mode 2 in the mode byte is reserved for predator ecosystem
- 2-bit encoding supports values 0–3 (dead, herbivore, symbiote, predator) with no format change
- The game mode selector is a button group — adding a third button is trivial
- The step() function dispatches by game mode — adding a new branch is clean
- Predator-specific rules (speed throttle, kill-on-birth) can be added to the step function

# Fang Yuan Sprite Pack

Unified sprite pack with idle, walk, hand attack, front death with stylized gore, and dash actions.

See `fang-yuan-sprite-pack.json` for the runtime manifest. All standard cells are 64×64 RGBA.

## Actions

- `idle`: 8 directions × 1 frame, loop
- `walk`: 8 directions × 6 frames, loop
- `attack`: 8 directions × 6 frames, one-shot
- `death`: front/south only × 6 frames, one-shot, stylized blood/gore
- `dash`: 8 directions × 6 frames, one-shot

Canonical direction order: `up, up-right, right, down-right, down, down-left, left, up-left`.

The `qa/` directory preserves structural and semantic QC reports for every action.

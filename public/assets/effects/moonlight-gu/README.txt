PixelLab VFX Creator: one effect turned to face several ways.

Each folder is one direction (east, south-east, ... or angle-030 for an angle in degrees,
clockwise from east on screen: 90 is toward the camera). manifest.json lists them.

In a folder, every clip is a spritesheet with exact pixels: scale it by whole numbers only,
with nearest-neighbour filtering. Draw frame i at anchor + offset, the anchor being your
character's feet:
- behind: draw it, then your character facing that way, then
- front.
- whole: the effect without the character.
The folder's manifest.json has each clip's offset, frame size and timing.

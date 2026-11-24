# Angry Senabahini

A physics slingshot game: launch angry soldiers and smash the robot forts.

▶ **Play:** https://mortuzatonmoy.github.io/angry-senabahini/

## How to play
- Drag the soldier on the slingshot back and let go.
- While a soldier is in the air, tap the screen (or press Space) to use their special power.
- Destroy every robot to clear the level. Each soldier you didn't use is worth a 10,000-point bonus.
- Drag an empty area or scroll the mouse wheel to move the camera. Press `R` to restart and `P` or `Esc` to pause.

## Soldiers
| Soldier | Power |
|---|---|
| Sepoy (red) | Heavy all-round hitter |
| Commando (yellow) | Tap: speed dash, smashes wood |
| Bomber (black) | Tap: explode, cracks stone |
| Trio (blue) | Tap: split in three, shatters glass |

## Tech
- Plain HTML, CSS and JavaScript, with no build step.
- Physics: [Matter.js](https://brm.io/matter-js/) 0.19, bundled in `lib/`.
- All graphics are drawn in code on a canvas, with no image files.
- All sound is made with the Web Audio API.
- 16 levels in 3 themes (day, sunset, night). Stars and best scores are saved in the browser.

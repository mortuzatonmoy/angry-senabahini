# Angry Filmstars

A Bollywood-style physics slingshot game: launch angry filmstars and smash the goons' hideouts. All characters are original designs, not real actors.

▶ **Play:** https://mortuzatonmoy.github.io/angry-senabahini/

## How to play
- Drag the star on the slingshot back and let go.
- While a star is in the air, tap the screen (or press Space) to use their special power.
- Knock out every goon to clear the level. Each star you didn't use is worth a 10,000-point bonus.
- Drag an empty area or scroll the mouse wheel to move the camera. Press `R` to restart and `P` or `Esc` to pause.

## Filmstars
| Star | Power |
|---|---|
| Action Hero | Heavy all-round hitter |
| Heroine | Tap: spin dash, smashes wood |
| The Don | Tap: explode, cracks stone |
| Comedian | Tap: split in three, shatters glass |

## Tech
- Plain HTML, CSS and JavaScript, with no build step.
- Physics: [Matter.js](https://brm.io/matter-js/) 0.19, bundled in `lib/`.
- All graphics are drawn in code on a canvas, with no image files.
- All sound is made with the Web Audio API.
- 16 levels in 3 themes (day, sunset, night). Stars and best scores are saved in the browser.

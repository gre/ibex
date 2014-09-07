Game Goal
===
- Protect & escort some wild animals into a safe place.
- end of the world from left to right. rush to the right. infinite exploration.

Prioritized TODO list
===

Implement animal motion.
---
AI motion have to be realist.

- Element actions on animal:
  - Fire: burn
  - Air: push
  - Forest: slow down? Reproduction?
  - ?? Water: slip
- Animal reactions when see element:
  - Fire: fear (move away)
  - Cliff: fear (stay)
  - Water: nothing
  - Air: nothing

Implement animal graphics
---

Make infinite exploration possible
---
- accelerate the left destruction when width is high: trigger flames (bottom up fire drawing)

Improve performance of map generation
---
Should run in glsl ?
More variety in generated terrains? (lot of air / lot of earth / a bit more forest)

Improve design
---
- perlin noise for the earth?
- mushrooms grows when no water. if mushroom touches green -> green

How to make the game more challenging
---
- cooldown?
- limited actions?

General Performance & bugfix
---

Test the game on different plateform. Identify and fix bugs.

Mobile support?
---

?? volcano particles
---

small piece of volcano (lava) are falling and exploding when collide to earth

?? Introduce "Permanent Source" && "Permanent Volcano"
---
or rename the current volcano into lava and source into "wet earth"
This is to avoid finishing with a state where there is only earth.


Polish rules
---

- Water does not enough flow (maybe also enters too much in the ground).

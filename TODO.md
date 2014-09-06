Game Goal
---
- Protect & escort some wild animals into a safe place.
- end of the world from left to right. rush to the right. infinite exploration.

Implement game start & game end
---

Figure out the game play
---
- ?? hold it to size it bigger.
- ?? cooldown

Make infinite exploration possible
---
- accelerate the left destruction when width is high: trigger flames (bottom up fire drawing)

Implement animal graphics
---

Implement animal motion.
---
AI motion have to be realist.

- Element actions on animal:
  - Fire: burn
  - Water: slip
  - Air: push
- Animal reactions when see element:
  - Fire: fear (move away)
  - Cliff: fear (stay)
  - Water: nothing
  - Air: nothing

Improve map generation
---
- Cellular Automata to generate the world
  - Will save the need of perlin noise.
  - http://www.roguebasin.com/index.php?title=Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels


Improve design
---
- perlin noise for the earth?
- mushrooms grows when no water. if mushroom touches green -> green

How to make the game more challenging
---

- cooldown?
- limited actions?

Improve perfs
---

Figure out bottlenecks?


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

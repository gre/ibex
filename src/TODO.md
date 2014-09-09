Game Goal
===
- Protect & escort some wild animals into a safe place.
- end of the world from left to right. rush to the right. infinite exploration.

TODO
===
- polish gameplay: a central cursor & you switch between mode which make the elements UI slide
- Polish game progressive difficulty: volcano propagation increase? hell zone speed increase?
- Goal: Sleeping ibex in the map! go to wake & rescue them! (population increase, reason to go down)
- keep score in local storage
- miniature map (top-left) to visualize where the ibex are & the goal in the map
- bigger ibex count
- More variety in the design & events
  - season / weather? (rain, thunder)
  - day & night (different styles, illumination?)
  - general after effect (subtle lighting gradient from the middle)
  - More variety in generated terrains? (lot of air / lot of earth / a bit more forest)
    - To create more diversity: add a difference between "Forest" and "Mushroom": forest grows with water, mushroom grows by itself. if mushroom+water or mushrrom+forest -> become forest (forest spread in mushroom)
    - rarely have water source in caves?
    - rarely have volcanos?
- when left disappear make it blurred?
- Bugfix: resync before re-generating world
- Polish: Make sure animals are safe at spawn
- Bugfix: implement proper collision detection.
- Polish: improve animals decisions
- Polish: animal graphics?
- MOBILE support???

Improve performance of map generation
---
Should run in glsl ?

How to make the game more challenging
---
- cooldown?
- limited actions?

General Performance & bugfix
---

v0
- Load: (program) 6500ms
- GPU: 257 Mo, 9.0 - 9.5 %


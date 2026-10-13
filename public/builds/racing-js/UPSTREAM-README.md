# Racing JS
a 3D browser game

The [src](https://github.com/Antonio-R1/racing-js/tree/main/src) folder contains the original implentation withou any AI generated code,
the game can be played on <https://antonio-r1.github.io/racing-js/>,
the multiplayer game race can be found in the [src_multiplayer](https://github.com/Antonio-R1/racing-js/tree/main/src) folder,
the game can be played on <https://antonio-r1.github.io/racing-js/multiplayer>.

## Games

### Flight Over the Mountains
![Game Flight Over the Mountains](img/game_flight_over_the_mountains.jpg)
- Press the space bar for tilting the elevator up, release the space bar for tilting the elevator down.
- Press R for using the rockets for boosting the speed.

### Island
![Game Island](img/game_island.gif)
- See the controls for walking and the vehicles below.
- Try to pass through as many spheres as possible before the fuel of the airplane finishes.
- The blue spheres fill up the fuel of the airplane.

### Race (Multiplayer)
This game is not finished and will be added later.
#### Preview:
![Game Race](img/game_race.jpg)

## Controls
The game can be paused by pressing P.

### Pilot
- Arrow up: walk
- Arrows left and right: turn
- Space bar: jump
- Number keys: enter a vehicle

### Car
- Arrow up: accelerate
- Arrow down: brake
- Arrows left and right: steering
- C: change camera
- E: exit
- L: toggle the lights
- R: reverse gear
- S: reset position

### Airplane
- Mouse up and down: elevator
- Mouse left and right: ailerons
- Arrows left and right: rudder, steering
- +, -: increase, deacrease throttle
- C: change camera
- E: exit
- S: reset position

## Engine sound
- https://github.com/Antonio-R1/engine-sound-generator

## Deploy on github pages
`git subtree push --prefix src origin gh-pages`

## Third party software used in this game
- [Three.js](https://github.com/mrdoob/three.js)
- [stats.js](https://github.com/mrdoob/stats.js/)
- [ammo.js](https://github.com/kripken/ammo.js/)

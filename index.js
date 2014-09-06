var seed = Math.random();
Math.seedrandom(seed);

var C = document.createElement("canvas");

// Game constants

// in milliseconds
var updateRate = 35;
var refreshWorldRate = 200;
var initialAnimals = 0;

var colors = [
  0.11, 0.16, 0.23, // 0: air
  0.74, 0.66, 0.51, // 1: earth
  0.84, 0.17, 0.08, // 2: fire
  0.40, 0.75, 0.90, // 3: water

  // spawners
  0.60, 0.00, 0.00, // 4: volcano (fire spawner)
  0.30, 0.60, 0.70, // 5: source (water spawner)

  0.15, 0.20, 0.27,  // 6: wind left
  0.07, 0.12, 0.19,  // 7: wind right
  0.20, 0.60, 0.20   // 8: grass (forest)
];

var camAutoSpeed = 4;
var camAutoThreshold = 160;

// Game states
var tick = 0;
var worldRefreshTick = 0;
var worldSize = [ 256, 256 ];
var worldPixelRawBuf = new Uint8Array(worldSize[0] * worldSize[1] * 4);
var worldPixelBuf = new Uint8Array(worldSize[0] * worldSize[1]);
var worldStartX = 0;

var resolution;
var zoom = 4;
var camera = [ 0, 0 ]; // Camera is in resolution coordinate (not worldSize)
var cameraV = [0, 0];
var mouse = [ 0, 0 ];

var draw = 0;
var draggingElement = 0;
var drawPosition;
var drawObject;
var drawRadius;

var animals = [];

// Game events

window.addEventListener("resize", onResize);

function clamp (a, b, x) {
  return Math.max(a, Math.min(x, b));
}

function posToWorld (p) {
  return [ (camera[0] + p[0]) / zoom, (camera[1] + p[1]) / zoom ];
}

function setCam (c) {
  camera = [
    c[0], //clamp(0, zoom * worldSize[0] - resolution[0], c[0]),
    clamp(0, 50+zoom * worldSize[1] - resolution[1], c[1])
  ];
}

function posE (e) {
  return [ e.clientX, resolution[1] - e.clientY ];
}

function dist (a, b) {
  var dx = a[0] - b[0],
      dy = a[1] - b[1];
  return Math.sqrt(dx*dx+dy*dy);
}

/*
var dragStart;
var mousedownTime;
var dragCam;
var isValidDrag;
var autoScroll;

function resetMouse (e) {
  autoScroll = 0;
  isValidDrag = 0;
  dragCam = 0;
  dragStart = 0;
  draggingElement = 0;
  cameraV = [0,0];
  C.style.cursor = "default";
}
*/
var dragStart, dragCam, isValidDrag;

function resetMouse () {
  dragStart = dragCam = isValidDrag = 0;
  cameraV = [0,0];
  C.style.cursor = "default";
}

resetMouse();

function keyDraw () {
  var p = mouse;
  if (keysDown[87]||keysDown[90]) {
    draw = 1;
    drawPosition = posToWorld(p);
    drawObject = 0;
    drawRadius = 6;
  }
  else if (keysDown[88]) {
    draw = 1;
    drawPosition = posToWorld(p);
    drawObject = 1;
    drawRadius = 6;
  }
  else if (keysDown[67]) {
    draw = 1;
    drawPosition = posToWorld(p);
    drawObject = 2;
    drawRadius = 4;
  }
  else if (keysDown[86]) {
    draw = 1;
    drawPosition = posToWorld(p);
    drawObject = 3;
    drawRadius = 4;
  }
}

C.addEventListener("mouseleave", resetMouse);

C.addEventListener("mousemove", function (e) {
  var p = posE(e);
  mouse = p;
  if (dragStart) {
    var dx = p[0] - dragStart[0];
    var dy = p[1] - dragStart[1];

    if (dragCam) {
      setCam([ dragCam[0] - dx, dragCam[1] - dy ]);
    }
    else {
      var d = dist(dragStart, p);
      if (d > 60) {
        dragCam = [ camera[0] + dx, camera[1] + dy ];
        C.style.cursor = "move";
      }
      if (d > 10) {
        drawObject = 2 * (dy < 0) + (dx > 0);
        C.style.cursor = "pointer";
      }
      else {
        drawObject = -1;
        C.style.cursor = "default";
      }
    }
  }
  else {
    keyDraw();
  }
});

C.addEventListener("mousedown", function (e) {
  e.preventDefault();
  dragStart = posE(e);
  dragCam = 0;
  drawObject = -1;
  drawRadius = 10;
});

C.addEventListener("mouseup", function (e) {
  var p = posE(e);
  if (!dragCam && drawObject != -1) {
    draw = 1;
    drawPosition = posToWorld(dragStart);
    drawRadius = 10;
  }
  resetMouse();
});



// Keyboard

var keysDown = new Uint8Array(200); // we do that because nicely initialized to 0

//
//       38
//    37 40 39
//
function handleKeys () {
  var s = 6,
      dx = keysDown[39]-keysDown[37],
      dy = keysDown[38]-keysDown[40];
  cameraV = [ s*dx, s*dy ];
  keyDraw();
}

document.addEventListener("keyup", function (e) {
  keysDown[e.which] = 0;
  handleKeys();
});

document.addEventListener("keydown", function (e) {
  var w = e.which;
  keysDown[w] = 1;
  if (37 <= w && w <= 40/* || w==87 || w==90 || w==88 || w==67 || w==86*/) {
    e.preventDefault();
  }
  handleKeys();
});

///////// UTILS /////////////////////

function ground (i) {
  return i == 1 || i == 4 || i == 5;
}

/////////// ANIMAL ///////////////////

var sightw = 24,
    sighth = 18,
    sighthalfw = sightw / 2,
    sighthalfh = sighth / 2;

function Animal (initialPosition) {
  // p: position, t: targetted position
  this.p = initialPosition;
  this.t = 0;
  // v: velocity
  this.v = [0, 0];
  // b: The buffer of the animal is its vision
  this.b = new Uint8Array(sightw * sighth);
  // dt: next decision time
  this.dt = 0;

  // this.d <- died flag
  // this.sl <- stats left
  // this.sr <- stats right
  // this.h <- hash for caching the animalSyncSight
}

function animalPixel (animal, x, y) {
  var sx = Math.floor(animal.p[0] - sighthalfw) + x - worldStartX;
  if (sx < 0 || sx >= worldSize[0]) return 1;
  var sy = Math.floor(animal.p[1] - sighthalfh) + y;
  if (sy < 0 || sy >= worldSize[1]) return 1;
  return worldPixelBuf[sx + sy * worldSize[0]];
}

// Animal functions
// I'm not doing prototype to save bytes (better limit the usage of fields which are hard to minimize)

function animalSyncSight (animal) {

  /**
   * Stats:
   * sl & sr are 2 arrays of left & right exploration stats.
   *
   * Each array contains an object with:
   * f (floor): the position of a solid block (under the animal)
   * c (ceil): the position of the ceil on top of this solid block
   * h (height): ceil - floor - 1
   * s (slope): the slope in pixels – how much pixel to reach next pixels? (pixels because may be smoothed)
   * e (elements): count of elements in the [floor,ceil] range. (array with same indexes)
   * a (accessible): 1 if next pixel can be accessed. 0 otherwise
   *
   * The array also contains fields:
   * a (accessible count): number of pixels that can be accessed
   */
  function stats (dir) {
    var a, x, y, i, ret = [];

    var floors = [];
    for (x=sighthalfw, y=sighthalfh; 0<=x && x<sightw; x += dir) {
      if (y == sighth) y--;
      if (y == -1) y++;
      while (y < sighth && ground(animalPixel(animal, x, y))) y++;
      if (y < sighth) while (y >= 0 && !ground(animalPixel(animal, x, y))) y--;
      floors.push(y);
    }

    var countA = 0;
    for (i=0, x=sighthalfw, a=1; 0<=x && x<sightw; x += dir, ++i) {
      var f = floors[i],
          c,
          h,
          s,
          e = [0,0,0,0,0,0,0,0,0];
      var pixels = new Uint8Array(sighth);
      for (y=0; y<sighth; ++y) pixels[y] = animalPixel(animal, x, y);

      // Compute slope
      s = ((y<sighth-1 ? floors[i+1] : f) + (y<sighth-2 ? floors[i+2] : f))/2 - f; // TODO smoothed version
      // Compute ceil
      for (c = f+1; c<sighth && !ground(pixels[c]); c++);
      // Compute height
      h = c - f - 1;
      // Stop if conditions are reachable for the animal
      if (h < 4 /* min height */ || Math.abs(s) > 3 /* max fall / climb */) {
        a = 0;
      }
      // Compute elements
      for (y=f; y<=c; ++y) e[pixels[y]] ++;

      ret.push({f:f,c:c,h:h,s:s,e:e,a:a});
      if (a) countA ++;
    }
    ret.a = countA;
    return ret;
  }
  animal.sl = stats(-1);
  animal.sr = stats(1);
}

/**
 * reasons
 * 0: falls in a cliff
 * 1: stuck in earth
 * 2: burned by fire
 */
function animalDie (animal, reason) {
  animal.d = 1;
  console.log(["falls in a cliff","stuck in earth","burned by fire"][reason], animal);
}

function animalUpdate (animal) {
  if (animal.d) return;
  animalSyncSight(animal);

  var x, y, i,
      s = animal.sl[0],
      f = s.f,
      groundDiff = sighthalfh - (f + 1);

  // fire burns animal
  if (s.e[2]) {
    for (y=0; y<=5; ++y) {
      if (animalPixel(animal, sighthalfw, sighthalfh + y) == 2) {
        animalDie(animal, 2);
        break;
      }
    }
  }

  // animal reaches the ground violently
  if (!groundDiff && animal.v[1] < -2) {
    return animalDie(animal, 0);
  }

  if (groundDiff) {
    // ground buries animal
    if (f > sighthalfh && groundDiff < -4) return animalDie(animal, 1);

    if (groundDiff > 0) {
      // Gravity
      animal.v[1] -= 0.12;
    }
    else {
      // move up
      animal.p[1] -= groundDiff;
    }
  }
  else {
    animal.v[1] = 0;
    animal.p[1] = Math.floor(animal.p[1]);
  }

  // Edge case where the animal would fall forever
  if (animal.p[1] < 0) return animalDie(animal, 0);

  animalSyncSight(animal);

  //// Animal decision (each 500ms - 1s)

  var now = Date.now();
  if (now > animal.dt) {
    animal.dt = now + 500 + 500 * Math.random();

    // TODO: calculate the center of animals & have more chance to try to reach it.
    var r = Math.random();
    if (r < 0.2) {
      animal.t = 0.01 * (0.5-Math.random());
    }
    else if (r < 0.8) {
      var d = animal.sr.a - animal.sl.a + 3 * Math.random();
      animal.t = d>=0 ? 0.6 : -0.6;
    }

    var maxFireSee = sighthalfw;
    var fire = 0;
    for (i=0; i<maxFireSee; ++i) {
      if (animal.sl[i] && animal.sl[i].e[2]) {
        fire = -1;
        break;
      }
      if (animal.sr[i] && animal.sr[i].e[2]) {
        fire = 1;
        break;
      }
    }
    if (fire) {
      animal.t = -1.2 * fire;
    }

    if (Math.random()<0.2) {
      // Jump
      var dir = 1;
      animal.p[1] ++;
      animal.v[0] = 1 * dir;
      animal.v[1] = 1;
    }

    animalSyncSight(animal);
  }

  //// Animal apply move & check collision

  if (groundDiff == 0) {
    animal.v[0] = 0.4 * animal.t;
  }

  // TODO hit wall detection

  var p = [ animal.p[0] + animal.v[0], animal.p[1] + animal.v[1] ];
  if (groundDiff == 0) {
    var dx = Math.floor(p[0]) - Math.floor(animal.p[0]);
    if (dx) {
      var s = dx > 0 ? animal.sr : animal.sl;
      dx = Math.abs(dx);
      if (s[dx] && s[dx].a) {
        animal.p = p;
      }
    }
    else {
      animal.p = p;
    }
  }
  else {
    animal.p = p;
  }
}

//////////////////////////////////////

var gl = C.getContext("webgl") || C.getContext("experimental-webgl");

var shader, shaderSrc, shaderType, program;

/// Rendering program
program = gl.createProgram();

shaderSrc = vertexRender.innerHTML; shaderType = gl.VERTEX_SHADER;
shader = gl.createShader(shaderType);
gl.shaderSource(shader, shaderSrc);
gl.compileShader(shader);
validate(shader, shaderSrc);
gl.attachShader(program, shader);

shaderSrc = fragmentRender.innerHTML; shaderType = gl.FRAGMENT_SHADER;
shader = gl.createShader(shaderType);
gl.shaderSource(shader, shaderSrc);
gl.compileShader(shader);
validate(shader, shaderSrc);
gl.attachShader(program, shader);

gl.linkProgram(program);
validateProg(program);
gl.useProgram(program);

var buffer = gl.createBuffer();
var renderPositionL = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(renderPositionL);
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.vertexAttribPointer(renderPositionL, 2, gl.FLOAT, false, 0, 0);

onResize();

var renderTimeL = gl.getUniformLocation(program, "time");
var renderZoomL = gl.getUniformLocation(program, "zoom");
var renderStateL = gl.getUniformLocation(program, "state");
var renderWorldSizeL = gl.getUniformLocation(program, "worldSize");
var renderAnimalsPL = gl.getUniformLocation(program, "animalsP");
var renderAnimalsVL = gl.getUniformLocation(program, "animalsV");
var renderAnimalsLengthL = gl.getUniformLocation(program, "animalsLength");
var renderColorsL = gl.getUniformLocation(program, "colors");
var renderDrawObjectL = gl.getUniformLocation(program, "drawObject");
var renderDrawDragL = gl.getUniformLocation(program, "draggingElement");
var renderDrawRadiusL = gl.getUniformLocation(program, "drawRadius");

var cameraL = gl.getUniformLocation(program, "camera");
var mouseL = gl.getUniformLocation(program, "mouse");
var dragStartL = gl.getUniformLocation(program, "dragStart");
var enableCursorL = gl.getUniformLocation(program, "enableCursor");
var resolutionL = gl.getUniformLocation(program, "resolution");

gl.uniform1i(renderStateL, 0);
gl.uniform3fv(renderColorsL, colors);

function onResize () {
  resolution = [
    Math.max(600, window.innerWidth),
    Math.max(400, window.innerHeight)
  ];
  C.width = resolution[0];
  C.height = resolution[1];
  gl.viewport(0, 0, C.width, C.height);
  var x1 = 0, y1 = 0, x2 = resolution[0], y2 = resolution[1];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2]), gl.STATIC_DRAW);
  gl.uniform2fv(resolutionL, resolution);
}

var renderProgram = program;

/// Logic program
program = gl.createProgram();

shaderSrc = vertexLogic.innerHTML; shaderType = gl.VERTEX_SHADER;
shader = gl.createShader(shaderType);
gl.shaderSource(shader, shaderSrc);
gl.compileShader(shader);
validate(shader, shaderSrc);
gl.attachShader(program, shader);

shaderSrc = fragmentLogic.innerHTML; shaderType = gl.FRAGMENT_SHADER;
shader = gl.createShader(shaderType);
gl.shaderSource(shader, shaderSrc);
gl.compileShader(shader);
validate(shader, shaderSrc);
gl.attachShader(program, shader);

gl.linkProgram(program);
validateProg(program);

var logicSeedL = gl.getUniformLocation(program, "seed");
var logicTickL = gl.getUniformLocation(program, "tick");
var logicColorsL = gl.getUniformLocation(program, "colors");
var logicStateL = gl.getUniformLocation(program, "state");
var logicSizeL = gl.getUniformLocation(program, "size");
var logicDrawL = gl.getUniformLocation(program, "draw");
var logicDrawPositionL = gl.getUniformLocation(program, "drawPosition");
var logicDrawObjectL = gl.getUniformLocation(program, "drawObject");
var logicDrawRadiusL = gl.getUniformLocation(program, "drawRadius");
var logicPositionL = gl.getAttribLocation(program, "position");

gl.enableVertexAttribArray(logicPositionL);

var logicTexture = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, logicTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

var logicFramebuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, logicFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, logicTexture, 0);

gl.useProgram(program);
gl.uniform1f(logicSeedL, seed);
gl.uniform1i(logicStateL, 0);
gl.uniform3fv(logicColorsL, colors);

var logicProgram = program;


function step (a, b, x) {
  return Math.max(0, Math.min((x-a) / (b-a), 1));
}

function affectColor (buf, i, c) {
  buf[i+0] = 255 * colors[c * 3+0];
  buf[i+1] = 255 * colors[c * 3+1];
  buf[i+2] = 255 * colors[c * 3+2];
  buf[i+3] = 255;
}

function generate(startX) {
  // TODO refactor with cellular automata
  var i;
  var perlin = generatePerlinNoise(worldSize[0], worldSize[1], 5, 0.1, 0.03);
  for(i = 0; i < worldPixelBuf.length; i ++) {
    var r = perlin[i];
    var x = i % worldSize[0];
    var y = Math.floor(i / worldSize[0]);
    var e;
    if (startX <= x) {
      if (r < 0.25 + 0.6 * step(50, 0, y) - step(worldSize[1]-60, worldSize[1], y) || r > 0.7 - 0.4 * step(40, 0, y) + 0.2 * step(worldSize[1]-30, worldSize[1], y) ) {
        e = 1;
      }
      else {
        e = 0;
      }

      worldPixelBuf[i] = e;
    }
    else {
      e = worldPixelBuf[i];
    }
    affectColor(worldPixelRawBuf, 4 * i, e);
  }

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, worldSize[0], worldSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, worldPixelRawBuf);
}

function rechunk (fromX, toX) {
  update(1);
  var newWorldSize = [ toX-fromX, worldSize[1] ];
  var newWorldPixelRawBuf = new Uint8Array(newWorldSize[0] * newWorldSize[1] * 4);
  var newWorldPixelBuf = new Uint8Array(newWorldSize[0] * newWorldSize[1]);
  var genStartX = worldSize[0] - fromX;

  for (var x=0; x < newWorldSize[0] && fromX + x < worldSize[0]; ++x) {
    for (var y=0; y < newWorldSize[1]; ++y) {
      var e = worldPixelBuf[fromX + x + y * (worldSize[0])];
      var i = x + y * newWorldSize[0];
      newWorldPixelBuf[i] = e;
    }
  }

  worldSize = newWorldSize;
  worldPixelRawBuf = newWorldPixelRawBuf;
  worldPixelBuf = newWorldPixelBuf;
  worldStartX = fromX;
  generate(genStartX);

  camera[0] -= zoom * fromX;
}

//////////// RUN THE GAME /////////////////

generate(0);

for (i = 0; i < initialAnimals; ++i) {
  var x = Math.floor(50 + i * (5+4*Math.random()) + 50 * Math.random());
  var y = Math.floor(50 + 200 * Math.random());
  var a = new Animal([ x, y ]);
  animals.push(a);
}

var start = Date.now();
var lastUpdate = 0;
var lastRefreshWorld = 0; // Help the GPU to not spam request of "readPixels"
function update (forceRead) {
  var now = Date.now();
  if (!forceRead && now-lastUpdate < updateRate) return;
  lastUpdate = now;
  gl.useProgram(logicProgram);
  gl.uniform2fv(logicSizeL, worldSize);
  gl.uniform1f(logicTickL, tick);
  gl.uniform1i(logicDrawL, draw);
  if (draw) {
    draw = 0;
    gl.uniform2iv(logicDrawPositionL, drawPosition);
    gl.uniform1f(logicDrawRadiusL, drawRadius);
    gl.uniform1i(logicDrawObjectL, drawObject);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(logicPositionL, 2, gl.FLOAT, gl.FALSE, 0, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, logicFramebuffer);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  if (forceRead || now - lastRefreshWorld >= refreshWorldRate) {
    lastRefreshWorld = now;
    gl.readPixels(0, 0, worldSize[0], worldSize[1], gl.RGBA, gl.UNSIGNED_BYTE, worldPixelRawBuf);
    parseColors(worldPixelRawBuf, worldPixelBuf);
    worldRefreshTick ++;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  tick ++;
}

(function render () {
  update();
  for (var i=0; i<animals.length; ++i) {
    var animal = animals[i];
    animalUpdate(animal);
  }

  setCam([ camera[0]+cameraV[0], camera[1]+cameraV[1] ]);

  var animalPositions = [];
  var animalVelocities = [];
  for (var i=0; i<animals.length; ++i) {
    var animal = animals[i];
    animalPositions.push(animal.p[0] - worldStartX);
    animalPositions.push(animal.p[1]);
    animalVelocities.push(animal.v[0]);
    animalVelocities.push(animal.v[1]);
  }

  var time = (Date.now()-start)/1000;
  gl.useProgram(renderProgram);
  gl.uniform2fv(renderWorldSizeL, worldSize);
  gl.uniform1f(renderTimeL, time);
  gl.uniform1f(renderZoomL, zoom);
  gl.uniform2fv(cameraL, camera);
  gl.uniform2fv(mouseL, mouse);
  if (dragStart) gl.uniform2fv(dragStartL, dragStart);
  gl.uniform1i(enableCursorL, !!dragStart && !dragCam);
  if (animals.length) {
    gl.uniform2fv(renderAnimalsPL, animalPositions);
    gl.uniform2fv(renderAnimalsVL, animalVelocities);
  }
  gl.uniform1i(renderAnimalsLengthL, animals.length);
  gl.uniform1i(renderDrawDragL, draggingElement);
  gl.uniform1f(renderDrawRadiusL, drawRadius);
  gl.uniform1i(renderDrawObjectL, drawObject);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(renderPositionL, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}());

document.body.innerHTML = '';
document.body.appendChild(C);

///////////// UTILITIES ////////////////////

function parseColors (bufin, bufout) {
  // bufin: RGBA colors, bufout: element indexes
  // bufin size == 4 * bufout size
  for (var i=0; i<bufin.length; i += 4) {
    for (var c=0; c<colors.length; c += 3) {
      var diff = 0;
      for (var j=0; j<3; ++j) {
        var d = colors[c + j] - (bufin[i+j]/256);
        diff += d * d;
      }
      if (diff < 0.001) break;
    }
    bufout[i/4] = c / 3;
  }
}


function generatePerlinNoise(width, height, octaveCount, amplitude, persistence) {
  var whiteNoise = generateWhiteNoise(width, height);

  var smoothNoiseList = new Array(octaveCount);
  var i;
  for (i = 0; i < octaveCount; ++i) {
    smoothNoiseList[i] = generateSmoothNoise(i);
  }
  var perlinNoise = new Array(width * height);
  var totalAmplitude = 0;
  // blend noise together
  for (i = octaveCount - 1; i >= 0; --i) {
    amplitude *= persistence;
    totalAmplitude += amplitude;

    for (var j = 0; j < perlinNoise.length; ++j) {
      perlinNoise[j] = perlinNoise[j] || 0;
      perlinNoise[j] += smoothNoiseList[i][j] * amplitude;
    }
  }
  // normalization
  for (i = 0; i < perlinNoise.length; ++i) {
      perlinNoise[i] /= totalAmplitude;
  }

  return perlinNoise;

  function generateSmoothNoise(octave) {
    var noise = new Array(width * height);
    var samplePeriod = Math.pow(2, octave);
    var sampleFrequency = 1 / samplePeriod;
    var noiseIndex = 0;
    for (var y = 0; y < height; ++y) {
      var sampleY0 = Math.floor(y / samplePeriod) * samplePeriod;
      var sampleY1 = (sampleY0 + samplePeriod) % height;
      var vertBlend = (y - sampleY0) * sampleFrequency;
      for (var x = 0; x < width; ++x) {
        var sampleX0 = Math.floor(x / samplePeriod) * samplePeriod;
        var sampleX1 = (sampleX0 + samplePeriod) % width;
        var horizBlend = (x - sampleX0) * sampleFrequency;

        // blend top two corners
        var top = interpolate(whiteNoise[sampleY0 * width + sampleX0], whiteNoise[sampleY1 * width + sampleX0], vertBlend);
        // blend bottom two corners
        var bottom = interpolate(whiteNoise[sampleY0 * width + sampleX1], whiteNoise[sampleY1 * width + sampleX1], vertBlend);
        // final blend
        noise[noiseIndex] = interpolate(top, bottom, horizBlend);
        noiseIndex += 1;
      }
    }
    return noise;
  }
}
function generateWhiteNoise(width, height) {
  var noise = new Array(width * height);
  for (var i = 0; i < noise.length; ++i) {
    noise[i] = Math.random();
  }
  return noise;
}
function interpolate(x0, x1, alpha) {
  return x0 * (1 - alpha) + alpha * x1;
}


// Of-course this will go away !

function validate (shader, shaderSource) {
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    var lastError = gl.getShaderInfoLog(shader);
    var split = lastError.split(":");
    var col = parseInt(split[1], 10);
    var line = parseInt(split[2], 10);
    var s = "";
    if (!isNaN(col)) {
      var spaces = ""; for (var i=0; i<col; ++i) spaces+=" ";
      s = "\n"+spaces+"^";
    }
    console.log(lastError+"\n"+shaderSource.split("\n")[line-1]+s);
    gl.deleteShader(shader);
    throw new Error(shader+" "+lastError);
  }
}
function validateProg (program) {
   var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
   if (!linked) {
     gl.deleteProgram(program);
     throw new Error(program+" "+gl.getProgramInfoLog(program));
   }
}


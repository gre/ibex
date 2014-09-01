Math.seedrandom(Math.floor(Date.now() / 60000));

// Game states
var tick = 0;
var worldSize = [ 768, 256 ];
var worldPixelRawBuf = new Uint8Array(worldSize[0] * worldSize[1] * 4);
var worldPixelBuf = new Uint8Array(worldSize[0] * worldSize[1]);
var resolution;
var zoom = 4;
var camera = [ 0, 0 ]; // Camera is in resolution coordinate (not worldSize)
var mouse = [ 0, 0 ];

var draw = 0;
var draggingElement = 0;
var drawPosition;
var drawObject;
var drawRadius = 8;

var animals = [];

// Game constants

// in milliseconds
var updateRate = 35;
var refreshWorldRate = 200;

var uiElements = [0, 1, 4, 5];
var uiButtonSize = 50;

var colors = [
  0.11, 0.16, 0.23, // 0: nothing
  0.74, 0.66, 0.51, // 1: earth
  0.84, 0.17, 0.08, // 2: fire
  0.40, 0.80, 0.95, // 3: water

  // spawners
  0.60, 0.00, 0.00, // 4: volcano
  0.27, 0.63, 0.70, // 5: source of water

  0.2, 0.25, 0.35,  // 6: air left
  0.2, 0.3, 0.35  // 7: air right
];


// Game events

window.addEventListener("resize", onResize);

var dragStart;
var mousedownTime;
var dragCam;

function posToWorld (p) {
  return [ (camera[0] + p[0]) / zoom, (camera[1] + p[1]) / zoom ];
}
function resetMouse (e) {
  dragCam = null;
  dragStart = null;
  draggingElement = 0;
  C.style.cursor = "default";
}

C.addEventListener("mouseleave", resetMouse);

C.addEventListener("mousedown", function (e) {
  e.preventDefault();
  dragStart = posE(e);
  mousedownTime = Date.now();
  var xElIndex = Math.floor(dragStart[0] / uiButtonSize);
  if (dragStart[1] < uiButtonSize && xElIndex < uiElements.length) {
    draggingElement = 1;
    drawObject = uiElements[xElIndex];
    C.style.cursor = "move";
  }
  else {
    C.style.cursor = "move";
    dragCam = [].concat(camera);
  }
});
C.addEventListener("mouseup", function (e) {
  var p = posE(e);
  if (draggingElement) {
    draw = 1;
    drawPosition = posToWorld(p);
  }
  resetMouse();
});
C.addEventListener("mousemove", function (e) {
  var p = posE(e);
  mouse = p;
  if (dragCam) {
    e.preventDefault();
    var dx = p[0] - dragStart[0];
    var dy = p[1] - dragStart[1];
    camera = [ dragCam[0] - dx, dragCam[1] - dy ];
  }
  else if (draggingElement) {

  }
  else {
    var xElIndex = Math.floor(p[0] / uiButtonSize);
    if (p[1] < uiButtonSize && xElIndex < uiElements.length) {
      C.style.cursor = "pointer";
    }
    else {
      C.style.cursor = "default";
    }
  }
});

function posE (e) {
  return [ e.clientX, resolution[1] - e.clientY ];
}

document.addEventListener("keydown", function (e) {
//
//       38
//    37 40 39
  var dx = 0, dy = 0;
  switch (e.which) {
    case 38: dy = 1; break;
    case 40: dy = -1; break;
    case 37: dx = -1; break;
    case 39: dx = 1; break;
  }
  camera[0] += 8 * dx;
  camera[1] += 8 * dy;

  /*
  if (e.keyCode == 86) drawObject = 4;
  if (e.keyCode == 78) drawObject = 0;
  if (e.keyCode == 83) drawObject = 5;
  */
  
  if (dx || dy)
    e.preventDefault();
});


/////////// ANIMAL ///////////////////

var sightw = 32, sighth = 12;
var sighthalfw = sightw / 2, sighthalfh = sighth / 2;

function Animal (pos) {
  // The buffer of the animal is its vision
  this.p = pos;
  this.v = [0, 0];
  this.s = null;
  this.b = new Uint8Array(sightw * sighth);
}

// Animal functions
// I'm not doing prototype to save bytes (better limit the usage of fields which are hard to minimize)

function animalSyncSight (animal) {
  var sx = Math.floor(animal.p[0] - sighthalfw);
  var sy = Math.floor(animal.p[1] - sighthalfh);
  this.s = [sx,sy];
  for (var x=0; x<sightw; ++x) {
    for (var y=0; y<sighth; ++y) {
      var wx = x + sx;
      var wy = y + sy;
      animal.b[x + y * sightw] = wx<0||wy<0||wx>=worldSize[0]||wy>=worldSize[1] ? 0 : worldPixelBuf[wx+wy*worldSize[0]];
    }
  }
}

function animalAI (animal) {
  // TODO
}

function ground (i) {
  return i == 1 || i == 4 || i == 5;
}

function animalUpdate (animal) {
  var i, y;
  animalSyncSight(animal);

  animal.p[0] += animal.v[0];
  animal.p[1] += animal.v[1];

  // Ground will push up
  y = 0;
  do {
    i = sightw * (sighthalfh + y) + sighthalfw;
    y ++;
  } while (0 <= i && i < sightw * sighth && ground(animal.b[i]));

  animalSyncSight(animal);
  animal.p[1] += y;

  y = 1;
  do {
    i = sightw * (sighthalfh + y) + sighthalfw;
    y --;
  } while (0 <= i && i < sightw * sighth && !ground(animal.b[i]));
  y ++;

  animal.p[1] += y;

  /*
  for (
    i = sightw*(1+sighthalfh) + sighthalfw;
    i > 0 && ground(animal.b[i]);
    i -= sightw, animal.p[1] ++
  ) {
  }
  */

  // Gravity
  /*
  for (
    i = sightw*(-1+sighthalfh) + sighthalfw;
    i < sightw * sighth && !ground(animal.b[i]);
    i += sightw, animal.p[1] --
  ) {
  }
  */
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
var renderAnimalsL = gl.getUniformLocation(program, "animals");
var renderAnimalsLengthL = gl.getUniformLocation(program, "animalsLength");
var renderColorsL = gl.getUniformLocation(program, "colors");
var renderUiElementsL = gl.getUniformLocation(program, "uiElements");
var renderDrawObjectL = gl.getUniformLocation(program, "drawObject");
var renderDrawDragL = gl.getUniformLocation(program, "draggingElement");
var renderDrawRadiusL = gl.getUniformLocation(program, "drawRadius");

var cameraL = gl.getUniformLocation(program, "camera");
var mouseL = gl.getUniformLocation(program, "mouse");
var resolutionL = gl.getUniformLocation(program, "resolution");

gl.uniform1i(renderStateL, 0);
gl.uniform2fv(renderWorldSizeL, worldSize);
gl.uniform3fv(renderColorsL, colors);
gl.uniform1iv(renderUiElementsL, uiElements);

function onResize () {
  resolution = [ window.innerWidth, window.innerHeight ];
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

function step (a, b, x) {
  return Math.max(0, Math.min((x-a) / (b-a), 1));
}

function affectColor (buf, i, c) {
  buf[i+0] = 255 * colors[c * 3+0];
  buf[i+1] = 255 * colors[c * 3+1];
  buf[i+2] = 255 * colors[c * 3+2];
  buf[i+3] = 255;
}

var data = new Uint8Array(4 * worldSize[0] * worldSize[1]);
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
gl.uniform1i(logicStateL, 0);
gl.uniform2fv(logicSizeL, worldSize);
gl.uniform3fv(logicColorsL, colors);

var logicProgram = program;

//////////// RUN THE GAME /////////////////

var i;
var perlin = generatePerlinNoise(worldSize[0], worldSize[1], 5, 0.1, 0.03);
var lowestYs = [];
for(i = 0; i < data.length; i += 4) {
  var j = i / 4;
  var r = perlin[j];
  var x = j % worldSize[0];
  var y = Math.floor(j / worldSize[0]);

  if (r < 0.3 + 0.6 * step(20, 0, y) - step(worldSize[1]-60, worldSize[1], y) || r > 0.65 - 0.4 * step(30, 0, y) + 0.2 * step(worldSize[1]-30, worldSize[1], y) ) {
    // Earth
    affectColor(data, i, 1);
    // Volcano
    if (r < 0.25 * step(80, 0, y)) affectColor(data, i, 4);
    // Source
    if (r > 1.0 - 0.2 * step(worldSize[1] - 150, worldSize[1], y)) affectColor(data, i, 5);
  }
  else {
    if (!lowestYs[x]) lowestYs[x] = y;
  }
  /*

  if (0.60 < r) affectColor(data, i, 1);
  if (0.85 < r) affectColor(data, i, 5);
  */
}

for (i = 0; i<16; ++i) {
  var x = 50 + i * 4;
  var y = lowestYs[x];
  var a = new Animal([ x, y ]);
  a.v[0] = Math.random();
  animals.push(a);
}

animals.push(new Animal([ 10, 50 ]));
animals.push(new Animal([ 20, 100 ]));
animals.push(new Animal([ 30, 150 ]));

gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, worldSize[0], worldSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

var start = Date.now();
var lastUpdate = 0;
var lastRefreshWorld = 0;
function update () {
  var now = Date.now();
  if (now-lastUpdate < updateRate) return;
  lastUpdate = now;
  gl.useProgram(logicProgram);
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
  if (now - lastRefreshWorld >= refreshWorldRate) {
    lastRefreshWorld = now;
    gl.readPixels(0, 0, worldSize[0], worldSize[1], gl.RGBA, gl.UNSIGNED_BYTE, worldPixelRawBuf);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  parseColors(worldPixelRawBuf, worldPixelBuf);

  tick ++;
}

(function render () {
  update();
  for (var i=0; i<animals.length; ++i) {
    var animal = animals[i];
    animalUpdate(animal);
  }

  var animalData = [];
  for (var i=0; i<animals.length; ++i) {
    var animal = animals[i];
    animalData.push(animal.p[0]);
    animalData.push(animal.p[1]);
  }

  var time = (Date.now()-start)/1000;
  gl.useProgram(renderProgram);
  gl.uniform1f(renderTimeL, time);
  gl.uniform1f(renderZoomL, zoom);
  gl.uniform2fv(cameraL, camera);
  gl.uniform2fv(mouseL, mouse);
  gl.uniform2fv(renderAnimalsL, animalData);
  gl.uniform1i(renderAnimalsLengthL, animals.length);
  gl.uniform1i(renderDrawDragL, draggingElement);
  if (draggingElement) {
    gl.uniform1f(renderDrawRadiusL, drawRadius);
    gl.uniform1i(renderDrawObjectL, drawObject);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(renderPositionL, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}());


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





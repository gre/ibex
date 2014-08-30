var size = 128;
C.width = C.height = size * 4;
var gl = C.getContext("webgl") || C.getContext("experimental-webgl");

var updateRate = 50;

var colors = [
  0.11, 0.16, 0.23, // 0: air
  0.74, 0.66, 0.51, // 1: earth
  0.84, 0.17, 0.08, // 2: fire
  0.40, 0.80, 0.95, // 3: water

  // spawners
  0.60, 0.00, 0.00, // 4: volcano
  0.27, 0.63, 0.70, // 5: source of water

  0.66, 0.71, 0.71  // 6: air (aka wind)
];

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

gl.viewport(0, 0, C.width, C.height);
var resolutionLocation = gl.getUniformLocation(program, "resolution");
gl.uniform2f(resolutionLocation, C.width, C.height);
var x1 = 0, y1 = 0, x2 = C.width, y2 = C.height;
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      x1, y1,
      x2, y1,
      x1, y2,
      x1, y2,
      x2, y1,
      x2, y2]), gl.STATIC_DRAW);

var renderTimeL = gl.getUniformLocation(program, "time");
var renderLogicL = gl.getUniformLocation(program, "logic");
var renderSizeL = gl.getUniformLocation(program, "size");

gl.uniform2fv(renderSizeL, [size, size]);

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

var logicTimeL = gl.getUniformLocation(program, "time");
var logicColorsL = gl.getUniformLocation(program, "colors");
var logicStateL = gl.getUniformLocation(program, "state");
var logicSizeL = gl.getUniformLocation(program, "size");
var logicPositionL = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(logicPositionL);

function affectColor (buf, i, c) {
  buf[i+0] = 255 * colors[c * 3+0];
  buf[i+1] = 255 * colors[c * 3+1];
  buf[i+2] = 255 * colors[c * 3+2];
  buf[i+3] = 255;
}

var perlin = generatePerlinNoise(size, size);
var perlin2 = generatePerlinNoise(size, size);

var data = new Uint8Array(4 * size * size);
for(var i = 0; i < data.length; i += 4) {
  var r = Math.floor(Math.random() * colors.length);
  //affectColor(data, i, r);
  if (perlin[i/4] > 0.55) affectColor(data, i, 1);
  if (perlin[i/4] > 0.8) affectColor(data, i, 4);
  if (perlin2[i/4] < 0.15) affectColor(data, i, 5);
}

var logicTexture = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, logicTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

var logicFramebuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, logicFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, logicTexture, 0);

gl.useProgram(program);
gl.uniform1i(logicStateL, 0);
gl.uniform2fv(logicSizeL, [size, size]);
gl.uniform3fv(logicColorsL, colors);

var logicProgram = program;

var start = Date.now();
(function update () {
  var time = (Date.now()-start)/1000;
  gl.useProgram(logicProgram);
  gl.uniform1f(logicTimeL, time);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(logicPositionL, 2, gl.FLOAT, gl.FALSE, 0, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, logicFramebuffer);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  setTimeout(update, updateRate);
}());

(function render () {
  var time = (Date.now()-start)/1000;
  gl.useProgram(renderProgram);
  gl.uniform1i(renderLogicL, 0);
  gl.uniform1f(renderTimeL, time);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(renderPositionL, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}());



function generatePerlinNoise(width, height, options) {
  options = options || {};
  var octaveCount = options.octaveCount || 4;
  var amplitude = options.amplitude || 0.1;
  var persistence = options.persistence || 0.2;
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





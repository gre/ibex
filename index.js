var size = 128;
C.width = C.height = size * 4;
var gl = C.getContext("webgl") || C.getContext("experimental-webgl");

var colors = [
  0, 0, 0, // 0: air
  190/255, 170/255, 130/255, // 1: ground
  215/255, 45/255, 20/255, // 2: fire
  69/255, 160/255, 180/255, // 3: water
  170/255, 180/255, 180/255 // 4: air
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

var data = new Uint8Array(4 * size * size);
for(var i = 0; i < data.length; i += 4) {
  var r = Math.floor(Math.random() * colors.length);
  //affectColor(data, i, r);
  if (i/4 == size * size / 2 - size * 0.5) affectColor(data, i, 1);
  if (Math.random() < 0.0001) affectColor(data, i, 1);
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
(function loop () {
  var time = (Date.now()-start)/1000;
  gl.useProgram(logicProgram);
  gl.uniform1f(logicTimeL, time);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(logicPositionL, 2, gl.FLOAT, gl.FALSE, 0, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, logicFramebuffer);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);


  gl.useProgram(renderProgram);
  gl.uniform1i(renderLogicL, 0);
  gl.uniform1f(renderTimeL, time);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(renderPositionL, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  setTimeout(loop, 50);
}());


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

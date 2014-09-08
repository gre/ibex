precision highp float;

uniform vec3 colors[9];

uniform vec2 worldSize;
uniform vec2 resolution;

uniform float zoom;
uniform vec2 camera;
uniform vec2 mouse;
//uniform vec2 dragStart;
uniform bool enableCursor;
uniform bool started;
uniform bool gameover;
uniform float score;

uniform float time;
uniform sampler2D state;
uniform float animals[8 * 20]; // array of [x, y, vx, vy, size, deathReason, deathTime, slope]
uniform int animalsLength;
uniform sampler2D tiles;

uniform bool draggingElement;
uniform float drawRadius;
uniform int drawObject;

float rand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// Digits display source: http://glslsandbox.com/e#19207.5
float c_0 = 31599.0;
float c_1 = 9362.0;
float c_2 = 29671.0;
float c_3 = 29391.0;
float c_4 = 23497.0;
float c_5 = 31183.0;
float c_6 = 31215.0;
float c_7 = 29257.0;
float c_8 = 31727.0;
float c_9 = 31695.0;
float extract_bit(float n, float b) {
  n = floor(n);
  b = floor(b);
  b = floor(n/pow(2.,b));
  return float(mod(b,2.) == 1.);
}
float sprite(float n, float w, float h, vec2 p) {
  float bounds = float(all(lessThan(p,vec2(w,h))) && all(greaterThanEqual(p,vec2(0,0))));
  return extract_bit(n,(2.0 - p.x) + 3.0 * p.y) * bounds;
}
float digit(float num, vec2 p) {
  num = mod(floor(num),10.0);
  if(num == 0.0) return sprite(c_0, 3., 5., p);
  if(num == 1.0) return sprite(c_1, 3., 5., p);
  if(num == 2.0) return sprite(c_2, 3., 5., p);
  if(num == 3.0) return sprite(c_3, 3., 5., p);
  if(num == 4.0) return sprite(c_4, 3., 5., p);
  if(num == 5.0) return sprite(c_5, 3., 5., p);
  if(num == 6.0) return sprite(c_6, 3., 5., p);
  if(num == 7.0) return sprite(c_7, 3., 5., p);
  if(num == 8.0) return sprite(c_8, 3., 5., p);
  if(num == 9.0) return sprite(c_9, 3., 5., p);
  return 0.0;
}
float number (float n, vec2 p) {
  float c = 0.;
  vec2 cpos = vec2(1,1);
  c += digit(n/100000.,floor(p-cpos));
  cpos.x += 4.;
  c += digit(n/10000.,floor(p-cpos));
  cpos.x += 4.;
  c += digit(n/1000.,floor(p-cpos));
  cpos.x += 4.;
  c += digit(n/100.,floor(p-cpos));
  cpos.x += 4.;
  c += digit(n/10.,floor(p-cpos));
  cpos.x += 4.;
  c += digit(n,floor(p-cpos));
  return c;
}


vec4 animal (vec2 p, vec2 pos, vec2 v, float size, float d, float T, float s) {
  // Died displacement
  vec2 disp = d>0.0 ?
    (1.0 + v - mix(vec2(0.0), v, pow(smoothstep(0.0, 0.5, time-T), 0.3))) +
    vec2(rand(gl_FragCoord.xy+time*0.03)-0.5, rand(gl_FragCoord.xy+time*0.1)-0.5) *
    mix(1., 8., pow(smoothstep(1.0, 6.0, time-T), 0.6))
    : vec2(0.0);

  // if (distance(p, pos) < 1.0) return vec4(1.0, 0.0, 0.0, 1.0); // DEBUG

  // The tile to use
  float tile = abs(v.x) < 0.1 ? 0.0 : 1.0 + floor(mod(pos.x / size, 3.0));

  // pos: relative position & scaled to size
  pos = (disp + p - pos) / size;
  // Invert in X according to velocity
  if (v.x > 0.0) pos.x = -pos.x;
  // Slope deform the animal
  float slope = clamp(s, -3., 3.) * smoothstep(0.0, 4.0, pos.x);
  // Translate to the pivot
  pos += vec2(3.5, slope);
  // Scale to the tile width (to match the same pixel world dimension)
  pos /= 8.0;

  // When out of bound, return nothing
  if (pos.x <= 0.0 || pos.y <= 0.0 || pos.x >= 1.0 || pos.y >= 1.0) return vec4(0.0);

  // Compute the position from where to lookup in tiles
  vec2 uv =
    mix(
      vec2(0.0, (1.0+tile) / 4.0), // uv to
      vec2(1.0, tile / 4.0), // uv from
      pos // the position
    );
  vec4 clr = texture2D(tiles, uv);

  return d>0.0 ? vec4(vec3(0.3 + 1.2 * length(clr.rgb), 0.2, 0.1), smoothstep(3.0, 1.5, time-T) * clr.a) : clr;
}

vec2 dispPass (float intensity, float amp, float speed) {
  return intensity * vec2(
    cos(speed*1.1*time+amp*0.9*gl_FragCoord.x+0.5),
    sin(speed*time+amp*gl_FragCoord.y+0.1)
  );
}

vec3 colorFor (int i) {
  if(i==0) return colors[0];
  if(i==1) return colors[1];
  if(i==2) return colors[2];
  if(i==3) return colors[3];
}

vec4 stateColorPass (vec4 c, vec2 pos) {
  if (distance(c.rgb, colors[8]) < 0.01) {
    return c * mix(1.0, rand(pos), 0.2);
  }
  return c;
}


bool logo (vec2 p, vec2 pos, float size) {
  p = (p - pos) / size;

  return 0.0 < p.y && p.y < 1.0 && (
        
    0.8 < p.x && p.x < 1.0 ||

    1.2 < p.x && p.x < 1.4 ||
    1.2 < p.x && p.x < 2.0 && 0.0 < p.y && p.y < 0.2 ||
    1.2 < p.x && p.x < 2.0 && 0.4 < p.y && p.y < 0.6 ||
    1.2 < p.x && p.x < 1.8 && 0.8 < p.y && p.y < 1.0 ||
    1.6 < p.x && p.x < 1.8 && 0.6 < p.y && p.y < 1.0 ||
    1.8 < p.x && p.x < 2.0 && 0.0 < p.y && p.y < 0.4 ||

    2.2 < p.x && p.x < 2.4 ||
    2.2 < p.x && p.x < 3.0 && 0.0 < p.y && p.y < 0.2 ||
    2.2 < p.x && p.x < 2.8 && 0.4 < p.y && p.y < 0.6 ||
    2.2 < p.x && p.x < 3.0 && 0.8 < p.y && p.y < 1.0 ||

    3.2 < p.x && p.x < 3.4 && !(0.4 < p.y && p.y < 0.6) ||
    3.6 < p.x && p.x < 3.8 && !(0.4 < p.y && p.y < 0.6) ||
    3.4 < p.x && p.x < 3.6 && 0.4 < p.y && p.y < 0.6

  );
}

vec4 elementUI (vec3 clr) {
  float radius = 8. * zoom;
  float margin = 10.;
  float s = 2.*radius+margin;
  vec2 size = vec2(8.*radius + 3.*margin, 2.*radius);
  vec2 center = vec2(resolution.x / 2.0, resolution.y / 4.0);
  vec2 origin = center - size / 2.;
  vec2 p = gl_FragCoord.xy - origin;
  if (p.x < 0.0 || p.x > size.x || p.y < 0.0 || p.y > size.y) return vec4(0.0);
  float i = floor(p.x / s);
  center = vec2(s * i, 0.0) + vec2(radius);
  float dist = distance(p, center);
  vec3 c = colorFor(int(i));
  if (dist < radius - zoom) {
    return vec4(c, 0.8);
  }
  if (dist < radius) {
    return vec4(0.2 + 0.3 * c - 0.7 * clr, 1.0);
  }
  return vec4(0.0);
}

vec4 cursor (float dist, vec3 clr) {
  if (dist < 1.0) {
    return vec4(clr, 0.6);
  }
  return vec4(0.0);
}

void main () {
  vec2 disp = vec2(0.0);

  bool lgo = false;
  float s;
  vec2 logoP;
  vec2 grad;
  vec4 clr;

  if (!started || gameover) {
    if (gameover) {
      s = 64.0;
      logoP = vec2((resolution.x - 4.0 * s)/2.0, resolution.y - s * 1.4);
    }
    else {
      s = 140.0;
      logoP = (resolution-vec2(4.4 * s, s))/2.0;
    }
    grad = vec2(3.0*s, 1.6 * s);
    if (logo(gl_FragCoord.xy, logoP, s)) {
      lgo = true;
    }
  }
  if (lgo) {
    disp += dispPass(1.0, 0.1, 2.0);
  }

  if (enableCursor) {
    disp += dispPass(3.0 * pow(smoothstep(zoom * drawRadius, 0.0, distance(gl_FragCoord.xy, mouse)), 0.5), 0.2, 5.0);
  }

  float uiMatchAlpha = 0.0;
  if (started && !gameover) {
    uiMatchAlpha = elementUI(vec3(0.0)).a;
    if (uiMatchAlpha > 0. && uiMatchAlpha <= 0.8) {
      disp += dispPass(0.8, 0.2, 3.0);
    }
  }

  // Compute where the camera/zoom is in the state texture
  vec2 statePos = (gl_FragCoord.xy + disp + camera) / zoom;
  vec2 statePosFloor = floor(statePos);
  vec2 stateBound = worldSize;
  vec2 uv = (statePosFloor + 0.5) / stateBound;
  bool outOfBound = uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0;
  vec4 stateColor = outOfBound ? vec4(statePos.y < 0.0 ? colors[1] : colors[0], 1.0) : stateColorPass(texture2D(state, uv), statePosFloor);

  vec2 pixelPos = fract(statePos);

  vec3 c = stateColor.rgb;

  vec3 noiseColor = vec3(0.02) * vec3(
    rand(zoom*floor(gl_FragCoord.xy/zoom)+time/31.0),
    rand(zoom*floor(gl_FragCoord.xy/zoom)+time/80.1),
    rand(zoom*floor(gl_FragCoord.xy/zoom)+time/13.2)
  );
  vec3 pixelColor = -vec3(0.03) * (pixelPos.x - pixelPos.y);

  if (!outOfBound) {
    vec4 animalsColor = vec4(0.0);
    for (int i=0; i<20; ++i) { if (i >= animalsLength) break;
      vec4 c = animal(
          statePos,
          vec2(
          animals[8*i+0],
          animals[8*i+1]),
          vec2(
          animals[8*i+2],
          animals[8*i+3]),
          animals[8*i+4],
          animals[8*i+5],
          animals[8*i+6],
          animals[8*i+7]);

      if (c.a > 0.0) {
        animalsColor = c;
        break;
      }
    }
    vec3 worldColor = c + noiseColor + pixelColor;
    c = animalsColor.a==0.0 ? worldColor : mix(worldColor, animalsColor.rgb, min(1.0, animalsColor.a));
  }

  c = mix(c, statePos.y < 0.0 ? colors[1] : colors[0], smoothstep(worldSize[0]-100.0, worldSize[0], statePos[0]));

  if (enableCursor) {
    clr = cursor(distance(statePosFloor, floor((mouse + camera)/zoom)) / drawRadius, colorFor(drawObject));
    c = mix(c.rgb, clr.rgb, clr.a);
  }
  
  if (uiMatchAlpha > 0.0) {
    clr = elementUI(c);
    c = mix(c.rgb, clr.rgb, clr.a);
  }

  if (!started || gameover) {
    if (lgo) {
      c = 1.4 * (0.2 + 0.8*c);
      if (!started && distance(resolution / 2.0 /  grad, mouse /  grad) < 0.6) {
        c *= 1.2;
      }
    }
    else if (logo(gl_FragCoord.xy, logoP+vec2(8.0, -8.0), s)) {
      c = vec3(0.0);
    }
    else {
      c = mix(c.rgb, vec3(0.0), (gameover ? 0.5 : 1.0) * (0.2 + 0.4 * smoothstep(0.4, 1.0, distance(resolution / 2.0 /  grad, gl_FragCoord.xy /  grad))));
    }
  }

  vec2 scorePos = gl_FragCoord.xy;

  if (gameover) {
    scorePos -= (resolution - resolution / vec2(6.0, 36.0)) / 2.;
  }

  if (number(score, (scorePos/resolution.xy) * 128. * vec2(1,resolution.y/resolution.x)) > 0.0) {
    c = 0.1 + 0.9 * (1.0-c);
  }
  
  gl_FragColor = vec4(c, 1.0);
}



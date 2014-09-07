#define RAND (S_=vec2(rand(S_), rand(S_+9.))).x

#define _ 9

int A  = 0;
int E  = 1;
int F  = 2;
int W  = 3;
int V  = 4;
int S  = 5;
int Al = 6;
int Ar = 7;
int G  = 8;

/**
  * Game Rule Interactions.
  *
  * Each interaction use various probability. Some are very rare, some frequent.
  /!\ here air means wind /!\ it is different of empty, the empty space is called "Nothing" aka N)
  *
  * Primary elements: Water, Fire, Earth, Air
  * =======
  * Water + Nothing => fall / slide
  * Fire + Nothing => grow
TODO     * Air + Nothing => move (directional wind)
TODO     * Water + Fire => sometimes creates Air (Steam/Wind)
TODO     * Water + Air => Water is deviated (wind)
TODO     * Fire + Air => Fire decrease IF not surrounded by air OTHERWISE is increase (need oxygen)
  * Earth + Water => rarely creates Water Source (water infiltration)
  * Earth + Fire => rarely creates Volcano (fire melt ground into lava)
TODO     * Earth + Air => sometimes Destroy (erosion), rarely creates Fire (spark)
  *
  * Secondary elements: Source, Volcano
  * =========
  * Source + Nothing => creates Water (on bottom).
  * Volcano + Nothing => creates Fire (on top)
TODO     * Volcano + Source => IF source on top of volcano: sometimes creates Ground. OTHERWISE: sometimes creates volcano.
  * Volcano + Water => rarely creates Source.
  * Earth + Volcano => rarely Volcano expand / grow up in the Earth.
  * Earth + Source => rarely Source expand / infiltrate in the Earth.
  * Source + Fire => Source die.
  *
  * Cases where nothing happens:
  * Earth + Nothing
  * Volcano + Fire
  * Volcano + Air
  * Source + Air
  * Source + Water

  */

precision highp float;
uniform vec2 size;
uniform float seed;
uniform float tick;
uniform sampler2D state;
uniform bool running;

uniform bool draw;
uniform ivec2 drawPosition;
uniform float drawRadius;
uniform int drawObject;

uniform vec3 colors[_];

vec4 getColor(ivec2 position) {
  vec2 uv = (gl_FragCoord.xy + vec2(position)) / size;
  if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0)
    return vec4(colors[0], 0.0);
  return texture2D(state, uv);
}
int get (ivec2 pos) {
  vec3 cmp = getColor(pos).rgb;
  for (int i=0; i<_; ++i) {
    vec3 ref = colors[i];
    if (distance(cmp, ref) < 0.01)
      return i;
  }
  return 0;
}
int get (int x, int y) {
  return get(ivec2(x, y));
}


// Match with weights
float match (mat3 pattern, mat3 weights, ivec2 off) {
  float w = 0.0;
  for (int x=-1; x<=1; ++x) {
    for (int y=-1; y<=1; ++y) {
      int v = int(pattern[-y+1][x+1]);
      if (v == _ || v == get(x+off.x, y+off.y)) {
        w += weights[-y+1][x+1];
      }
    }
  }
  return w;
}

float match (mat3 pattern, mat3 weights) {
  return match(pattern, weights, ivec2(0));
}

// Match a pattern and return the nb of matches (ignoring the wildcards)
int match (mat3 pattern) {
  mat3 w = mat3(0.0);
  for (int x=0; x<=2; ++x) {
    for (int y=0; y<=2; ++y) {
      if (int(pattern[y][x]) != _)
        w[y][x] = 1.0;
    }
  }
  return int(match(pattern, w));
}

bool matchAll (mat3 pattern, ivec2 off) {
  mat3 w = mat3(1.0,1.0,1.0, 1.0,1.0,1.0, 1.0,1.0,1.0);
  return match(pattern, w, off) == 9.0;
}

bool matchAll (mat3 pattern) {
  return matchAll(pattern, ivec2(0));
}

bool matchAny (mat3 pattern) {
  return match(pattern) > 1;
}
bool matchOne (mat3 pattern) { // FIXME replace with "matchLeft, matchRight, matchTop, matchBottom" ?
  return matchAny(pattern);
}

bool matchAnyAdjacent (int e) {
  return matchAny(mat3(
    e, e, e,
    e, _, e,
    e, e, e));
}

bool between (float f, float a, float b) {
  return a <= f && f <= b;
}

float rand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float grassDistrib (vec2 p) {
  return mix(
  rand(vec2(p.x)),
  0.5*(1.0+(cos(sin(p.y*0.01 + p.x * 0.05) + (1.0 + 0.3*sin(p.x*0.01)) * p.y * 0.08))),
  0.5
  );
}

void main () {

  float x = gl_FragCoord.x;
  float y = gl_FragCoord.y;
  
  int prev = get(0, 0);
  int down = get(0, -1);

  vec2 S_ = gl_FragCoord.xy + 0.001 * tick;

  bool prevIsSolid = prev==E||prev==G||prev==V||prev==S;

  int r = A;

  //////// FIRE RULES ///////

  if (
   // Fire grow / Fire + Water
   match(mat3(
     W, W, W, // If water drop...
     W, W, W, // ...or water nearby.
     F, F, F  // Fire will move up and expand a bit.
   ), mat3(
     -0.05, -0.3, -0.05, // Negative weights because water kill fire.
     -0.5, -0.6, -0.5,
     0.35, 0.9, 0.35 // Weights for the Fire
   )) >= 0.9 - 0.6 * RAND // The sum of matched weights must be enough important, also with some randomness
  ) {
    r = F;
  }

  // Fire propagation: When fire met grass, fire can stay to continue to consume it
  if (prev == F && RAND < 0.6 && matchAnyAdjacent(G)) {
    r = F;
  }

  ////// WATER RULES ///////

  if (
  // Water drop / Water + Fire
   between(match(mat3(
     W, W, W,
     W, F, W,
     _, F, _
   ), mat3(
     0.3, 0.9, 0.3,
     0.1, -0.3, 0.1,
     0.0, -0.3, 0.0
   )), 0.9 - 0.6 * RAND, 1.4 + 0.3 * RAND)
   ||
   // Water flow rules
   (
    !prevIsSolid && (
      RAND < 0.98 && (
      matchAll(mat3(
        W, _, _,
        _, _, _,
        E, _, _))
      ||
      matchAll(mat3(
        _, _, W,
        _, _, _,
        _, _, E))
      )
      ||
      RAND < 0.93 && (
      matchAll(mat3(
        _, _, _,
        W, _, _,
        E, _, _))
      ||
      matchAll(mat3(
        _, _, _,
        _, _, W,
        _, _, E))
      )))) {
    r = W;
  }

  // Occasional rain
  float rainRelativeTime = mod(tick, 300.0);
  if (!prevIsSolid &&
      y >= size[1]-1.0 &&
      rainRelativeTime < 100.0) {
    float rainLgth = 100.0 * rand(vec2(seed + tick - rainRelativeTime));
    float rainStart = rand(vec2(seed*0.7 + tick - rainRelativeTime)) * (size[0]-rainLgth);
    if (rainStart < x && x < rainStart+rainLgth)
      r = W;
  }

  ////// EARTH RULES ////

  if (prev == E) {

    if (!(get(-1, 0)==A && get(1, 0)==A)) // Hack to workaround with the bug in the terrain seamless
      r = E;

    // Earth -> Source
    if (
    RAND<0.01 &&
    match(mat3(
      W, W, W,
      W, _, W,
      W, W, W
    ), mat3(
     1.0, 1.2, 1.0,
     0.5, 0.0, 0.5,
     0.3, 0.2, 0.3
    ))>3.0 - 2.5*RAND
    ||

    RAND < 0.03 &&
    1<=match(mat3(
      _, S, _,
      S, _, S,
      _, _, _
    ))) {
      r = S;
    }

    // Earth -> Volcano
    if (
    RAND < 0.006 && 
    match(mat3(
      F, F, F,
      F, _, F,
      F, F, F
    ), mat3(
     0.3, 0.2, 0.3,
     0.5, 0.0, 0.5,
     1.0, 1.2, 1.0
    ))>3.0 - 2.1*RAND

    ||

    RAND < 0.01 &&
    2<=match(mat3(
      _, _, _,
      V, _, V,
      V, V, V
    ))) {
      r = V;
    }
  }

  ////// Grass RULES ////
  int grassMaxHeight = int(20.0 * pow(grassDistrib(gl_FragCoord.xy), 1.4));
  if (grassMaxHeight > 0) {
    if (prev == G) {
      r = G;
      if (RAND < 0.95 && (
        matchAny(mat3(
          F, F, F,
          F, _, F,
          F, F, F
        ))
        ||
        matchAny(mat3(
          V, V, V,
          V, _, V,
          V, V, V
        ))
      )) {
        r = F;
      }
    }
    else if (!prevIsSolid && (matchAnyAdjacent(E) || matchAnyAdjacent(G) || matchAnyAdjacent(S))) {
      if (RAND < 0.02 &&
        get(0, -grassMaxHeight) != G && (
        down==G && RAND < 0.07 || // The grass sometimes grow
        down==E && RAND < 0.02 || // The grass rarely spawn by itself
        matchAny(mat3(
          W, W, W,
          W, _, W,
          W, W, W
        ))
        ||
        matchAny(mat3(
          S, S, S,
          S, _, S,
          S, S, S
        ))
      )) {
        r = G;
      }
    }
  }


  ////// VOLCANO RULES /////
  
  // Volcano creates fire
  if ((!prevIsSolid || prev==F) && matchAll(mat3(
      _, _, _,
      _, _, _,
      _, V, _))) {
    r = F;
  }

  if (prev == V) {
    r = V;

    // if Water: Volcano -> Earth
    if (matchAny(mat3(
      W, W, W,
      W, _, W,
      _, _, _
    ))) {
      r = RAND < 0.8 ? S : E;
    }

    // cool down: Volcano -> Earth
    if (RAND<0.005 && !matchAny(mat3(
      _, _, _,
      _, _, _,
      F, F, F
    )) && !matchAny(mat3(
      _, _, _,
      _, _, _,
      V, V, V
    ))) {
      r = E;
    }

    // Volcano <-> Source : A volcano can disappear near source
    if (matchAny(mat3(
      S, S, S,
      S, _, S,
      S, S, S
    ))) {
      if (RAND < 0.3) {
        r = V;
      }
      else if (RAND < 0.6) {
        r = S;
      }
      else {
        r = E;
      }
    }
    
  }

  // Occasional volcano
  float volcRelativeTime = mod(tick, 25.0);
  if (prevIsSolid &&
      y <= 1.0 &&
      RAND < 0.3 &&
      volcRelativeTime <= 1.0) {
    float volcLgth = 10.0 * rand(vec2(seed*0.07 + tick - volcRelativeTime));
    float volcStart = rand(vec2(seed*0.01 + tick - volcRelativeTime)) * (size[0]-volcLgth);
    if (volcStart < x && x < volcStart+volcLgth)
      r = V;
  }

  ////// SOURCE RULES /////

  if ((!prevIsSolid || prev==W) && match(mat3(
      S, S, S,
      S, _, S,
      _, _, _), mat3(
      0.9, 1.0, 0.9,
      0.7, 0.0, 0.7,
      0.0, 0.0, 0.0
    )) >= 1.0 - 0.3*RAND) {
    r = W;
  }

  if (prev == S) {
    r = S;

    // Dry: Source -> Earth
    if (RAND<0.06 && !matchAny(mat3(
      W, W, W,
      _, _, _,
      _, _, _
    )) && !matchAny(mat3(
      S, S, S,
      _, _, _,
      _, _, _
    ))) {
      r = E;
    }

    // if Fire: Source -> Earth
    if (matchAny(mat3(
      _, _, _,
      F, _, F,
      F, F, F
    ))) {
      r = E;
    }

    // Volcano <-> Source : A source can disappear near volcano
    if (matchAny(mat3(
      V, V, V,
      V, _, V,
      V, V, V
    ))) {
      if (RAND < 0.2) {
        r = V;
      }
      else if (RAND < 0.6) {
        r = S;
      }
      else {
        r = E;
      }
    }
  }

  ////// AIR RULES //////
  if (r == A) {
    if (RAND < 0.00001) r = Al;
    if (RAND < 0.00001) r = Ar;
  }

  if (!prevIsSolid && RAND < 0.6 && (
    matchAll(mat3(
      _, _, W,
      _, _, Al,
      _, _, _
    ))
    ||
    matchAll(mat3(
      W, _, _,
      Ar,_, _,
      _, _, _
    ))
  )) {
    r = W;
  }

  int wind = r==Al ? Al : r == Ar ? Ar : 0;
  float maxWind = 0.95;
  float f = match(mat3(
    Ar, _, Al,
    Ar, _, Al,
    Ar, _, Al
    ), mat3(
    -0.1+0.05*(RAND-0.5), 0.0, 0.1,
    -0.65, 0.0, 0.65,
    -0.2, 0.0, 0.2+0.05*(RAND-0.5)
  ));
  if (between(f, 0.4 * RAND, maxWind)) {
    wind = Al;
  }
  else if (between(f, -maxWind, -0.4 * RAND)) {
    wind = Ar;
  }

  if (wind != 0) {
    if (r == A) {
      r = wind;
    }
    else if(r == F) {
      if (RAND < 0.4) r = wind;
    }
    else if (r == W) {
      if (RAND < 0.1) r = wind;
    }
  }

  //// DRAW //////

  if (draw) {
    vec2 pos = floor(gl_FragCoord.xy);
    if (distance(pos, vec2(drawPosition)) <= drawRadius) {
      if (drawObject == W) {
        if (prevIsSolid) {
          r = S;
        }
        else if (!prevIsSolid && mod(pos.x + pos.y, 2.0)==0.0) {
          r = W;
        }
      }
      else if (drawObject == F) {
        if (prevIsSolid) {
          r = V;
        }
        else {
          r = F;
        }
      }
      else {
        r = drawObject;
      }
    }
  }

  ///// SIMPLE ELEMENTS WHEN NOT RUNNING /////
  if (!running) {
    if (r == F || r == W|| r == G) r = A;
    if (r == V || r == S) r = E;
  }

  ///// Return the color result /////

  // r = int(grassDistrib(gl_FragCoord.xy) * 3.0); // for TEST

  vec3 c;
  if (r==0)c=colors[0];
  if (r==1)c=colors[1];
  if (r==2)c=colors[2];
  if (r==3)c=colors[3];
  if (r==4)c=colors[4];
  if (r==5)c=colors[5];
  if (r==6)c=colors[6];
  if (r==7)c=colors[7];
  if (r==8)c=colors[8];
  gl_FragColor=vec4(c,1.0); //: gl_FragColor=vec4(colors[r], 1.0);
}


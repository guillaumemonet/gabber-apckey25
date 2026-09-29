// Rendu WebGL du visualiseur.
// - Modes 3D (shaders sur tout l'écran) : tunnel de néons, paysage synthwave fait de l'historique du spectre, blob
//   (sphère en raymarching), starfield (hyperespace), fractale (éponge de Menger infinie), lasers de salle au-dessus de la foule.
// - Chaîne d'image : le mode (3D, ou un mode 2D recopié depuis son canvas) est dessiné dans une texture, puis une passe
//   de post-traitement applique les filtres empilables (CRT, kaléidoscope, glitch, stroboscope) et la transition entre modes.
// Tous : couleurs au tempo, flash et coup de zoom sur chaque kick.

const BINS = 64;
const ROWS = 64;

const HEAD = `
precision highp float;
uniform vec2 uRes;
uniform float uBeats, uBass, uMid, uHigh, uFlash, uHue, uScroll, uTravel, uTime;
uniform sampler2D uSpec;
uniform sampler2D uHist;
vec3 hsv(float h, float s, float v) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return v - v * s * clamp(min(k, 4.0 - k), 0.0, 1.0);
}
float spec(float x) { return texture2D(uSpec, vec2(clamp(x, 0.0, 1.0), 0.5)).r; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

const SHADERS = {
  tunnel: `
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  p *= 1.0 - uFlash * 0.12;
  float r = length(p);
  float a = atan(p.y, p.x) / 6.28318 + 0.5;
  float depth = 0.45 / (r + 0.03);
  float z = depth + uBeats * 0.5;
  float tw = a + uBeats * 0.03 + sin(z * 0.25) * 0.08;
  float s = spec(abs(fract(tw * 2.0) - 0.5) * 2.0);
  float ring = pow(1.0 - abs(fract(z) * 2.0 - 1.0), 10.0);
  float ray = pow(1.0 - abs(fract(tw * 12.0) * 2.0 - 1.0), 14.0);
  float fog = exp(-depth * 0.09);
  vec3 c1 = hsv(fract(uHue + z * 0.015), 0.85, 1.0);
  vec3 c2 = hsv(fract(uHue + 0.45), 0.7, 1.0);
  vec3 col = c1 * ring * (0.6 + uBass * 1.5) + c2 * ray * (0.25 + s * 2.2);
  col += c2 * s * 0.25 * fog;
  col *= fog * 1.6;
  col += hsv(fract(uHue + 0.5), 0.6, 1.0) * uFlash * 0.25 * smoothstep(1.2, 0.0, r);
  gl_FragColor = vec4(col, 1.0);
}`,
  terrain: `
float H(vec2 xz) {
  float u = abs(xz.x) / 14.0;
  if (u > 1.0) return 0.0;
  float row = (32.0 - xz.y) * 2.0 - uScroll;
  float h = texture2D(uHist, vec2(u, row / ${ROWS}.0)).r;
  return h * h * 4.5 * (0.35 + u * 0.9);
}
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 ro = vec3(0.0, 2.4 + uBass * 0.4, -2.0);
  vec3 rd = normalize(vec3(p.x, p.y - 0.28, 1.5));
  // Ciel : dégradé, étoiles, soleil rayé qui pulse sur les kicks.
  vec3 col = mix(vec3(0.02, 0.0, 0.06), hsv(fract(uHue + 0.85), 0.8, 0.55), smoothstep(0.6, -0.1, p.y));
  vec2 st = floor(gl_FragCoord.xy / 2.0);
  col += step(0.997, hash(st)) * 0.8 * smoothstep(0.0, 0.5, p.y);
  vec2 sp = p - vec2(0.0, 0.32);
  float sr = 0.42 + uFlash * 0.05 + uBass * 0.03;
  float sun = smoothstep(sr, sr - 0.01, length(sp));
  float cut = step(0.0, sp.y) + step(0.5, fract((sp.y + uBeats * 0.02) * 22.0));
  col = mix(col, mix(vec3(1.0, 0.25, 0.55), vec3(1.0, 0.9, 0.3), smoothstep(-0.3, 0.4, sp.y)), sun * min(1.0, cut));
  col += vec3(1.0, 0.3, 0.6) * 0.25 * exp(-length(sp) * 3.0);
  // Sol : marche le long du rayon jusqu'au relief.
  float t = 0.1;
  bool hit = false;
  vec3 pos;
  for (int i = 0; i < 160; i++) {
    pos = ro + rd * t;
    if (pos.z > 32.0 || pos.y < -0.5) break;
    float h = H(pos.xz);
    if (pos.y < h) { hit = true; break; }
    t += max(0.02, (pos.y - h) * 0.22);
  }
  if (hit && pos.z > 0.0) {
    float row = (32.0 - pos.z) * 2.0 - uScroll;
    float gx = abs(fract(pos.x) - 0.5);
    float gz = abs(fract(row) - 0.5);
    float line = max(smoothstep(0.43, 0.5, gx), smoothstep(0.4, 0.5, gz));
    float h = H(pos.xz);
    vec3 neon = hsv(fract(uHue + h * 0.08), 0.8, 1.0);
    vec3 ground = mix(vec3(0.03, 0.0, 0.08), neon * 0.35, clamp(h * 0.4, 0.0, 1.0));
    vec3 g = mix(ground, neon * (1.2 + uFlash), line);
    col = mix(g, col, smoothstep(12.0, 32.0, pos.z));
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  blob: `
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdf(vec3 p) {
  p.xz *= rot(uBeats * 0.25);
  p.xy *= rot(uBeats * 0.11);
  vec3 n = normalize(p);
  float s = spec(acos(clamp(n.y, -1.0, 1.0)) / 3.14159);
  float d = sin(p.x * 4.0 + uBeats) * sin(p.y * 4.0 + uBeats * 0.7) * sin(p.z * 4.0) * (0.12 + uMid * 0.35);
  return length(p) - (1.0 + uBass * 0.35 + uFlash * 0.18) - d - s * 0.35;
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(sdf(p + e.xyy) - sdf(p - e.xyy), sdf(p + e.yxy) - sdf(p - e.yxy), sdf(p + e.yyx) - sdf(p - e.yyx)));
}
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, -3.6), rd = normalize(vec3(p, 1.6));
  vec3 col = hsv(fract(uHue + 0.6), 0.7, 0.12) * (1.0 - length(p) * 0.4);
  col += hsv(fract(uHue + 0.5), 0.8, 1.0) * uFlash * 0.12;
  float t = 0.0;
  for (int i = 0; i < 90; i++) {
    vec3 q = ro + rd * t;
    float d = sdf(q);
    if (d < 0.001) {
      vec3 n = normalAt(q);
      vec3 l = normalize(vec3(0.6, 0.8, -0.5));
      float dif = max(dot(n, l), 0.0);
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      float spc = pow(max(dot(reflect(rd, n), l), 0.0), 24.0);
      vec3 base = hsv(fract(uHue + dot(n, vec3(0.2, 0.3, 0.1))), 0.75, 1.0);
      col = base * (0.15 + dif * 0.7) + hsv(fract(uHue + 0.5), 0.8, 1.0) * fres * (1.2 + uHigh * 2.0) + spc * 0.8;
      break;
    }
    t += d * 0.7;
    if (t > 8.0) { col += hsv(fract(uHue + 0.5), 0.8, 1.0) * 0.02 / (0.02 + abs(length(p) - 0.9 - uBass * 0.3)) * 0.15; break; }
  }
  gl_FragColor = vec4(col, 1.0);
}`,
};

// Starfield : des étoiles qui filent vers toi ; chaque kick donne un coup d'accélérateur (saut dans l'hyperespace).
SHADERS.starfield = `
float layer(vec2 uv, vec2 dir, float streak, float seed) {
  vec2 id = floor(uv), gv = fract(uv) - 0.5;
  float c = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    float n = hash(id + o + seed);
    if (n < 0.55) continue;
    vec2 pos = o + vec2(n, fract(n * 34.7)) - 0.5;
    vec2 dv = gv - pos;
    float along = dot(dv, dir), across = dot(dv, vec2(-dir.y, dir.x));
    float d = length(vec2(along / (1.0 + streak), across));
    c += (0.018 / (d + 0.004)) * smoothstep(0.5, 0.0, d) * (0.4 + fract(n * 91.3));
  }
  return c;
}
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec2 dir = normalize(p + 1e-4);
  float warp = uFlash * 4.0 + uBass * 1.5;
  vec3 col = vec3(0.0);
  for (int l = 0; l < 6; l++) {
    float fl = float(l) / 6.0;
    float depth = fract(fl + uTravel * 0.12);
    float scale = mix(18.0, 0.6, depth);
    float fade = depth * smoothstep(1.0, 0.85, depth);
    float s = layer(p * scale + fl * 453.2, dir, warp * depth * 6.0, fl * 17.0);
    col += s * fade * hsv(fract(uHue + fl * 0.3), 0.45, 1.0);
  }
  col += hsv(fract(uHue + 0.6), 0.8, 0.6) * uFlash * 0.35 * exp(-length(p) * 2.0);   // éclair au centre
  col += vec3(0.02, 0.0, 0.05) * (1.0 - length(p) * 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

// Fractale : on vole dans une éponge de Menger infinie qui se replie et tourne au rythme de la musique.
SHADERS.fractal = `
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float trap;
float de(vec3 p) {
  p = mod(p + 2.0, 4.0) - 2.0;
  float s = 1.0;
  trap = 1e9;
  for (int i = 0; i < 4; i++) {
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    p.xy *= rot(0.12 * sin(uBeats * 0.125) + uMid * 0.15);
    p = p * 3.0 - vec3(2.0, 2.0, 0.0) * (1.0 + uBass * 0.08);
    if (p.z > 1.0) p.z -= 2.0;
    s *= 3.0;
    trap = min(trap, length(p.xy));
  }
  return length(max(abs(p) - vec3(1.0), 0.0)) / s;
}
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, uTravel * 0.6);
  vec3 rd = normalize(vec3(p, 1.3 - uFlash * 0.3));
  rd.xy *= rot(uBeats * 0.06);
  rd.xz *= rot(sin(uBeats * 0.05) * 0.3);
  float t = 0.0, glow = 0.0;
  vec3 col = vec3(0.0);
  bool hit = false;
  for (int i = 0; i < 80; i++) {
    float d = de(ro + rd * t);
    glow += 0.012 / (0.02 + d * d * 40.0);
    if (d < 0.0015 * t) { hit = true; break; }
    t += d;
    if (t > 12.0) break;
  }
  vec3 neon = hsv(fract(uHue + trap * 0.15), 0.8, 1.0);
  if (hit) {
    float fog = exp(-t * 0.28);
    col = neon * (0.25 + 0.75 * fog) * fog;
  }
  col += hsv(fract(uHue + 0.5), 0.7, 1.0) * glow * (0.04 + uHigh * 0.1 + uFlash * 0.12);
  gl_FragColor = vec4(col, 1.0);
}`;

// Lasers : des faisceaux qui balaient la fumée depuis le haut de la salle, au-dessus d'une foule qui saute.
SHADERS.lasers = `
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  float haze = 0.35 + 0.65 * fbm(p * 2.5 + vec2(uBeats * 0.05, -uBeats * 0.03));
  vec3 col = vec3(0.01, 0.0, 0.03) + hsv(fract(uHue + 0.7), 0.8, 0.12) * haze;
  float aspect = uRes.x / uRes.y;
  // 3 projecteurs, 6 faisceaux chacun : ils balaient au tempo et s'ouvrent en éventail sur les kicks.
  for (int e = 0; e < 3; e++) {
    float fe = float(e);
    vec2 src = vec2((fe - 1.0) * aspect * 0.7, 1.08);
    vec3 beamCol = hsv(fract(uHue * 0.3 + 0.33 * fe), 0.85, 1.0);
    for (int b = 0; b < 6; b++) {
      float fb = float(b);
      float spread = 0.22 + uFlash * 0.25 + uBass * 0.1;
      float ang = -1.5708 + (fb - 2.5) * spread + sin(uBeats * 0.785 + fe * 2.1 + fb * 0.5) * 0.45;
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 v = p - src;
      float along = dot(v, dir);
      if (along < 0.0) continue;
      float d = abs(dot(v, vec2(-dir.y, dir.x)));
      float w = 0.004 + along * 0.004;
      float core = exp(-d * d / (w * w));
      float beam = core * (0.6 + haze * 0.8) * exp(-along * 0.35);
      col += beamCol * beam * (0.55 + uHigh * 0.8 + uFlash * 0.6);
    }
    col += beamCol * 0.25 * exp(-length(p - src) * 5.0);
  }
  // Foule : silhouettes qui sautent avec les graves, bras levés.
  float x = p.x * 7.0;
  float heads = -0.78 + 0.07 * noise(vec2(floor(x) * 3.1, 0.0)) + uBass * 0.06 * noise(vec2(floor(x), uBeats));
  float bump = heads + 0.05 * (1.0 - pow(abs(fract(x) - 0.5) * 2.0, 2.0));
  float armOn = step(0.9, noise(vec2(floor(x * 2.0), floor(uBeats))));
  float ax = abs(fract(x * 2.0) - 0.5);
  float arm = armOn * (step(ax, 0.1) * step(p.y, bump + 0.15) + step(length(vec2(ax * 0.14, p.y - bump - 0.16)), 0.022));
  float crowd = max(step(p.y, bump), min(1.0, arm));
  col = mix(col, vec3(0.0), crowd);
  col += hsv(fract(uHue + 0.7), 0.8, 0.5) * 0.08 * smoothstep(-1.0, -0.6, p.y) * (1.0 - crowd);
  gl_FragColor = vec4(col, 1.0);
}`;

export const GL_MODES = Object.keys(SHADERS);

// Recopie une texture (modes 2D) ; post-traitement : filtres (CRT…) et transitions entre modes.
const COPY = `precision highp float; uniform sampler2D uTex; uniform vec2 uRes;
void main() { gl_FragColor = texture2D(uTex, gl_FragCoord.xy / uRes); }`;
const POST = `
precision highp float;
uniform sampler2D uScene, uPrev;
uniform vec2 uRes;
uniform float uTrans, uTType, uTime, uFlash, uCrt, uKal, uGlitch, uStrobe;
float h1(float n) { return fract(sin(n * 91.345) * 43758.5453); }
vec2 barrel(vec2 uv, float k) { vec2 c = uv * 2.0 - 1.0; c *= (1.0 + k * dot(c, c)) / (1.0 + k); return c * 0.5 + 0.5; }
vec3 samp(sampler2D t, vec2 uv, float ab) {
  return vec3(texture2D(t, uv + vec2(ab, 0.0)).r, texture2D(t, uv).g, texture2D(t, uv - vec2(ab, 0.0)).b);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  // Kaléidoscope : l'image repliée en N branches autour du centre.
  if (uKal > 1.5) {
    vec2 q = uv - 0.5;
    q.x *= aspect;
    float a = atan(q.y, q.x), r = length(q);
    float seg = 6.28318 / uKal;
    a = mod(a + uTime * 0.05, seg);
    a = abs(a - seg * 0.5);
    q = vec2(cos(a), sin(a)) * r;
    q.x /= aspect;
    uv = q + 0.5;
  }
  // Glitch : bandes décalées, plus fortes sur les kicks.
  float ab = 0.0;
  if (uGlitch > 0.0) {
    float step = floor(uTime * 12.0);
    float band = floor(uv.y * 24.0);
    float n = h1(band + step * 13.0);
    float amt = uGlitch * (0.2 + uFlash * 1.5);
    if (n < 0.25 * amt + 0.02 * uGlitch) uv.x += (h1(band * 7.0 + step) - 0.5) * 0.15 * amt;
    ab += 0.004 * amt;
  }
  vec2 u = uCrt > 0.0 ? barrel(uv, 0.07 * uCrt) : uv;
  ab += uCrt * (0.0018 + uFlash * 0.002);
  vec3 col = samp(uScene, u, ab);
  if (uTrans < 1.0) {
    float t = uTrans;
    vec3 prev;
    if (uTType < 0.5) prev = samp(uPrev, u, ab);                                             // fondu
    else if (uTType < 1.5) prev = samp(uPrev, (u - 0.5) * (1.0 - t * 0.6) + 0.5, ab + t * 0.01); // zoom
    else {                                                                                   // bandes
      float b = h1(floor(u.y * 18.0) * 3.7);
      prev = samp(uPrev, u + vec2((b - 0.5) * t * 0.3, 0.0), ab);
      t = step(b, t);
    }
    col = mix(prev, col, uTType < 1.5 ? smoothstep(0.0, 1.0, t) : t);
  }
  if (uCrt > 0.0) {
    float scan = 0.8 + 0.2 * sin(gl_FragCoord.y * 3.14159 * 0.5);
    float mask = 0.94 + 0.06 * sin(gl_FragCoord.x * 3.14159 * 0.66);
    col *= mix(1.0, scan * mask * 1.2, uCrt);   // un peu plus lumineux : les lignes assombrissent
    vec2 c = u * 2.0 - 1.0;
    col *= 1.0 - dot(c, c) * 0.14 * uCrt;
    col += (h1(gl_FragCoord.x * 0.37 + gl_FragCoord.y * 1.13 + uTime) - 0.5) * 0.04 * uCrt;
    if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) col = vec3(0.0);
  }
  col = mix(col, vec3(1.0), uStrobe);
  gl_FragColor = vec4(col, 1.0);
}`;

export class VizGL {
  static supported() {
    try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
  }

  constructor() {
    this.cv = document.createElement('canvas');
    const gl = this.gl = this.cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL');
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.progs = {};
    this.spec = new Uint8Array(BINS);
    this.hist = new Uint8Array(BINS * ROWS);
    this.lastRow = null;
    this.specTex = this.texture();
    this.histTex = this.texture();
    this.srcTex = this.texture();
    this.a = null;   // image du mode en cours (texture + framebuffer), à la taille de sortie
    this.b = null;   // dernière image du mode précédent (transitions)
    this.lo = null;  // image d'un mode 3D, calculée plus petite puis agrandie
    this.trans = null;
  }

  texture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  target(w, h) {
    const gl = this.gl;
    const tex = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  program(key, src) {
    if (this.progs[key]) return this.progs[key];
    const gl = this.gl;
    const sh = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${key}: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 pos; void main() { gl_Position = vec4(pos, 0.0, 1.0); }'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, src));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${key}: ${gl.getProgramInfoLog(p)}`);
    const cache = {};
    this.progs[key] = { p, loc: gl.getAttribLocation(p, 'pos'), u: n => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n))) };
    return this.progs[key];
  }

  use(pr) {
    const gl = this.gl;
    gl.useProgram(pr.p);
    gl.enableVertexAttribArray(pr.loc);
    gl.vertexAttribPointer(pr.loc, 2, gl.FLOAT, false, 0, 0);
  }

  drop(t) { if (t) { this.gl.deleteTexture(t.tex); this.gl.deleteFramebuffer(t.fb); } }

  // Taille de sortie.
  resize(w, h) {
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    if (!this.a || this.a.w !== w || this.a.h !== h) {
      this.drop(this.a);
      this.drop(this.b);
      this.a = this.target(w, h);
      this.b = this.target(w, h);
    }
  }

  // Recopie (et agrandit) une texture dans l'image du mode.
  copy(tex) {
    const gl = this.gl;
    const pr = this.program('copy', COPY);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.a.fb);
    gl.viewport(0, 0, this.a.w, this.a.h);
    this.use(pr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform2f(pr.u('uRes'), this.a.w, this.a.h);
    gl.uniform1i(pr.u('uTex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Changement de mode : l'image actuelle devient « la précédente », mêlée à la nouvelle pendant la transition.
  beginTransition() {
    [this.a, this.b] = [this.b, this.a];
    this.trans = { start: performance.now(), type: Math.floor(Math.random() * 3) };
  }

  // Spectre en 64 bandes logarithmiques, et son historique (une ligne tous les 1/8 de temps).
  analyse(freq, hz, beats) {
    for (let i = 0; i < BINS; i++) {
      const f0 = 30 * Math.pow(16000 / 30, i / BINS), f1 = 30 * Math.pow(16000 / 30, (i + 1) / BINS);
      let m = 0;
      for (let k = Math.floor(f0 / hz); k <= Math.ceil(f1 / hz) && k < freq.length; k++) m = Math.max(m, freq[k]);
      this.spec[i] = m;
    }
    const row = Math.floor(beats * 8);
    if (row !== this.lastRow) {
      const steps = this.lastRow === null ? 1 : Math.min(ROWS, Math.max(1, row - this.lastRow));
      this.hist.copyWithin(BINS * steps, 0, BINS * (ROWS - steps));
      for (let r = 0; r < steps; r++) this.hist.set(this.spec, r * BINS);
      this.lastRow = row;
    }
    this.scroll = beats * 8 - row;
  }

  // Dessine un mode 3D dans l'image du mode, calculé à `scale` de la taille de sortie.
  scene(mode, v, scale = 1) {
    const gl = this.gl;
    const sw = Math.max(1, Math.round(this.a.w * scale)), sh = Math.max(1, Math.round(this.a.h * scale));
    if (!this.lo || this.lo.w !== sw || this.lo.h !== sh) { this.drop(this.lo); this.lo = this.target(sw, sh); }
    const pr = this.program(mode, HEAD + SHADERS[mode]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lo.fb);
    gl.viewport(0, 0, sw, sh);
    this.use(pr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, BINS, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.spec);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.histTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, BINS, ROWS, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.hist);
    gl.uniform2f(pr.u('uRes'), sw, sh);
    for (const [n, val] of [['uBeats', v.beats], ['uBass', v.bass], ['uMid', v.mid], ['uHigh', v.high], ['uFlash', v.flash],
      ['uHue', (((v.hue % 360) + 360) % 360) / 360], ['uScroll', this.scroll ?? 0], ['uTravel', v.travel], ['uTime', v.time]]) gl.uniform1f(pr.u(n), val);
    gl.uniform1i(pr.u('uSpec'), 0);
    gl.uniform1i(pr.u('uHist'), 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.copy(this.lo.tex);
  }

  // Un mode 2D (canvas) devient l'image du mode.
  upload(canvas) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.copy(this.srcTex);
  }

  // Image finale : filtres et transition. fx : { crt, kaleido, glitch, strobe } (0..1, kaleido = nombre de branches).
  post(v, fx) {
    const gl = this.gl;
    const pr = this.program('post', POST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    this.use(pr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.a.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.b.tex);
    gl.uniform1i(pr.u('uScene'), 0);
    gl.uniform1i(pr.u('uPrev'), 1);
    gl.uniform2f(pr.u('uRes'), this.cv.width, this.cv.height);
    let tr = 1;
    if (this.trans) { tr = (performance.now() - this.trans.start) / 800; if (tr >= 1) { this.trans = null; tr = 1; } }
    for (const [n, val] of [['uTrans', tr], ['uTType', this.trans?.type ?? 0], ['uTime', v.time], ['uFlash', v.flash],
      ['uCrt', fx.crt ?? 0], ['uKal', fx.kaleido ?? 0], ['uGlitch', fx.glitch ?? 0], ['uStrobe', fx.strobe ?? 0]]) gl.uniform1f(pr.u(n), val);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

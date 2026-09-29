// Modes 3D du visualiseur, en WebGL (shaders dessinés sur tout le canvas) :
// - tunnel : un tunnel de néons qui avance au tempo, ses parois suivent le spectre ;
// - terrain : on survole un paysage fait du spectre des 2 dernières mesures (graves au milieu), sous un soleil synthwave ;
// - blob : une sphère lancée en raymarching, déformée par les graves, les médiums et le spectre, éclairée en néon.
// Tous : couleurs au tempo, flash et coup de zoom sur chaque kick.

export const GL_MODES = ['tunnel', 'terrain', 'blob'];
const BINS = 64;
const ROWS = 64;

const HEAD = `
precision highp float;
uniform vec2 uRes;
uniform float uBeats, uBass, uMid, uHigh, uFlash, uHue, uScroll;
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

export class Viz3D {
  static supported() {
    try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
  }

  constructor(canvas) {
    this.cv = canvas;
    const gl = this.gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL');
    this.progs = {};
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.spec = new Uint8Array(BINS);
    this.hist = new Uint8Array(BINS * ROWS);
    this.lastRow = null;
    this.specTex = this.texture();
    this.histTex = this.texture();
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

  program(mode) {
    if (this.progs[mode]) return this.progs[mode];
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 pos; void main() { gl_Position = vec4(pos, 0.0, 1.0); }'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, HEAD + SHADERS[mode]));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = name => gl.getUniformLocation(p, name);
    this.progs[mode] = { p, loc: gl.getAttribLocation(p, 'pos'), u: Object.fromEntries(['uRes', 'uBeats', 'uBass', 'uMid', 'uHigh', 'uFlash', 'uHue', 'uScroll', 'uSpec', 'uHist'].map(n => [n, u(n)])) };
    return this.progs[mode];
  }

  // freq : spectre de l'analyseur (octets) ; hz : largeur d'une case ; v : { beats, bass, mid, high, flash, hue (degrés) }.
  render(mode, freq, hz, v, scale = 1) {
    const gl = this.gl;
    const cv = this.cv;
    const w = Math.max(1, Math.round(cv.clientWidth * scale)), h = Math.max(1, Math.round(cv.clientHeight * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    // Spectre en 64 bandes logarithmiques, et son historique (une ligne tous les 1/8 de temps).
    for (let i = 0; i < BINS; i++) {
      const f0 = 30 * Math.pow(16000 / 30, i / BINS), f1 = 30 * Math.pow(16000 / 30, (i + 1) / BINS);
      let m = 0;
      for (let k = Math.floor(f0 / hz); k <= Math.ceil(f1 / hz) && k < freq.length; k++) m = Math.max(m, freq[k]);
      this.spec[i] = m;
    }
    const row = Math.floor(v.beats * 8);
    if (row !== this.lastRow) {
      const steps = this.lastRow === null ? 1 : Math.min(ROWS, Math.max(1, row - this.lastRow));
      this.hist.copyWithin(BINS * steps, 0, BINS * (ROWS - steps));
      for (let r = 0; r < steps; r++) this.hist.set(this.spec, r * BINS);
      this.lastRow = row;
    }
    gl.viewport(0, 0, w, h);
    const pr = this.program(mode);
    gl.useProgram(pr.p);
    gl.enableVertexAttribArray(pr.loc);
    gl.vertexAttribPointer(pr.loc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, BINS, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.spec);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.histTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, BINS, ROWS, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.hist);
    const U = pr.u;
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uBeats, v.beats);
    gl.uniform1f(U.uBass, v.bass);
    gl.uniform1f(U.uMid, v.mid);
    gl.uniform1f(U.uHigh, v.high);
    gl.uniform1f(U.uFlash, v.flash);
    gl.uniform1f(U.uHue, ((v.hue % 360) + 360) % 360 / 360);
    gl.uniform1f(U.uScroll, v.beats * 8 - row);
    gl.uniform1i(U.uSpec, 0);
    gl.uniform1i(U.uHist, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

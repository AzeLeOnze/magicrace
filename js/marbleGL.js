/* MagicRace — rendu des billes par shaders WebGL.
 * Chaque apparence a son propre programme (compilé à la demande). Les billes sont dessinées dans
 * les cases d'un atlas WebGL, puis recopiées sur les canvas 2D (piste, panneau, cartes). */
(function (MR) {
  'use strict';

  const ATLAS_W = 2048, ATLAS_H = 1536;
  const MAIN_H = 1024;     // zone 0 : billes en course ; zone 1 (1024..1536) : aperçus et cartes

  const VS = 'attribute vec2 a; varying vec2 v_uv; void main(){ v_uv = a; gl_Position = vec4(a, 0.0, 1.0); }';

  const PRELUDE = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform float u_angle;
uniform float u_seed;
uniform float u_px;
uniform vec3 u_col;
const float PI = 3.14159265;
const float TAU = 6.2831853;

float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float noise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * noise(p); p = p * 2.02 + vec3(1.7, 9.2, 3.4); a *= 0.5; } return s; }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * noise(p); p = p * 2.03 + vec3(4.1, 1.3, 7.7); a *= 0.5; } return s; }
vec3 voronoi(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + hash33(i + g) - f;
    float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; id = hash13(i + g + 17.0); } else if (d < d2){ d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
vec3 rotZ(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b * cos(TAU * (c * t + d)); }
float glassArc(vec2 p){
  float ring = smoothstep(0.075, 0.0, abs(length(p - vec2(0.06, -0.06)) - 0.74));
  float side = smoothstep(0.15, 0.75, dot(normalize(p + 1e-4), normalize(vec2(-0.62, 0.78))));
  return ring * side;
}
`;

  const MAIN = `
void main(){
  vec2 p = v_uv;
  float r = length(p);
  float edge = 1.0 - smoothstep(1.0 - u_px * 1.6, 1.0, r);
  if (edge <= 0.0){ gl_FragColor = vec4(0.0); return; }
  vec2 pp = r > 0.9995 ? p * (0.9995 / r) : p;
  vec3 n = vec3(pp, sqrt(max(0.0, 1.0 - dot(pp, pp))));
  vec3 s = rotZ(n, u_angle);
  vec3 L = normalize(vec3(-0.45, 0.62, 0.72));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float ndh = max(dot(n, H), 0.0);
  float diff = max(dot(n, L), 0.0);
  float spec = pow(ndh, 70.0);
  float specW = pow(ndh, 14.0);
  float fres = pow(1.0 - n.z, 2.5);
  vec3 col = skin(n, s, p, r, diff, spec, specW, fres, H);
  col *= 1.0 - smoothstep(0.9, 1.0, r) * 0.35;
  gl_FragColor = vec4(col * edge, edge);
}
`;

  const SIG = 'vec3 skin(vec3 n, vec3 s, vec2 p, float r, float diff, float spec, float specW, float fres, vec3 H)';

  const SKINS = {};

  /* 0 — verre coloré avec ruban œil-de-chat (couleur choisie) */
  SKINS.solid = SIG + `{
  vec3 base = u_col;
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  float trans = pow(clamp(dot(n.xy, vec2(0.42, -0.62)) * 0.75 + 0.3, 0.0, 1.0), 1.6);
  vec3 col = base * (0.26 + 0.62 * diff) + base * trans * 0.8;
  col = mix(col, base * 0.12, smoothstep(0.6, 1.0, r) * 0.55);
  vec3 q = s * 0.92;
  float tw = q.z * 2.6 + u_seed * TAU;
  float vane = abs(cos(tw) * q.x - sin(tw) * q.y) + 0.06 * (noise(q * 6.0 + u_seed * 20.0) - 0.5);
  float rib = smoothstep(0.15, 0.04, vane) * (1.0 - smoothstep(0.55, 0.95, r));
  vec3 ribCol = mix(mix(vec3(1.0), base, 0.22), base * 0.28 + vec3(0.06, 0.03, 0.1), step(0.62, lum));
  col = mix(col, ribCol * (0.5 + 0.7 * diff), rib * 0.92);
  vec3 bp = s * 9.0 + u_seed * 5.0; vec3 bc = floor(bp);
  float bub = step(0.88, hash13(bc)) * smoothstep(0.09, 0.03, length(fract(bp) - 0.5 - (hash33(bc) - 0.5) * 0.5));
  col += vec3(0.9) * bub * 0.35 * (1.0 - r);
  col += vec3(1.0) * (spec * 1.15 + specW * 0.1) + vec3(1.0) * glassArc(p) * 0.35;
  col += (base * 0.6 + 0.35) * fres * 0.55;
  return col;
}`;

  /* ---------- PEU COMMUNES : designs simples ---------- */
  SKINS.creme = SIG + `{
  float a = atan(s.y, s.x);
  float sw = sin(a * 3.0 + s.z * 4.0 + length(s.xy) * 6.0 + u_seed * 6.0);
  vec3 cream = vec3(1.0, 0.95, 0.87), berry = vec3(1.0, 0.68, 0.78);
  vec3 col = mix(cream, berry, smoothstep(-0.15, 0.7, sw));
  col = mix(col, vec3(1.0, 0.98, 0.95), smoothstep(0.75, 1.0, sin(a * 3.0 + s.z * 4.0 + 1.3)) * 0.5);
  col *= 0.62 + 0.45 * diff;
  col += vec3(1.0) * (specW * 0.22 + spec * 0.35) + vec3(1.0, 0.9, 0.95) * fres * 0.35;
  return col;
}`;

  SKINS.gourmand = SIG + `{
  vec3 col = vec3(0.23, 0.11, 0.055) * (0.5 + 0.75 * diff);
  float dz = abs(sin((s.y + 0.22 * sin(s.x * 5.0 + u_seed * 9.0)) * 8.0));
  col = mix(col, vec3(0.9, 0.55, 0.18) * (0.55 + 0.6 * diff), smoothstep(0.22, 0.1, dz));
  vec3 cp = s * 7.0 + u_seed * 3.0; vec3 cc = floor(cp); float h = hash13(cc);
  vec3 fr = fract(cp) - 0.5 - (hash33(cc) - 0.5) * 0.4;
  float spk = step(0.6, h) * smoothstep(0.13, 0.08, length(fr * vec3(1.0, 2.6, 1.0)));
  vec3 spc = pal(h * 3.0, vec3(0.78), vec3(0.3), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col = mix(col, spc * (0.6 + 0.5 * diff), spk);
  col += vec3(1.0, 0.9, 0.8) * spec * 0.8 + vec3(0.6, 0.35, 0.2) * fres * 0.4;
  return col;
}`;

  SKINS.spatial = SIG + `{
  float band = s.y * 6.0 + 0.45 * sin(s.x * 3.0 + u_seed * 5.0) + 0.25 * noise(s * 4.0 + u_seed);
  float b = fract(band * 0.5);
  vec3 col = mix(vec3(0.12, 0.2, 0.6), vec3(0.32, 0.72, 0.98), smoothstep(0.15, 0.5, b));
  col = mix(col, vec3(0.92, 0.96, 1.0), smoothstep(0.72, 0.9, b) * 0.6);
  float spot = smoothstep(0.2, 0.12, length((s.xy - vec2(0.35, -0.2)) * vec2(1.0, 1.8)));
  col = mix(col, vec3(1.0, 0.55, 0.35), spot * 0.85);
  col *= 0.2 + 0.95 * diff;
  col += vec3(0.4, 0.7, 1.0) * fres * 0.7 + vec3(1.0) * spec * 0.4;
  return col;
}`;

  SKINS.vanille = SIG + `{
  float m = fbm3(s * 3.0 + u_seed * 4.0);
  vec3 col = mix(vec3(1.0, 0.9, 0.62), vec3(1.0, 0.97, 0.84), m) * (0.6 + 0.45 * diff);
  vec3 cp = s * 13.0 + u_seed * 7.0; vec3 cc = floor(cp);
  float sp = step(0.45, hash13(cc)) * smoothstep(0.13, 0.07, length(fract(cp) - 0.5 - (hash33(cc) - 0.5) * 0.6));
  col = mix(col, vec3(0.13, 0.08, 0.05), sp * 0.95);
  col += vec3(1.0) * (spec * 0.3 + specW * 0.12) + vec3(1.0, 0.95, 0.8) * fres * 0.3;
  return col;
}`;

  SKINS.black = SIG + `{
  vec3 col = vec3(0.012, 0.012, 0.018) + vec3(0.035) * diff;
  col += vec3(1.0) * spec * 1.7 + vec3(0.9) * specW * 0.07 + vec3(1.0) * glassArc(p) * 0.5;
  vec3 irid = pal(fres * 1.5 + u_time * 0.03 + s.x * 0.3, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col += irid * fres * 0.38;
  return col;
}`;

  /* ---------- RARES ---------- */
  SKINS.chrome = SIG + `{
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 sky = mix(vec3(0.5, 0.55, 0.72), vec3(0.96, 0.97, 1.0), smoothstep(0.0, 0.8, R.y));
  vec3 ground = mix(vec3(0.06, 0.04, 0.09), vec3(0.24, 0.19, 0.3), smoothstep(-1.0, 0.0, R.y));
  vec3 env = mix(ground, sky, smoothstep(-0.03, 0.03, R.y));
  env += vec3(1.0) * smoothstep(0.9, 0.97, dot(R, normalize(vec3(-0.5, 0.6, 0.6)))) * 1.5;
  env += vec3(1.0, 0.35, 0.75) * smoothstep(0.86, 0.95, dot(R, normalize(vec3(0.85, 0.1, 0.4)))) * 0.9;
  env += vec3(0.3, 0.9, 1.0) * smoothstep(0.86, 0.95, dot(R, normalize(vec3(-0.85, -0.25, 0.4)))) * 0.9;
  vec3 col = env * (0.92 + 0.08 * noise(vec3(atan(s.y, s.x) * 24.0, length(s.xy) * 3.0, u_seed * 9.0)));
  return col + vec3(1.0) * spec * 0.6;
}`;

  SKINS.damier = SIG + `{
  float lat = asin(clamp(s.y, -1.0, 1.0)); float lon = atan(s.z, s.x);
  float k = smoothstep(-0.09, 0.09, sin(lat * 8.0) * sin(lon * 8.0));
  vec3 col = mix(vec3(0.04, 0.04, 0.05), vec3(0.96), k) * (0.4 + 0.65 * diff);
  col += vec3(1.0) * (spec * 1.2 + specW * 0.08) + vec3(1.0) * glassArc(p) * 0.3 + vec3(0.7, 0.75, 0.9) * fres * 0.35;
  return col;
}`;

  SKINS.sucre = SIG + `{
  vec2 q = s.xy; float a = atan(q.y, q.x); float rr = length(q);
  float sw = sin(a * 4.0 + rr * 7.0);
  vec3 col = mix(vec3(1.0, 0.98, 0.97), vec3(0.92, 0.07, 0.2), smoothstep(-0.12, 0.12, sw));
  col = mix(col, vec3(0.2, 0.75, 0.45), smoothstep(0.9, 0.98, sin(a * 4.0 + rr * 7.0 + 1.6)) * 0.8);
  col *= 0.55 + 0.5 * diff;
  col += vec3(1.0) * (spec * 1.3 + specW * 0.15) + vec3(1.0) * glassArc(p) * 0.4 + vec3(1.0, 0.5, 0.6) * fres * 0.4;
  return col;
}`;

  SKINS.glace = SIG + `{
  vec3 v = voronoi(s * 2.2 + u_seed * 5.0);
  float crack = smoothstep(0.06, 0.0, v.y - v.x);
  vec3 col = mix(vec3(0.5, 0.78, 0.95), vec3(0.85, 0.95, 1.0), r) * (0.42 + 0.5 * diff);
  col += vec3(0.9, 0.97, 1.0) * crack * 0.6 * (1.0 - r * 0.5);
  vec3 bp = s * 7.0 + u_seed * 3.0; vec3 bc = floor(bp);
  col += vec3(1.0) * step(0.82, hash13(bc)) * smoothstep(0.08, 0.03, length(fract(bp) - 0.5)) * 0.4;
  col = mix(col, vec3(0.96, 0.98, 1.0), smoothstep(0.72, 1.0, r) * fbm3(s * 8.0) * 0.9);
  col += vec3(1.0) * spec * 1.4 + vec3(1.0) * glassArc(p) * 0.5 + vec3(0.6, 0.85, 1.0) * fres * 0.6;
  return col;
}`;

  SKINS.vinyle = SIG + `{
  vec2 q = s.xy; float rr = length(q); float a = atan(q.y, q.x);
  float groove = 0.5 + 0.5 * sin(rr * 130.0);
  vec3 col = vec3(0.025) + vec3(0.05) * groove;
  float sheen = pow(abs(sin(a - 2.3)), 10.0) * smoothstep(0.32, 0.42, rr);
  col += vec3(0.38, 0.35, 0.45) * sheen * (0.5 + 0.5 * groove);
  float lab = smoothstep(0.315, 0.3, rr);
  vec3 lc = vec3(1.0, 0.25, 0.62);
  lc = mix(lc, vec3(1.0, 0.82, 0.3), smoothstep(0.195, 0.205, rr) - smoothstep(0.235, 0.245, rr));
  lc = mix(lc, vec3(1.0, 0.82, 0.3), step(0.5, fract(a / TAU * 6.0)) * smoothstep(0.1, 0.11, rr) * smoothstep(0.17, 0.16, rr) * 0.6);
  lc = mix(lc, vec3(0.02), smoothstep(0.045, 0.035, rr));
  col = mix(col, lc * (0.6 + 0.5 * diff), lab);
  col += vec3(1.0) * spec * 0.9 + vec3(0.5) * fres * 0.15;
  return col;
}`;

  /* ---------- ÉPIQUES ---------- */
  SKINS.lavalamp = SIG + `{
  float f = 0.0;
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float h = hash13(vec3(fi, u_seed * 7.0, 1.0));
    float t = u_time * (0.11 + 0.08 * h) + h * 10.0;
    float y = mod(t, 3.2) - 1.6;
    float x = sin(t * 1.7 + fi * 2.0) * 0.45;
    vec2 d = p - vec2(x, y);
    float rad = 0.17 + 0.12 * h;
    f += rad * rad / max(dot(d, d), 1e-4);
  }
  vec3 liquid = mix(vec3(0.22, 0.03, 0.32), vec3(0.62, 0.1, 0.45), p.y * 0.5 + 0.5);
  float blob = smoothstep(0.9, 1.15, f);
  vec3 wax = mix(vec3(1.0, 0.33, 0.12), vec3(1.0, 0.78, 0.3), smoothstep(1.1, 3.0, f));
  vec3 col = mix(liquid, wax, blob);
  col += vec3(1.0, 0.4, 0.2) * smoothstep(0.45, 0.9, f) * (1.0 - blob) * 0.4;
  col += vec3(1.0, 0.5, 0.2) * smoothstep(-0.4, -1.0, p.y) * 0.45;
  col *= 0.75 + 0.35 * diff;
  col += vec3(1.0) * spec * 1.2 + vec3(1.0) * glassArc(p) * 0.4 + vec3(0.8, 0.4, 1.0) * fres * 0.5;
  return col;
}`;

  SKINS.aurore = SIG + `{
  vec3 col = mix(vec3(0.01, 0.02, 0.06), vec3(0.03, 0.07, 0.17), p.y * 0.5 + 0.5);
  vec2 sc = floor(p * 14.0 + u_seed * 9.0);
  float sh = hash13(vec3(sc, 3.0));
  col += vec3(1.0) * step(0.93, sh) * smoothstep(0.18, 0.0, length(fract(p * 14.0 + u_seed * 9.0) - 0.5)) * (0.5 + 0.5 * sin(u_time * 3.0 + sh * 50.0));
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float x = p.x * (1.5 + fi * 0.3) + u_seed * 4.0;
    float base = 0.22 * sin(x * 1.3 + u_time * 0.35 + fi * 2.1) + 0.12 * sin(x * 3.1 - u_time * 0.5) - 0.12 + fi * 0.17;
    float d = p.y - base;
    float streak = noise(vec3(x * 6.0, u_time * 0.4 + fi, fi * 3.0));
    float curtain = smoothstep(-0.02, 0.05, d) * exp(-max(d, 0.0) * (2.6 + fi)) * (0.35 + 0.9 * streak);
    vec3 c = mix(vec3(0.1, 1.0, 0.55), vec3(0.65, 0.3, 1.0), clamp(d * 1.6 + fi * 0.25, 0.0, 1.0));
    col += c * curtain * 0.85;
  }
  float hill = -0.55 + 0.08 * sin(p.x * 5.0 + u_seed * 6.0) + 0.05 * sin(p.x * 11.0);
  float snow = smoothstep(hill + 0.01, hill - 0.01, p.y);
  col = mix(col, vec3(0.7, 0.8, 0.95) * (0.35 + 0.55 * diff) + vec3(0.1, 0.35, 0.25) * 0.25, snow);
  col += vec3(1.0) * spec + vec3(1.0) * glassArc(p) * 0.35 + vec3(0.3, 0.8, 0.7) * fres * 0.45;
  return col;
}`;

  SKINS.diamant = SIG + `{
  vec3 v = voronoi(vec3(s.xy * 3.0, u_seed * 3.0));
  float id = v.z;
  vec3 fn = normalize(n + (hash33(vec3(id * 17.0, 1.0, 2.0)) - 0.5) * 0.9);
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), fn);
  float ang = dot(R, normalize(vec3(sin(u_time * 0.7), 0.5, cos(u_time * 0.7))));
  vec3 disp = pal(ang * 1.5 + id * 2.0 + u_time * 0.1, vec3(0.6), vec3(0.4), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 col = vec3(0.72, 0.84, 1.0) * (0.28 + 0.45 * fn.z) + disp * 0.45;
  col += vec3(1.0) * smoothstep(0.045, 0.0, v.y - v.x) * 0.4;
  col += vec3(1.0) * (pow(max(ang, 0.0), 40.0) * 3.0 + pow(max(sin(u_time * 5.0 + id * 40.0), 0.0), 30.0) * step(0.7, id) * 2.0);
  col += vec3(1.0) * spec * 1.5 + vec3(0.7, 0.85, 1.0) * fres * 0.6;
  return col;
}`;

  SKINS.hypnose = SIG + `{
  vec2 q = s.xy; float a = atan(q.y, q.x); float rr = length(q);
  float sp = sin(a * 2.0 + log(rr + 0.05) * 9.0 - u_time * 4.0);
  float rings = sin(rr * 30.0 - u_time * 6.0);
  vec3 c1 = pal(u_time * 0.08 + rr * 0.5, vec3(0.6, 0.3, 0.6), vec3(0.4, 0.3, 0.4), vec3(1.0), vec3(0.0, 0.15, 0.3));
  vec3 col = mix(vec3(0.02, 0.0, 0.05), c1, smoothstep(-0.12, 0.12, sp));
  col = mix(col, vec3(0.2, 0.95, 1.0), smoothstep(0.85, 1.0, rings) * 0.45);
  col *= 0.65 + 0.45 * diff;
  col += vec3(1.0) * exp(-rr * rr * 60.0) * 0.8;
  col += vec3(1.0) * spec + vec3(1.0) * glassArc(p) * 0.3 + vec3(1.0, 0.4, 0.8) * fres * 0.45;
  return col;
}`;

  SKINS.abysses = SIG + `{
  vec3 col = mix(vec3(0.0, 0.025, 0.07), vec3(0.0, 0.26, 0.42), smoothstep(-1.0, 1.0, p.y));
  vec3 v1 = voronoi(vec3(p * 3.0, u_time * 0.4 + u_seed * 5.0));
  float cau = smoothstep(0.25, 0.0, v1.y - v1.x);
  col += vec3(0.3, 0.9, 1.0) * cau * cau * smoothstep(-0.6, 0.9, p.y) * 0.4;
  float shaft = pow(0.5 + 0.5 * sin(p.x * 7.0 + sin(p.x * 3.0 + u_time * 0.3) * 2.0), 6.0) * smoothstep(-0.8, 1.0, p.y);
  col += vec3(0.2, 0.6, 0.7) * shaft * 0.35;
  vec3 bp = s * 8.0 + u_seed * 11.0; vec3 bc = floor(bp); float h = hash13(bc);
  float dot1 = step(0.8, h) * smoothstep(0.12, 0.0, length(fract(bp) - 0.5 - (hash33(bc) - 0.5) * 0.6));
  col += mix(vec3(0.2, 1.0, 0.8), vec3(0.4, 0.6, 1.0), h) * dot1 * (0.6 + 0.4 * sin(u_time * 2.5 + h * 30.0)) * 1.4;
  col *= 0.75 + 0.3 * diff;
  col += vec3(1.0) * spec + vec3(1.0) * glassArc(p) * 0.35 + vec3(0.2, 0.7, 0.9) * fres * 0.55;
  return col;
}`;

  /* ---------- LÉGENDAIRES ---------- */
  SKINS.nebula = SIG + `{
  float tt = u_time * 0.07;
  vec3 q = s * 1.35 + vec3(u_seed * 13.0, u_seed * 7.0, tt);
  vec3 w = vec3(fbm3(q + vec3(0.0, 0.0, tt)), fbm3(q + vec3(5.2, 1.3, -tt)), fbm3(q + vec3(9.1, 4.7, 2.3)));
  float f = fbm(q * 1.4 + 2.4 * w);
  vec3 col = vec3(0.015, 0.008, 0.05);
  col = mix(col, vec3(0.32, 0.05, 0.62), smoothstep(0.32, 0.7, f));
  col = mix(col, vec3(1.0, 0.28, 0.65), smoothstep(0.55, 0.85, f * (0.6 + w.x)) * 0.9);
  col = mix(col, vec3(0.1, 0.85, 1.0), smoothstep(0.62, 0.95, w.y * (0.7 + f * 0.6)) * 0.75);
  col *= 0.45 + 0.95 * smoothstep(0.25, 0.75, f);
  vec3 sp = s * 7.0 + u_seed * 31.0; vec3 c = floor(sp); float h = hash13(c);
  vec3 fr = fract(sp) - 0.5 - (hash33(c + 3.1) - 0.5) * 0.5;
  col += vec3(1.0, 0.95, 0.88) * step(0.55, h) * smoothstep(0.1, 0.0, length(fr.xy)) * (0.55 + 0.45 * sin(u_time * 3.0 + h * 60.0)) * 1.7;
  col += vec3(0.95, 0.65, 1.0) * exp(-r * r * 5.0) * 0.3;
  col *= 0.75 + 0.35 * diff;
  col += vec3(1.0) * spec * 1.2 + vec3(0.85, 0.8, 1.0) * glassArc(p) * 0.3 + vec3(0.5, 0.55, 1.0) * fres * 0.75;
  return col;
}`;

  SKINS.magma = SIG + `{
  vec3 q = s * 2.6 + u_seed * 7.0;
  vec3 v = voronoi(q + 0.12 * vec3(sin(u_time * 0.3), cos(u_time * 0.25), 0.0));
  float edge = v.y - v.x;
  float crack = 1.0 - smoothstep(0.0, 0.13, edge);
  float heat = fbm3(s * 3.0 + vec3(0.0, 0.0, u_time * 0.35));
  float glow = crack * (0.55 + 0.9 * heat);
  vec3 crust = mix(vec3(0.05, 0.025, 0.025), vec3(0.24, 0.13, 0.1), fbm3(s * 9.0 + u_seed * 3.0)) * (0.35 + 0.85 * diff);
  crust *= 0.75 + 0.5 * v.z;
  vec3 lava = mix(vec3(0.85, 0.12, 0.0), vec3(1.0, 0.75, 0.15), smoothstep(0.4, 1.0, glow));
  lava = mix(lava, vec3(1.0, 1.0, 0.75), smoothstep(0.95, 1.35, glow));
  vec3 col = mix(crust, lava * 1.7, smoothstep(0.15, 0.7, glow));
  col += vec3(1.0, 0.3, 0.05) * smoothstep(0.35, 0.0, edge) * 0.25 * heat;
  col += vec3(1.0, 0.8, 0.7) * pow(max(dot(n, H), 0.0), 22.0) * 0.28 * (1.0 - crack);
  col += vec3(1.0, 0.32, 0.04) * fres * 0.95;
  return col;
}`;

  SKINS.opal = SIG + `{
  float th = fbm3(s * 2.2 + vec3(u_time * 0.04)) * 1.4 + (1.0 - n.z) * 0.9 + u_seed;
  vec3 irid = pal(th + u_time * 0.05, vec3(0.6), vec3(0.4), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 col = mix(vec3(0.93, 0.91, 0.99) * (0.5 + 0.5 * diff), irid, 0.5 + 0.3 * fres);
  vec3 v = voronoi(s * 5.0 + u_seed * 3.0);
  float flake = smoothstep(0.55, 0.12, v.x);
  float spark = pow(0.5 + 0.5 * sin(v.z * 60.0 + u_time * 2.5 + dot(n.xy, vec2(6.0, 4.0))), 6.0);
  col += pal(v.z + u_time * 0.1, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67)) * flake * spark * 0.95;
  col += vec3(1.0) * spec * 1.5 + vec3(1.0, 0.9, 1.0) * specW * 0.15 + vec3(1.0) * glassArc(p) * 0.4 + irid * fres * 0.6;
  return col;
}`;

  SKINS.plasma = SIG + `{
  vec2 q = s.xy;
  float ang = atan(q.y, q.x);
  vec3 col = vec3(0.025, 0.0, 0.07) + vec3(0.12, 0.02, 0.25) * (1.0 - r);
  col += vec3(0.2, 0.05, 0.38) * fbm3(vec3(q * 3.0, u_time * 0.6)) * (1.0 - r * 0.6);
  float glow = 0.0, core = 0.0;
  for (int i = 0; i < 7; i++){
    float fi = float(i);
    float h = hash13(vec3(fi, u_seed * 10.0, 3.0));
    float base = fi * 0.8976 + u_seed * TAU + 0.9 * sin(u_time * (0.35 + h * 0.5) + fi * 1.7);
    float wig = (noise(vec3(r * 4.5 - u_time * 2.2, fi * 3.1, u_time * 0.9 + h * 5.0)) - 0.5) * 2.0;
    wig += (noise(vec3(r * 11.0 - u_time * 4.0, fi * 7.3, u_time * 1.7)) - 0.5) * 0.6;
    float da = mod(ang - base - wig * 0.7 * r + PI, TAU) - PI;
    float dist = abs(da) * max(r, 0.05);
    float flick = 0.75 + 0.25 * sin(u_time * 23.0 + fi * 4.0 + h * 9.0);
    float reach = smoothstep(0.08, 0.25, r);
    core += smoothstep(0.024, 0.0, dist) * reach * flick;
    glow += 0.012 / (dist + 0.012) * reach * flick * 0.12;
  }
  col += vec3(0.55, 0.35, 1.0) * glow + vec3(0.95, 0.78, 1.0) * core;
  col += vec3(1.0, 0.7, 1.0) * exp(-r * r * 40.0) * 1.4 + vec3(0.5, 0.25, 1.0) * exp(-r * r * 7.0) * 0.45;
  col += vec3(0.4, 0.9, 1.0) * smoothstep(0.86, 0.98, r) * glow * 1.2;
  col += vec3(1.0) * spec * 1.1 + vec3(0.8, 0.85, 1.0) * glassArc(p) * 0.3 + vec3(0.45, 0.35, 1.0) * fres * 0.7;
  return col;
}`;

  SKINS.disco = SIG + `{
  float spin = u_time * 0.6;
  vec3 b = rotY(s, spin);
  float lat = asin(clamp(b.y, -1.0, 1.0));
  float lon = atan(b.z, b.x);
  float rows = 12.0;
  float latN = (lat / PI + 0.5) * rows;
  float li = floor(latN);
  float latC = ((li + 0.5) / rows - 0.5) * PI;
  float cols = max(4.0, floor(rows * 2.0 * cos(latC)));
  float lonN = (lon / TAU + 0.5) * cols;
  float lj = floor(lonN);
  vec2 f = vec2(fract(latN), fract(lonN));
  float grout = smoothstep(0.0, 0.09, f.x) * smoothstep(1.0, 0.91, f.x) * smoothstep(0.0, 0.09, f.y) * smoothstep(1.0, 0.91, f.y);
  float lonC = ((lj + 0.5) / cols - 0.5) * TAU;
  vec3 fn = vec3(cos(latC) * cos(lonC), sin(latC), cos(latC) * sin(lonC));
  vec3 vn = rotZ(rotY(fn, -spin), -u_angle);
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), vn);
  float t = u_time;
  vec3 env = vec3(0.03, 0.02, 0.06);
  env += vec3(1.0, 0.2, 0.6) * pow(max(dot(R, normalize(vec3(sin(t * 0.7), 0.5, cos(t * 0.7)))), 0.0), 18.0) * 2.2;
  env += vec3(0.2, 0.8, 1.0) * pow(max(dot(R, normalize(vec3(cos(t * 0.5), -0.4, sin(t * 0.5) + 0.3))), 0.0), 18.0) * 2.2;
  env += vec3(1.0, 0.85, 0.35) * pow(max(dot(R, normalize(vec3(-0.5, 0.7, 0.5))), 0.0), 30.0) * 3.0;
  env += vec3(0.6, 0.3, 1.0) * pow(max(dot(R, normalize(vec3(0.3, -0.8, 0.4))), 0.0), 12.0) * 0.9;
  env += mix(vec3(0.05, 0.02, 0.1), vec3(0.3, 0.2, 0.45), R.y * 0.5 + 0.5) * 0.7;
  float th = hash13(vec3(li, lj, floor(u_seed * 97.0)));
  vec3 tileCol = vec3(0.62, 0.64, 0.74) * (0.3 + 0.35 * th) + env;
  tileCol += vec3(1.0) * pow(max(sin(u_time * 4.0 + th * 50.0), 0.0), 24.0) * step(0.8, th) * 1.8;
  vec3 col = mix(vec3(0.03, 0.03, 0.05), tileCol, grout);
  col *= 0.65 + 0.45 * diff;
  col += vec3(1.0) * spec * 0.5 + vec3(0.6, 0.5, 1.0) * fres * 0.4;
  return col;
}`;

  /* ================= 0.0.4 : nouvelles peu communes ================= */
  SKINS.cdrom = SIG + `{
  vec2 q = s.xy; float rr = length(q); float a = atan(q.y, q.x);
  vec3 col = vec3(0.78, 0.8, 0.88) * (0.5 + 0.5 * diff);
  float band = fract(a / TAU * 2.0 + rr * 0.6 + u_time * 0.05);
  vec3 rb = pal(band + rr * 0.3, vec3(0.6), vec3(0.4), vec3(1.0), vec3(0.0, 0.33, 0.67));
  float sheen = pow(abs(cos(a * 2.0 - 0.8)), 6.0);
  col = mix(col, rb, 0.55 * sheen + 0.15);
  col *= 0.9 + 0.1 * sin(rr * 220.0);
  col = mix(col, vec3(0.85, 0.88, 0.95) * 0.7, smoothstep(0.24, 0.23, rr));
  col = mix(col, vec3(0.05), smoothstep(0.09, 0.08, rr));
  col += vec3(1.0) * spec * 1.2 + vec3(1.0) * glassArc(p) * 0.3;
  return col;
}`;
  SKINS.osier = SIG + `{
  float lat = asin(clamp(s.y, -1.0, 1.0)); float lon = atan(s.z, s.x);
  vec2 g = vec2(lon * 4.0, lat * 5.0) + u_seed * 3.0;
  vec2 c = floor(g); vec2 f = fract(g);
  float hz = step(0.5, mod(c.x + c.y, 2.0));
  float strand = mix(sin(f.x * PI), sin(f.y * PI), hz);
  float gx = smoothstep(0.0, 0.12, f.x) * smoothstep(1.0, 0.88, f.x);
  float gy = smoothstep(0.0, 0.12, f.y) * smoothstep(1.0, 0.88, f.y);
  float gaps = mix(gx, gy, hz);
  vec3 col = mix(vec3(0.5, 0.33, 0.16), vec3(0.82, 0.62, 0.36), strand) * (0.25 + 0.75 * gaps);
  col *= 0.85 + 0.3 * noise(vec3(g * 6.0, 1.0));
  col *= 0.45 + 0.65 * diff;
  col += vec3(1.0, 0.95, 0.85) * (spec * 0.3 + specW * 0.06);
  return col;
}`;
  SKINS.flower = SIG + `{
  float lat = asin(clamp(s.y, -1.0, 1.0)); float lon = atan(s.z, s.x);
  vec2 g = vec2(lon * 2.2, lat * 2.6) + u_seed * 4.0;
  vec2 c = floor(g); vec2 f = fract(g) - 0.5;
  float h = hash13(vec3(c, 7.0));
  f += (vec2(hash13(vec3(c, 1.0)), hash13(vec3(c, 2.0))) - 0.5) * 0.25;
  float a = atan(f.y, f.x) + h * 6.0 + u_time * 0.2; float d = length(f);
  float petal = 0.27 + 0.1 * cos(a * 5.0);
  float fl = smoothstep(petal + 0.02, petal - 0.02, d);
  vec3 bg = mix(vec3(0.6, 0.86, 0.68), vec3(0.42, 0.74, 0.56), noise(s * 4.0));
  vec3 pc = pal(h, vec3(0.88, 0.72, 0.82), vec3(0.12, 0.25, 0.18), vec3(1.0), vec3(0.0, 0.3, 0.6));
  vec3 col = mix(bg, pc, fl);
  col = mix(col, vec3(1.0, 0.82, 0.22), smoothstep(0.1, 0.08, d));
  col *= 0.5 + 0.6 * diff;
  col += vec3(1.0) * spec * 0.6 + vec3(1.0) * glassArc(p) * 0.2 + vec3(1.0, 0.9, 0.95) * fres * 0.2;
  return col;
}`;
  SKINS.extra = SIG + `{
  vec2 g = s.xy * 9.0;
  vec2 f = g - floor(g) - 0.5;
  float tone = clamp(diff * 1.1, 0.0, 1.0);
  float dr = 0.5 * sqrt(1.0 - tone) + 0.05;
  float dt = smoothstep(dr + 0.06, dr - 0.02, length(f));
  vec3 bgc = mix(vec3(1.0, 0.92, 0.1), vec3(0.15, 0.85, 1.0), step(0.0, sin(s.x * 3.0 + s.y * 1.5 + u_seed * 6.0)));
  vec3 col = mix(bgc, vec3(1.0, 0.18, 0.55), dt);
  col += vec3(1.0) * spec * 0.9;
  col = mix(col, vec3(0.04), smoothstep(0.86, 0.93, r));
  return col;
}`;
  SKINS.pasteque = SIG + `{
  float lon = atan(s.z, s.x);
  float st = sin(lon * 8.0 + 0.6 * sin(s.y * 6.0 + u_seed * 5.0));
  vec3 col = mix(vec3(0.12, 0.42, 0.12), vec3(0.45, 0.78, 0.3), smoothstep(-0.3, 0.3, st));
  col *= 0.85 + 0.25 * noise(s * 8.0);
  col *= 0.4 + 0.7 * diff;
  col += vec3(1.0) * spec * 0.7 + vec3(1.0) * glassArc(p) * 0.15;
  return col;
}`;
  SKINS.bulle = SIG + `{
  float th = (1.0 - n.z) * 2.0 + fbm3(s * 1.5 + vec3(0.0, 0.0, u_time * 0.2)) * 1.5 + u_time * 0.05;
  vec3 film = pal(th, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  float e = pow(1.0 - n.z, 1.5);
  vec3 col = vec3(0.04, 0.05, 0.1) + film * (0.15 + 0.85 * e);
  col += vec3(1.0) * (spec * 1.6 + specW * 0.1) + vec3(1.0) * glassArc(p) * 0.6;
  return col;
}`;
  SKINS.camo = SIG + `{
  float a1 = fbm3(s * 2.5 + u_seed * 3.0);
  float a2 = fbm3(s * 2.5 + vec3(7.0) + u_seed * 5.0);
  vec3 col = vec3(0.42, 0.45, 0.28);
  col = mix(col, vec3(0.25, 0.3, 0.17), step(0.5, a1));
  col = mix(col, vec3(0.56, 0.48, 0.33), step(0.56, a2));
  col = mix(col, vec3(0.12, 0.12, 0.09), step(0.62, a1 * a2 * 1.9));
  col *= 0.45 + 0.65 * diff;
  col += vec3(1.0) * spec * 0.2;
  return col;
}`;
  SKINS.granit = SIG + `{
  float g1 = noise(s * 18.0 + u_seed * 9.0); float g2 = noise(s * 40.0 + 3.0);
  vec3 col = vec3(0.7, 0.68, 0.66) * (0.8 + 0.25 * fbm3(s * 3.0));
  col = mix(col, vec3(0.12), step(0.72, g1));
  col = mix(col, vec3(0.85, 0.55, 0.5), step(0.8, g2) * 0.7);
  col *= 0.45 + 0.65 * diff;
  col += vec3(1.0) * spec * 0.9 + vec3(1.0) * glassArc(p) * 0.25;
  return col;
}`;

  /* ================= 0.0.4 : nouvelles épiques ================= */
  SKINS.chocolat = SIG + `{
  vec3 q = s * 1.8 + vec3(0.0, u_time * 0.12, u_seed * 4.0);
  float w = fbm(q + 1.8 * vec3(fbm3(q), fbm3(q + 3.1), 0.0));
  vec3 col = mix(vec3(0.15, 0.065, 0.03), vec3(0.45, 0.24, 0.11), smoothstep(0.35, 0.6, w));
  col = mix(col, vec3(0.95, 0.88, 0.75), smoothstep(0.66, 0.74, w));
  col *= 0.45 + 0.7 * diff;
  col += vec3(1.0, 0.92, 0.85) * (spec * 1.6 + specW * 0.2) + vec3(1.0) * glassArc(p) * 0.45 + vec3(0.5, 0.3, 0.15) * fres * 0.4;
  return col;
}`;
  SKINS.aqua = SIG + `{
  float wv = fbm3(vec3(p * 2.0, u_time * 0.4) + vec3(0.0, u_time * 0.3, u_seed * 4.0));
  vec3 col = mix(vec3(0.0, 0.32, 0.55), vec3(0.15, 0.85, 0.9), wv);
  vec3 v = voronoi(vec3(p * 3.5, u_time * 0.6));
  col += vec3(0.6, 1.0, 1.0) * smoothstep(0.12, 0.0, v.y - v.x) * 0.3;
  for (int i = 0; i < 6; i++){
    float fi = float(i); float h = hash13(vec3(fi, u_seed * 9.0, 4.0));
    float y = mod(u_time * (0.25 + 0.2 * h) + h * 3.0, 2.6) - 1.3;
    vec2 bp = vec2(sin(fi * 2.3 + u_time * 0.8) * 0.15 + (h - 0.5) * 1.1, y);
    float br = 0.04 + 0.05 * h; float d = length(p - bp);
    col += vec3(0.8, 1.0, 1.0) * smoothstep(br, br - 0.015, d) * smoothstep(br - 0.035, br, d) * 0.9;
  }
  col *= 0.7 + 0.35 * diff;
  col += vec3(1.0) * spec * 1.4 + vec3(1.0) * glassArc(p) * 0.45 + vec3(0.4, 0.9, 1.0) * fres * 0.6;
  return col;
}`;
  SKINS.deepfire = SIG + `{
  float n1 = fbm(vec3(p.x * 2.2, p.y * 1.6 - u_time * 1.4, u_time * 0.3 + u_seed * 5.0));
  float fl = clamp(n1 * 1.7 - (p.y + 1.0) * 0.62, 0.0, 1.0);
  vec3 col = vec3(0.03, 0.0, 0.0);
  col = mix(col, vec3(0.6, 0.02, 0.0), smoothstep(0.05, 0.35, fl));
  col = mix(col, vec3(1.0, 0.35, 0.02), smoothstep(0.3, 0.6, fl));
  col = mix(col, vec3(1.0, 0.85, 0.35), smoothstep(0.55, 0.85, fl));
  col = mix(col, vec3(1.0, 1.0, 0.85), smoothstep(0.85, 1.0, fl));
  col += vec3(1.0, 0.25, 0.0) * fres * 0.6 + vec3(1.0) * spec * 0.8 + vec3(1.0) * glassArc(p) * 0.25;
  return col;
}`;
  SKINS.arcade = SIG + `{
  vec2 q = s.xy; float px = 14.0;
  vec2 g = floor(q * px + 7.0);
  vec2 cell = floor(g / 7.0); vec2 lc = mod(g, 7.0);
  float sx = abs(lc.x - 3.0);
  float h = hash13(vec3(cell, floor(u_time * 1.5) + u_seed * 9.0));
  float on = step(0.5, hash13(vec3(sx, lc.y, h * 13.0)));
  float inside = step(0.5, lc.x) * step(lc.x, 5.5) * step(0.5, lc.y) * step(lc.y, 5.5);
  vec3 c1 = pal(h + u_time * 0.1, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 col = mix(vec3(0.02, 0.02, 0.06), c1 * 1.25, on * inside);
  vec2 f = fract(q * px);
  col *= smoothstep(0.0, 0.14, f.x) * smoothstep(0.0, 0.14, f.y) * 0.85 + 0.15;
  col *= 0.75 + 0.25 * sin(p.y * 120.0);
  col += vec3(1.0) * spec * 0.7 + vec3(1.0) * glassArc(p) * 0.3 + vec3(0.3, 0.5, 1.0) * fres * 0.5;
  return col;
}`;
  SKINS.trounoir = SIG + `{
  vec2 q = p; float rr = length(q); float a = atan(q.y, q.x);
  vec2 dq = vec2(q.x, q.y * 2.8); float dr = length(dq);
  float disk = smoothstep(0.95, 0.55, dr) * smoothstep(0.3, 0.42, dr);
  float sw = fbm3(vec3(atan(dq.y, dq.x) * 2.0 - u_time * 1.2 + dr * 6.0, dr * 4.0, u_seed * 5.0));
  vec3 dc = mix(vec3(1.0, 0.4, 0.05), vec3(1.0, 0.95, 0.7), sw);
  vec3 col = vec3(0.0);
  col += vec3(0.85) * step(0.985, hash13(vec3(floor(q * 30.0 / (0.5 + rr)), 5.0 + u_seed))) * smoothstep(0.45, 0.65, rr);
  col += dc * disk * (0.7 + 0.6 * sw);
  col += vec3(1.0, 0.7, 0.3) * smoothstep(0.07, 0.0, abs(rr - 0.52)) * smoothstep(-0.1, 0.25, q.y) * (0.6 + 0.4 * sin(a * 6.0 - u_time * 3.0));
  col += vec3(1.0, 0.9, 0.7) * smoothstep(0.05, 0.0, abs(rr - 0.36)) * 1.2;
  col *= smoothstep(0.3, 0.34, rr);
  col += vec3(1.0) * spec * 0.6 + vec3(0.5, 0.3, 0.2) * fres * 0.4;
  return col;
}`;
  SKINS.kaleido = SIG + `{
  vec2 q = s.xy; float a = atan(q.y, q.x); float rr = length(q);
  float seg = TAU / 8.0; a = mod(a, seg); a = abs(a - seg * 0.5);
  vec2 k = vec2(cos(a), sin(a)) * rr;
  vec3 cc = vec3(k * 4.0, u_time * 0.3 + u_seed * 7.0);
  float f1 = fbm3(cc); float f2 = noise(cc * 2.0 + 3.0);
  vec3 col = pal(f1 * 1.5 + rr + u_time * 0.05, vec3(0.55), vec3(0.45), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col *= 0.55 + 0.6 * smoothstep(0.3, 0.7, f2);
  col += vec3(1.0) * smoothstep(0.03, 0.0, abs(fract(rr * 6.0 - u_time * 0.3) - 0.5) - 0.46) * 0.3;
  col *= 0.75 + 0.35 * diff;
  col += vec3(1.0) * spec * 1.3 + vec3(1.0) * glassArc(p) * 0.4;
  return col;
}`;
  SKINS.orage = SIG + `{
  vec3 q = s * 2.0 + vec3(u_time * 0.15, 0.0, u_seed * 5.0);
  float cl = fbm(q + fbm3(q * 1.5));
  vec3 col = mix(vec3(0.05, 0.06, 0.1), vec3(0.32, 0.35, 0.45), smoothstep(0.3, 0.75, cl));
  float tk = floor(u_time * 3.0);
  float fl = step(0.82, fract(sin(tk * 12.9898 + u_seed * 43.0) * 43758.5));
  float bx = 0.25 * sin(p.y * 7.0 + tk) + 0.08 * (noise(vec3(p.y * 12.0, tk, 1.0)) - 0.5) + (hash13(vec3(tk, 2.0, 3.0)) - 0.5) * 0.8;
  float bolt = smoothstep(0.035, 0.0, abs(p.x - bx)) * smoothstep(-0.9, 0.6, p.y);
  col += vec3(0.85, 0.92, 1.0) * bolt * fl * 1.6 + vec3(0.35, 0.4, 0.6) * fl * cl * 0.8;
  col *= 0.75 + 0.35 * diff;
  col += vec3(1.0) * spec + vec3(1.0) * glassArc(p) * 0.3 + vec3(0.5, 0.6, 0.9) * fres * 0.5;
  return col;
}`;

  /* ================= 0.0.4 : nouvelles légendaires ================= */
  SKINS.vertue = SIG + `{
  vec3 v = voronoi(s * 3.0 + u_seed * 4.0);
  float fil = smoothstep(0.05, 0.0, v.y - v.x);
  float swl = smoothstep(0.05, 0.0, abs(sin(atan(s.y, s.x) * 3.0 + length(s.xy) * 10.0 - u_time * 0.5)) * 0.1);
  vec3 col = vec3(0.96, 0.94, 0.9) * (0.6 + 0.45 * diff);
  col += vec3(1.0, 0.95, 0.8) * exp(-r * r * 3.0) * 0.25;
  vec3 gold = vec3(1.0, 0.78, 0.3);
  col = mix(col, gold * (0.75 + 1.8 * specW), max(fil, swl * 0.7));
  float ang = atan(p.x, p.y);
  col += vec3(1.0, 0.95, 0.75) * pow(0.5 + 0.5 * sin(ang * 12.0 + u_time * 0.6), 8.0) * smoothstep(-0.2, 1.0, p.y) * 0.25;
  vec3 sp = s * 9.0; vec3 c = floor(sp); float h = hash13(c + u_seed);
  col += vec3(1.0, 0.9, 0.6) * step(0.9, h) * smoothstep(0.1, 0.0, length(fract(sp) - 0.5)) * (0.5 + 0.5 * sin(u_time * 4.0 + h * 40.0)) * 2.0;
  col += vec3(1.0) * spec * 1.4 + vec3(1.0) * glassArc(p) * 0.4 + vec3(1.0, 0.85, 0.5) * fres * 0.7;
  return col;
}`;
  SKINS.iridextra = SIG + `{
  vec3 q = s * 1.6 + vec3(u_time * 0.1, -u_time * 0.07, u_seed * 5.0);
  float w = fbm(q + 2.0 * vec3(fbm3(q + 1.7), fbm3(q + 4.2), 0.0));
  float th = w * 3.0 + (1.0 - n.z) * 2.0 + u_time * 0.2;
  vec3 film = pal(th, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 film2 = pal(th * 1.7 + 0.3, vec3(0.5), vec3(0.5), vec3(1.0, 0.9, 0.8), vec3(0.3, 0.2, 0.2));
  vec3 col = mix(film, film2, 0.5 + 0.5 * sin(w * 12.0)) * (0.55 + 0.6 * diff);
  vec2 g = fract(s.xy * 14.0);
  col += pal(dot(n.xy, vec2(2.0, 1.0)) + u_time * 0.3, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67)) * smoothstep(0.08, 0.0, min(g.x, g.y)) * 0.35;
  vec3 sp = s * 11.0 + u_seed; vec3 c = floor(sp); float h = hash13(c);
  col += vec3(1.0) * step(0.85, h) * smoothstep(0.09, 0.0, length(fract(sp) - 0.5)) * pow(max(sin(u_time * 5.0 + h * 60.0), 0.0), 8.0) * 3.0;
  col += vec3(1.0) * spec * 1.8 + vec3(1.0) * glassArc(p) * 0.5 + film * fres * 0.9;
  return col;
}`;
  SKINS.deepaqua = SIG + `{
  vec2 q = s.xy; float rr = length(q); float a = atan(q.y, q.x);
  float sw = a + rr * 5.0 - u_time * 0.8;
  float vort = fbm3(vec3(cos(sw) * rr * 3.0, sin(sw) * rr * 3.0, u_time * 0.2 + u_seed * 5.0));
  vec3 col = mix(vec3(0.0, 0.03, 0.13), vec3(0.0, 0.42, 0.72), clamp(vort * 1.5 * (1.25 - rr), 0.0, 1.0));
  col += vec3(0.1, 0.8, 1.0) * smoothstep(0.5, 0.8, vort) * 0.75;
  col += vec3(0.2, 0.7, 1.0) * smoothstep(0.03, 0.0, abs(fract(sw * 0.477) - 0.5) - 0.46) * 0.35 * (1.0 - rr);
  for (int i = 0; i < 10; i++){
    float fi = float(i); float h = hash13(vec3(fi, 2.0, u_seed * 7.0));
    float ang = h * TAU + u_time * (0.6 + h);
    float pr = fract(h * 3.7 - u_time * 0.08) * 0.9;
    vec2 pp2 = vec2(cos(ang), sin(ang)) * pr;
    float d = length(q - pp2);
    col += mix(vec3(0.2, 1.0, 0.9), vec3(0.5, 0.6, 1.0), h) * exp(-d * d * 900.0) * 1.6;
  }
  vec3 v = voronoi(vec3(p * 2.5, u_time * 0.5));
  col += vec3(0.3, 0.9, 1.0) * pow(smoothstep(0.25, 0.0, v.y - v.x), 2.0) * smoothstep(0.0, 1.0, p.y) * 0.4;
  col *= 0.75 + 0.3 * diff;
  col += vec3(1.0) * spec * 1.4 + vec3(1.0) * glassArc(p) * 0.45 + vec3(0.1, 0.6, 1.0) * fres * 0.8;
  return col;
}`;
  SKINS.electrique = SIG + `{
  vec3 q = s * 2.6 + vec3(0.0, 0.0, floor(u_time * 8.0) * 0.37) + u_seed * 4.0;
  vec3 v = voronoi(q);
  float e = v.y - v.x;
  float arc = smoothstep(0.06, 0.0, e);
  float glow = 0.03 / (e + 0.03);
  float fl = 0.6 + 0.4 * hash13(vec3(floor(u_time * 20.0), v.z * 10.0, 1.0));
  vec3 col = vec3(0.01, 0.02, 0.08) + vec3(0.05, 0.1, 0.25) * (1.0 - r);
  col += vec3(0.3, 0.7, 1.0) * glow * 0.25 * fl + vec3(1.0, 0.95, 0.4) * arc * fl * 1.2;
  col += vec3(0.6, 0.9, 1.0) * exp(-r * r * 12.0) * 0.5 * (0.7 + 0.3 * sin(u_time * 30.0));
  col += vec3(1.0) * spec * 1.2 + vec3(1.0) * glassArc(p) * 0.35 + vec3(0.3, 0.7, 1.0) * fres * 0.8;
  return col;
}`;
  SKINS.sunshine = SIG + `{
  vec3 q = s * 6.0 + vec3(u_time * 0.2, 0.0, u_seed * 5.0);
  vec3 v = voronoi(q);
  float gran = smoothstep(0.0, 0.5, v.x);
  float spots = smoothstep(0.62, 0.7, fbm3(s * 2.0 + u_seed * 3.0 + vec3(0.0, u_time * 0.03, 0.0)));
  vec3 col = mix(vec3(1.0, 0.55, 0.05), vec3(1.0, 0.92, 0.45), 1.0 - gran * 0.7);
  col = mix(col, vec3(0.6, 0.2, 0.0), spots * 0.6);
  col *= mix(0.6, 1.25, n.z);
  float fl = fbm3(vec3(atan(p.y, p.x) * 3.0, u_time * 0.5, u_seed));
  col += vec3(1.0, 0.6, 0.1) * smoothstep(0.75, 1.0, r) * fl * 1.2;
  col += vec3(1.0, 1.0, 0.8) * spec * 0.5;
  return col;
}`;
  SKINS.aze = SIG + `{
  vec3 q = s * 1.4 + vec3(0.0, 0.0, u_time * 0.15);
  float c1 = fbm3(q + vec3(u_seed * 3.0 + sin(u_time * 0.3), 0.0, 0.0));
  float c2 = fbm3(q * 1.1 + vec3(5.2, 1.3, u_time * 0.1));
  float c3 = fbm3(q * 0.9 + vec3(9.1, 4.7, -u_time * 0.12));
  vec3 cyan = vec3(0.0, 0.94, 1.0), mag = vec3(1.0, 0.1, 0.75), yel = vec3(1.0, 0.95, 0.0);
  float k1 = smoothstep(0.45, 0.55, c1), k2 = smoothstep(0.47, 0.57, c2), k3 = smoothstep(0.46, 0.56, c3);
  vec3 col = vec3(0.04, 0.02, 0.08);
  col = mix(col, cyan, k1);
  col = mix(col, mag, k2 * (1.0 - k1 * 0.5));
  col = mix(col, yel, k3 * (1.0 - max(k1, k2) * 0.6));
  float edges = smoothstep(0.03, 0.0, abs(c1 - 0.5)) + smoothstep(0.03, 0.0, abs(c2 - 0.52)) + smoothstep(0.03, 0.0, abs(c3 - 0.51));
  col += vec3(1.0) * edges * 0.5;
  vec2 e = s.xy;
  col = mix(col, vec3(1.0), smoothstep(0.03, 0.0, abs(e.x) * abs(e.y) * 40.0 + length(e) * 0.6 - 0.12));
  col *= 0.7 + 0.4 * diff;
  vec3 sp = s * 10.0 + u_seed; vec3 c = floor(sp); float h = hash13(c);
  vec3 spc = h < 0.33 ? cyan : (h < 0.66 ? mag : yel);
  col += spc * step(0.86, hash13(c + 3.0)) * smoothstep(0.1, 0.0, length(fract(sp) - 0.5)) * pow(max(sin(u_time * 4.0 + h * 50.0), 0.0), 6.0) * 2.5;
  col += vec3(1.0) * spec * 1.5 + vec3(1.0) * glassArc(p) * 0.45 + mix(cyan, mag, 0.5 + 0.5 * sin(u_time + p.x * 3.0)) * fres * 0.9;
  return col;
}`;

  /* ================= 0.1.0 : Rypoint, le protogen ================= */
  // Le visage reste tourné vers nous et se balance quand la bille roule ; la fourrure, elle, tourne avec la bille.
  SKINS.rypoint = SIG + `{
  float wob = sin(u_angle) * 0.22;
  float cw = cos(wob), sw = sin(wob);
  vec2 q = vec2(cw * p.x - sw * p.y, sw * p.x + cw * p.y);
  float fur = fbm3(vec3(s.xy * 7.0, s.z * 3.0 + u_seed * 3.0));
  float strands = 0.5 + 0.5 * sin(atan(q.y, q.x) * 24.0 + fur * 7.0 + length(q) * 9.0);
  vec3 col = mix(vec3(0.92, 0.3, 0.07), vec3(1.0, 0.55, 0.13), fur);
  col = mix(col, vec3(1.0, 0.78, 0.3), smoothstep(0.6, 0.95, strands * fur * 1.3));
  col = mix(col, vec3(0.7, 0.1, 0.06), smoothstep(-0.35, -0.95, q.y) * 0.45);
  col *= 0.5 + 0.65 * diff;
  for (int i = 0; i < 2; i++){
    float sx = i == 0 ? -1.0 : 1.0;
    vec2 d = normalize(vec2(0.42 * sx, 1.0));
    vec2 e = q - vec2(0.5 * sx, 0.62);
    float u = dot(e, d), v = dot(e, vec2(d.y, -d.x));
    float w = 0.19 * clamp(1.0 - (u + 0.22) / 0.62, 0.0, 1.0);
    float ear = step(-0.22, u) * smoothstep(w + 0.01, w - 0.01, abs(v));
    float inner = step(-0.18, u) * step(u, 0.2) * smoothstep(w * 0.45 + 0.01, w * 0.45 - 0.01, abs(v));
    vec3 ec = mix(vec3(1.0, 0.52, 0.12), vec3(1.0, 0.88, 0.38), smoothstep(0.04, 0.18, u)) * (0.6 + 0.6 * diff);
    ec = mix(ec, vec3(0.9, 0.1, 0.25) * (0.6 + 0.5 * diff), inner);
    float rim = smoothstep(w - 0.04, w - 0.012, abs(v)) * ear;
    col = mix(col, ec, ear);
    col = mix(col, vec3(0.22, 0.05, 0.02), rim * 0.85);
  }
  float bd = abs(length(q - vec2(0.0, -0.08)) - 0.8);
  float band = smoothstep(0.06, 0.045, bd) * smoothstep(-0.05, 0.1, q.y);
  vec3 bc = vec3(0.12, 0.55, 1.0) * (0.55 + 0.7 * diff) + vec3(0.6, 0.9, 1.0) * smoothstep(0.02, 0.0, abs(length(q - vec2(0.0, -0.08)) - 0.815)) * 0.5;
  col = mix(col, bc, band);
  vec2 vq = (q - vec2(0.0, -0.08)) / vec2(0.6, 0.5);
  float vis = smoothstep(1.03, 0.97, pow(abs(vq.x), 2.4) + pow(abs(vq.y), 2.4));
  vec3 vc = vec3(0.015, 0.015, 0.03);
  vc += vec3(0.25, 0.28, 0.35) * smoothstep(0.35, 0.0, abs(vq.y - 0.55 + vq.x * 0.4)) * smoothstep(0.2, -0.6, vq.x) * 0.6;
  vec2 b1 = q - vec2(0.3, -0.18), b2 = q - vec2(-0.3, -0.18);
  vc += vec3(0.6, 0.1, 0.12) * (exp(-dot(b1, b1) * 30.0) + exp(-dot(b2, b2) * 30.0)) * 0.35;
  col = mix(col, vc, vis);
  for (int i = 0; i < 2; i++){
    float sx = i == 0 ? -1.0 : 1.0;
    float dd = length(q - vec2(0.72 * sx, -0.06));
    float cup = smoothstep(0.215, 0.2, dd);
    vec3 cc = vec3(0.04, 0.06, 0.14) * (0.6 + 0.6 * diff) + vec3(0.2, 0.75, 1.0) * smoothstep(0.03, 0.0, abs(dd - 0.17)) * 0.9;
    col = mix(col, cc, cup);
  }
  float bt = fract(u_time * 0.23 + u_seed * 3.0);
  float blink = mix(0.1, 1.0, smoothstep(0.0, 0.035, abs(bt - 0.5)));
  float led = 0.0, glow = 0.0;
  for (int i = 0; i < 2; i++){
    float sx = i == 0 ? -1.0 : 1.0;
    vec2 e = q - vec2(0.23 * sx, -0.02);
    float el = length(e / vec2(0.12, 0.095 * blink));
    float cut = e.y - (0.025 + 0.32 * e.x * sx);
    led += smoothstep(1.08, 0.92, el) * smoothstep(0.012, -0.012, cut);
    glow += smoothstep(2.2, 0.8, el) * 0.25;
    vec2 k = q - vec2(0.34 * sx, -0.2);
    led += smoothstep(0.016, 0.004, abs(k.x * 0.8 + k.y * 0.6 * sx)) * step(abs(k.y), 0.045) * 0.8;
    vec2 m = q - vec2(0.055 * sx, -0.25);
    led += smoothstep(0.016, 0.004, abs(length(m) - 0.055)) * step(m.y, 0.005);
  }
  led = clamp(led, 0.0, 1.0) * vis;
  glow *= vis;
  col += vec3(1.0, 0.9, 0.22) * (glow + led * 1.4) * (0.88 + 0.12 * sin(q.y * 110.0));
  col += vec3(1.0) * spec * 0.9 + vec3(1.0) * glassArc(p) * 0.25 + vec3(1.0, 0.6, 0.2) * fres * 0.35;
  return col;
}`;

  const G = { ok: false, canvas: null, ATLAS_W: ATLAS_W, ATLAS_H: ATLAS_H, MAIN_H: MAIN_H, ids: Object.keys(SKINS) };
  let gl = null, vsh = null;
  const progs = {};

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      console.warn('[MagicRace] shader :', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  // programme d'une apparence, compilé au premier besoin
  function program(id) {
    if (progs[id] !== undefined) return progs[id] || progs.solid;
    progs[id] = null;
    const src = SKINS[id];
    if (!src) return progs.solid;
    const fs = compile(gl.FRAGMENT_SHADER, PRELUDE + src + MAIN);
    if (!fs) return progs.solid || null;
    const pr = gl.createProgram();
    gl.attachShader(pr, vsh); gl.attachShader(pr, fs);
    gl.bindAttribLocation(pr, 0, 'a');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn('[MagicRace] link :', gl.getProgramInfoLog(pr)); return progs.solid || null; }
    const loc = {};
    ['u_time', 'u_angle', 'u_seed', 'u_px', 'u_col'].forEach(function (k) { loc[k] = gl.getUniformLocation(pr, k); });
    progs[id] = { pr: pr, loc: loc };
    return progs[id];
  }

  G.init = function () {
    try {
      const cv = document.createElement('canvas');
      cv.width = ATLAS_W; cv.height = ATLAS_H;
      gl = cv.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true, depth: false, stencil: false })
        || cv.getContext('experimental-webgl');
      if (!gl) return false;
      vsh = compile(gl.VERTEX_SHADER, VS);
      if (!vsh) return false;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      if (!program('solid')) return false;
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); G.ok = false; });
      G.canvas = cv;
      G.ok = true;
      return true;
    } catch (e) {
      console.warn('[MagicRace] WebGL indisponible', e);
      G.ok = false;
      return false;
    }
  };

  // précompile les autres apparences en arrière-plan, une à la fois
  G.warm = function () {
    if (!G.ok) return;
    const todo = G.ids.filter(function (id) { return progs[id] === undefined; });
    let i = 0;
    (function next() {
      if (i >= todo.length || !G.ok) return;
      program(todo[i++]);
      setTimeout(next, 90);
    })();
  };

  /* specs : [{ skin, col:[r,g,b] 0..1, seed, angle }]
   * region 0 : billes de la course, region 1 : aperçus et cartes. Renvoie une case {sx, sy, size} par spec (ou null). */
  G.render = function (specs, tile, time, region) {
    const out = [];
    if (!G.ok) return out;
    tile = Math.max(16, Math.min(512, Math.round(tile)));
    const per = Math.floor(ATLAS_W / tile);
    const y0 = region ? MAIN_H : 0, y1 = region ? ATLAS_H : MAIN_H;
    let cur = null;
    const t = time % 1000, px = 2 / tile;
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      const cx = (i % per) * tile, cy = y0 + Math.floor(i / per) * tile;
      if (cy + tile > y1 || !sp) { out.push(null); continue; }
      const pg = program(sp.skin);
      if (!pg) { out.push(null); continue; }
      if (pg !== cur) {
        gl.useProgram(pg.pr);
        gl.uniform1f(pg.loc.u_time, t);
        gl.uniform1f(pg.loc.u_px, px);
        cur = pg;
      }
      gl.viewport(cx, ATLAS_H - cy - tile, tile, tile);
      gl.uniform1f(pg.loc.u_angle, sp.angle);
      gl.uniform1f(pg.loc.u_seed, sp.seed);
      gl.uniform3f(pg.loc.u_col, sp.col[0], sp.col[1], sp.col[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      out.push({ sx: cx, sy: cy, size: tile });
    }
    return out;
  };

  G.blit = function (ctx, slot, dx, dy, dw, dh) {
    if (!slot) return;
    ctx.drawImage(G.canvas, slot.sx, slot.sy, slot.size, slot.size, dx, dy, dw, dh);
  };

  G.spec = function (cfg, angle, out) {
    const o = out || {};
    if (o._c !== cfg.color) { o._c = cfg.color; o.col = MR.hexToRgb(cfg.color); }
    o.skin = SKINS[cfg.skin] ? cfg.skin : 'solid';
    o.seed = cfg.seed || 0;
    o.angle = angle || 0;
    return o;
  };

  // Rendu de secours sans WebGL : dégradé radial.
  G.fallback = function (ctx, x, y, r, cfg) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, cfg.color || '#ff3ea5'); g.addColorStop(1, '#05030a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, MR.TAU); ctx.fill();
  };
  // Silhouette d'une bille pas encore obtenue
  G.silhouette = function (ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#3a2c55'); g.addColorStop(1, '#0c0716');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, MR.TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,160,255,0.35)'; ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,200,255,0.55)';
    ctx.font = '700 ' + Math.round(r * 0.95) + 'px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y + r * 0.05);
  };

  MR.MarbleGL = G;
})(window.MR);

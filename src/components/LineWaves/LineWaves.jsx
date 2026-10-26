import { useEffect, useRef, useCallback } from 'react';
import './LineWaves.css';
import logger from '../../utils/logger';

/* ── helpers ────────────────────────────────────────────────── */
function hexToVec3(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/* ── shaders ────────────────────────────────────────────────── */
const vertexSrc = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentSrc = `
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uSpeed;
uniform float uWaves;
uniform float uWarp;
uniform float uBrightness;
uniform float uEdgeFade;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec2  uMouse;
uniform float uMouseInfluence;
uniform bool  uEnableMouse;

#define PI 3.14159265

/* --- noise helpers --- */
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float smoothNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

float displaceA(float c, float t) {
  return sin(c * 2.12) * 0.2
       + sin(c * 3.23 + t * 4.35) * 0.1
       + sin(c * 0.59 + t * 0.93) * 0.5;
}

float displaceB(float c, float t) {
  return sin(c * 1.35) * 0.3
       + sin(c * 2.73 + t * 3.35) * 0.2
       + sin(c * 0.19 + t * 0.93) * 0.3;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 co = uv * 2.0 - 1.0;

  float ht = uTime * uSpeed * 0.5;
  float ft = uTime * uSpeed;

  /* mouse repulsion */
  float mw = 0.0;
  if (uEnableMouse) {
    vec2 mp = uMouse * 2.0 - 1.0;
    float md = length(co - mp);
    mw = uMouseInfluence * exp(-md * md * 4.0);
  }

  /* warp fields */
  float wAx = co.x + displaceA(co.y, ht) * uWarp + mw;
  float wAy = co.y - displaceA(co.x * cos(ft) * 1.24, ht) * uWarp;
  float wBx = co.x + displaceB(co.y, ht) * uWarp + mw;
  float wBy = co.y - displaceB(co.x * sin(ft) * 1.24, ht) * uWarp;

  /* inner lines (smooth wave bundle) */
  float inner = 0.0;
  for (float i = 0.0; i < 20.0; i += 1.0) {
    if (i >= uWaves) break;
    float offset = i * 0.06;
    float sA = sin(wAx * (4.0 + i * 0.22) + ht * 2.0 + offset) * 0.22;
    float sB = cos(wBy * (3.0 + i * 0.18) + ht * 1.5 + offset) * 0.22;
    float lineA = smoothstep(0.0, 0.012, abs(wAy + sA - offset * 0.5));
    float lineB = smoothstep(0.0, 0.012, abs(wBx + sB - offset * 0.5));
    inner += (1.0 - lineA) * 0.6;
    inner += (1.0 - lineB) * 0.6;
  }

  /* outer fading lines */
  for (float i = 0.0; i < 12.0; i += 1.0) {
    float offset = i * 0.09;
    float sA = sin(wAx * (2.0 + i * 0.3) + ht + offset) * 0.3;
    float lineA = smoothstep(0.0, 0.018, abs(co.y + sA - 0.5 + offset * 0.6));
    inner += (1.0 - lineA) * 0.25;
  }

  /* colour cycling */
  float cyc = uTime * 0.12;
  vec3 col = mix(uColor1, uColor2, sin(cyc + co.x * 2.0) * 0.5 + 0.5);
  col = mix(col, uColor3, cos(cyc * 1.3 + co.y * 2.0) * 0.5 + 0.5);

  /* edge vignette */
  float edge = smoothstep(0.0, uEdgeFade, uv.x)
             * smoothstep(0.0, uEdgeFade, 1.0 - uv.x)
             * smoothstep(0.0, uEdgeFade, uv.y)
             * smoothstep(0.0, uEdgeFade, 1.0 - uv.y);

  float brightness = clamp(inner * uBrightness * edge, 0.0, 1.0);
  gl_FragColor = vec4(col * brightness, brightness);
}
`;

/* ── component ─────────────────────────────────────────────── */
export default function LineWaves({
  lineColor1 = '#4f46e5',
  lineColor2 = '#06b6d4',
  lineColor3 = '#a855f7',
  backgroundColor = 'transparent',
  waveSpeed = 0.5,
  warpIntensity = 0.6,
  numWaves = 12,
  brightness = 1.4,
  edgeFade = 0.3,
  enableMouseInteraction = true,
  mouseInfluence = 0.22,
  style,
  className = '',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const mouseRef = useRef([0.5, 0.5]);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const uniformsRef = useRef({});

  /* compile helper */
  const compileShader = useCallback((gl, type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      logger.error('Shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* create canvas */
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });
    if (!gl) {
      logger.warn('WebGL unavailable');
      return;
    }
    glRef.current = gl;

    /* shaders & program */
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      logger.error('Program error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);
    programRef.current = prog;

    /* full-screen quad */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    /* cache uniform locations */
    const loc = {};
    [
      'uTime', 'uResolution', 'uSpeed', 'uWaves', 'uWarp',
      'uBrightness', 'uEdgeFade',
      'uColor1', 'uColor2', 'uColor3',
      'uMouse', 'uMouseInfluence', 'uEnableMouse',
    ].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
    uniformsRef.current = loc;

    /* resize */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    /* mouse */
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = [
        (e.clientX - r.left) / r.width,
        1.0 - (e.clientY - r.top) / r.height,
      ];
    };
    if (enableMouseInteraction) container.addEventListener('mousemove', onMove);

    /* blend */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    /* loop */
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) * 0.001;
      gl.uniform1f(loc.uTime, t);
      gl.uniform2f(loc.uResolution, canvas.width, canvas.height);
      gl.uniform1f(loc.uSpeed, waveSpeed);
      gl.uniform1f(loc.uWaves, numWaves);
      gl.uniform1f(loc.uWarp, warpIntensity);
      gl.uniform1f(loc.uBrightness, brightness);
      gl.uniform1f(loc.uEdgeFade, edgeFade);
      gl.uniform3fv(loc.uColor1, hexToVec3(lineColor1));
      gl.uniform3fv(loc.uColor2, hexToVec3(lineColor2));
      gl.uniform3fv(loc.uColor3, hexToVec3(lineColor3));
      gl.uniform2fv(loc.uMouse, mouseRef.current);
      gl.uniform1f(loc.uMouseInfluence, mouseInfluence);
      gl.uniform1i(loc.uEnableMouse, enableMouseInteraction ? 1 : 0);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      if (enableMouseInteraction) container.removeEventListener('mousemove', onMove);
      canvas.remove();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [
    compileShader, lineColor1, lineColor2, lineColor3,
    waveSpeed, warpIntensity, numWaves, brightness, edgeFade,
    enableMouseInteraction, mouseInfluence,
  ]);

  return (
    <div
      ref={containerRef}
      className={`line-waves-container ${className}`}
      style={{ background: backgroundColor, ...style }}
    />
  );
}

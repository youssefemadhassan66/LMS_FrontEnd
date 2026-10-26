/// <reference types="vitest" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

// Where the canvas module expects Excalidraw's font files to live. Must match
// window.EXCALIDRAW_ASSET_PATH in src/components/Canvas/excalidrawAssets.js.
const EXCALIDRAW_ASSET_DIR = 'excalidraw-assets'

// Excalidraw's default is to pull fonts from unpkg.com at runtime. The
// production CSP below is `font-src 'self' …` with no CDN, so that fetch is
// blocked and every hand-drawn font silently falls back. Copying the fonts into
// public/ makes them same-origin and keeps the CSP tight.
//
// Xiaolai is deliberately excluded: it is the CJK face and accounts for 13 MB
// of the package's 14 MB of fonts, and this platform's content is English and
// Arabic. If CJK text is ever pasted onto a board it will render in a fallback
// face rather than Excalifont's CJK companion — add 'Xiaolai' back here if that
// ever matters more than 13 MB of build artifact.
const EXCLUDED_FONT_FAMILIES = new Set(['Xiaolai'])

const excalidrawAssetsPlugin = () => ({
  name: 'algogambit-excalidraw-assets',
  // buildStart fires for `vite` and `vite build` alike, and public/ is served
  // in dev and copied to dist on build — so one hook covers both modes.
  buildStart() {
    const source = path.join(
      projectRoot,
      'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
    )
    const destination = path.join(projectRoot, 'public', EXCALIDRAW_ASSET_DIR, 'fonts')

    if (!fs.existsSync(source)) {
      this.warn(
        '@excalidraw/excalidraw fonts not found — run npm install. Boards will render with fallback fonts.',
      )
      return
    }

    fs.rmSync(destination, { recursive: true, force: true })
    fs.mkdirSync(destination, { recursive: true })

    for (const family of fs.readdirSync(source)) {
      if (EXCLUDED_FONT_FAMILIES.has(family)) continue
      fs.cpSync(path.join(source, family), path.join(destination, family), {
        recursive: true,
      })
    }
  },
})

// The code sandbox (public/sandbox/sandbox-worker.js) runs Python through
// Pyodide. The CSP has no CDN in script-src, so the runtime is served from our
// own origin. These are the only files loadPyodide() needs for the core
// interpreter and the standard library; no extra packages are fetched.
const PYODIDE_FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
]

const pyodideAssetsPlugin = () => ({
  name: 'algogambit-pyodide-assets',
  buildStart() {
    const source = path.join(projectRoot, 'node_modules/pyodide')
    const destination = path.join(projectRoot, 'public', 'sandbox', 'pyodide')

    if (!fs.existsSync(source)) {
      this.warn('pyodide not found — run npm install. The code sandbox will not run Python.')
      return
    }

    fs.mkdirSync(destination, { recursive: true })
    for (const file of PYODIDE_FILES) {
      const from = path.join(source, file)
      const to = path.join(destination, file)
      // ~13 MB in total: only copy what changed since the last dev start/build
      const current = fs.existsSync(to) ? fs.statSync(to) : null
      const next = fs.statSync(from)
      if (current && current.size === next.size && current.mtimeMs >= next.mtimeMs) continue
      fs.copyFileSync(from, to)
    }
  },
})

const isLocalHostname = (hostname) => (
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname === '0.0.0.0' ||
  hostname === '[::]' ||
  hostname === '[::1]' ||
  /^127(?:\.\d{1,3}){3}$/.test(hostname)
)

const validatePublicOrigin = (name, rawValue) => {
  const value = rawValue?.trim()

  if (!value) {
    throw new Error(`${name} is required for production builds.`)
  }

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`)
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS for production builds.`)
  }

  if (isLocalHostname(url.hostname.toLowerCase())) {
    throw new Error(`${name} must not point to a local host in production.`)
  }

  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an origin only (for example, https://api.example.com).`)
  }

  return url.origin
}

const validateOptionalPublicEndpoint = (name, rawValue) => {
  const value = rawValue?.trim()
  if (!value) return null

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid absolute URL when configured.`)
  }

  if (url.protocol !== 'https:' || isLocalHostname(url.hostname.toLowerCase())) {
    throw new Error(`${name} must use a non-local HTTPS URL in production.`)
  }

  if (url.username || url.password) {
    throw new Error(`${name} must not include URL credentials.`)
  }

  return url.origin
}

export const validateBuildEnvironment = (env) => ({
  apiOrigin: validatePublicOrigin('VITE_API_BASE', env.VITE_API_BASE),
  socketOrigin: validatePublicOrigin('VITE_SOCKET_URL', env.VITE_SOCKET_URL),
  errorOrigin: validateOptionalPublicEndpoint('VITE_ERROR_ENDPOINT', env.VITE_ERROR_ENDPOINT),
})

const createContentSecurityPolicy = ({ apiOrigin, socketOrigin, errorOrigin }) => {
  const socketWebSocketOrigin = `wss://${new URL(socketOrigin).host}`
  const connectSources = [
    ...new Set(["'self'", apiOrigin, socketOrigin, socketWebSocketOrigin, errorOrigin]),
  ].filter(Boolean)

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    // Excalidraw runs its font-subsetting work in a blob: worker; without this
    // it falls back to default-src and the worker is refused.
    "worker-src 'self' blob:",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

const productionCspPlugin = (origins) => ({
  name: 'algogambit-production-csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'pre',
    handler: () => ([
      {
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: createContentSecurityPolicy(origins),
        },
        injectTo: 'head-prepend',
      },
    ]),
  },
})

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const productionOrigins = command === 'build' ? validateBuildEnvironment(env) : null

  return {
    plugins: [
      react(),
      excalidrawAssetsPlugin(),
      pyodideAssetsPlugin(),
      ...(productionOrigins ? [productionCspPlugin(productionOrigins)] : []),
    ],

    server: {
      // Excalidraw ships its font files as static assets under public/. They
      // never change while the dev server runs, and on Windows the browser
      // holding one open makes chokidar's watch() throw EBUSY, which takes the
      // whole dev server down. Nothing is lost by not watching them.
      watch: {
        ignored: ['**/public/excalidraw-assets/**', '**/public/sandbox/pyodide/**'],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        // Socket.IO needs its own entry: the handshake starts as HTTP polling
        // and then upgrades, so it is not covered by the /api rule above.
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      }
    },

    build: {
      // Don't expose source maps in production — keeps internals private
      sourcemap: false,

      // Warn when a chunk exceeds 500 kB
      chunkSizeWarningLimit: 500,

      // No manualChunks: every route and every WebGL backdrop is behind a
      // dynamic import, so the bundler derives the split from the real import
      // graph. Hand-written vendor buckets used to mis-file React's CJS build
      // into the recharts chunk, which made the landing page download all of
      // recharts before it could render.
    },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      css: false,
    },
  }
})

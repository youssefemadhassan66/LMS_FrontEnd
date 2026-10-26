// Code sandbox worker — runs student Python (Pyodide) and JavaScript.
//
// Served as a static file so it keeps its own Content-Security-Policy (see
// vercel.json and nginx.conf): it needs 'unsafe-eval' / 'wasm-unsafe-eval',
// the app does not.
//
// The worker shares the site's origin, so before any user code runs every
// network and storage API is removed from its global scope. Otherwise code
// could POST to the API with the user's cookies and mint a fresh session.
//
// A worker runs one language for its whole life. Pyodide downloads its runtime
// with fetch(), which no longer exists once the scope is locked down, so a
// worker that has run JavaScript could never load Python afterwards. The main
// thread (src/utils/codeSandbox.js) keeps one worker per language.
//
// Protocol (main -> worker): { type: 'run', id, language, code, inputs: [stdin] }
// Protocol (worker -> main): { type: 'status', id, message }
//                            { type: 'test-start', id, index }
//                            { type: 'test-done', id, index, result: { stdout, stderr, durationMs } }
//                            { type: 'done', id }
//                            { type: 'error', id, message }  (the worker is unusable; terminate it)

const OUTPUT_LIMIT = 64 * 1024
const PYODIDE_URL = new URL('./pyodide/', self.location.href).href
const LANGUAGES = ['python', 'javascript']

let boundLanguage = null
let pyodidePromise = null
let pythonRunner = null
let locked = false

// ─── Lock down the global scope ──────────────────────────────────────────────

const BLOCKED_GLOBALS = [
  'fetch', 'fetchLater', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'WebTransport',
  'RTCPeerConnection', 'importScripts', 'Worker', 'SharedWorker', 'BroadcastChannel', 'indexedDB', 'caches',
  'cookieStore', 'Request', 'Response', 'navigator',
]

const lockDown = () => {
  if (locked) return
  locked = true
  // APIs live on the global object or on its prototype chain; remove them everywhere
  let scope = self
  while (scope && scope !== Object.prototype) {
    for (const name of BLOCKED_GLOBALS) {
      if (Object.prototype.hasOwnProperty.call(scope, name)) {
        try {
          delete scope[name]
        } catch { /* fall through to the overwrite below */ }
        if (Object.prototype.hasOwnProperty.call(scope, name)) {
          try {
            Object.defineProperty(scope, name, { value: undefined, configurable: false, writable: false })
          } catch { /* non-configurable; nothing more to do */ }
        }
      }
    }
    scope = Object.getPrototypeOf(scope)
  }
}

// ─── Shared output capture ───────────────────────────────────────────────────

class OutputLimitError extends Error {
  constructor() {
    super('Output limit exceeded (64 KB)')
    this.name = 'OutputLimitError'
  }
}

const createSink = () => {
  let text = ''
  return {
    write(chunk) {
      text += chunk
      if (text.length > OUTPUT_LIMIT) {
        text = text.slice(0, OUTPUT_LIMIT)
        throw new OutputLimitError()
      }
    },
    get value() {
      return text
    },
  }
}

// ─── JavaScript ──────────────────────────────────────────────────────────────

// Close to Node's util.inspect for the values students usually print
const inspect = (value, depth = 0, seen = new Set()) => {
  if (typeof value === 'string') return depth === 0 ? value : `'${value}'`
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'function') return `[Function: ${value.name || '(anonymous)'}]`
  if (typeof value === 'symbol') return value.toString()
  if (value === null || typeof value !== 'object') return Object.is(value, -0) ? '-0' : String(value)
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (seen.has(value)) return '[Circular]'
  if (depth > 2) return Array.isArray(value) ? '[Array]' : '[Object]'
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]'
      return `[ ${value.map((item) => inspect(item, depth + 1, seen)).join(', ')} ]`
    }
    if (value instanceof Map) {
      return `Map(${value.size}) { ${[...value].map(([k, v]) => `${inspect(k, depth + 1, seen)} => ${inspect(v, depth + 1, seen)}`).join(', ')} }`
    }
    if (value instanceof Set) {
      return `Set(${value.size}) { ${[...value].map((item) => inspect(item, depth + 1, seen)).join(', ')} }`
    }
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`)
    return `{ ${entries.map(([k, v]) => `${key(k)}: ${inspect(v, depth + 1, seen)}`).join(', ')} }`
  } finally {
    seen.delete(value)
  }
}

const formatArgs = (args) => args.map((arg) => inspect(arg)).join(' ')

class ExitSignal {
  constructor(code) {
    this.code = code
  }
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

// What the program sees as Node-style globals. They are parameters and the
// program body sits in its own block, so `const readline = require('readline')`
// or `const input = ...` shadow them instead of being a redeclaration error.
const PROGRAM_PARAMS = [
  'console', 'require', 'process', 'module', 'exports', 'global',
  'input', 'readline', 'prompt',
  'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'clearImmediate',
]

const wrapProgram = (code) => `"use strict";\n{\n${code}\n}`

// Line numbers inside a compiled function, as V8 and Firefox print them
const STACK_LINE = /(?:<anonymous>|> (?:Async)?Function):(\d+):\d+/

const stackLine = (error) => {
  const match = typeof error?.stack === 'string' ? STACK_LINE.exec(error.stack) : null
  return match ? Number(match[1]) : null
}

// How many lines the engine's function header and wrapProgram() add before the
// program's line 1. Measured once, because engines count the header differently.
let lineOffset
const measureLineOffset = async () => {
  if (lineOffset !== undefined) return
  lineOffset = null
  try {
    await new AsyncFunction(...PROGRAM_PARAMS, wrapProgram('throw new Error()'))()
  } catch (error) {
    const line = stackLine(error)
    if (line !== null) lineOffset = line - 1
  }
}

const programLine = (error) => {
  const line = stackLine(error)
  return line !== null && lineOffset !== null && line > lineOffset ? line - lineOffset : null
}

const runJavaScript = async (code, stdin) => {
  await measureLineOffset()

  const stdout = createSink()
  const stderr = createSink()
  const lines = stdin.length ? stdin.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n') : []
  let cursor = 0
  const nextLine = () => (cursor < lines.length ? lines[cursor++] : null)

  // ── Failure and the event loop ──
  // Node keeps a program alive while it has timers pending and stops it at the
  // first uncaught error; the program's callbacks are wrapped to do the same.
  let failure = null
  let idleCheck = null
  const timers = new Map()

  const clearTimers = () => {
    for (const [handle, clear] of timers) clear(handle)
    timers.clear()
  }

  const fail = (error) => {
    if (!failure) failure = error ?? new Error('Unknown error')
    clearTimers()
    idleCheck?.()
  }

  const callGuarded = (fn, args) => {
    if (typeof fn !== 'function' || failure) return
    try {
      const result = fn(...args)
      if (result && typeof result.then === 'function') result.then(undefined, fail)
    } catch (error) {
      fail(error)
    }
  }

  const sandboxSetTimeout = (fn, ms, ...args) => {
    const handle = setTimeout(() => {
      callGuarded(fn, args)
      timers.delete(handle)
      idleCheck?.()
    }, ms)
    timers.set(handle, clearTimeout)
    return handle
  }

  const sandboxSetInterval = (fn, ms, ...args) => {
    const handle = setInterval(() => callGuarded(fn, args), ms)
    timers.set(handle, clearInterval)
    return handle
  }

  const sandboxClearTimer = (handle) => {
    const clear = timers.get(handle)
    if (!clear) return
    clear(handle)
    timers.delete(handle)
    idleCheck?.()
  }

  // Resolves once nothing is left to run. The check sits behind a macrotask so
  // a callback that schedules more work from a promise gets to register it.
  const whenIdle = () => new Promise((resolve) => {
    idleCheck = () => setTimeout(() => {
      if (failure || timers.size === 0) resolve()
    }, 0)
    idleCheck()
  })

  const onUnhandledRejection = (event) => {
    event.preventDefault()
    fail(event.reason)
  }

  // ── Node-style I/O ──
  const fakeConsole = {
    log: (...args) => stdout.write(`${formatArgs(args)}\n`),
    info: (...args) => stdout.write(`${formatArgs(args)}\n`),
    debug: (...args) => stdout.write(`${formatArgs(args)}\n`),
    error: (...args) => stderr.write(`${formatArgs(args)}\n`),
    warn: (...args) => stderr.write(`${formatArgs(args)}\n`),
    table: (value) => stdout.write(`${inspect(value)}\n`),
  }

  // Minimal readline: lines are delivered after the program's top level finishes
  const interfaces = []
  const createInterface = (options = {}) => {
    const handlers = { line: [], close: [] }
    let promptText = '> '
    const rl = {
      closed: false,
      on(event, handler) {
        if (handlers[event]) handlers[event].push(handler)
        return rl
      },
      question(query, callback) {
        if (options.output) stdout.write(String(query))
        const answer = nextLine() ?? ''
        if (typeof callback === 'function') {
          Promise.resolve().then(() => callGuarded(callback, [answer]))
          return undefined
        }
        return Promise.resolve(answer)
      },
      setPrompt(text) {
        promptText = String(text)
      },
      prompt() {
        if (options.output) stdout.write(promptText)
      },
      close() {
        rl.closed = true
      },
      async *[Symbol.asyncIterator]() {
        let line
        while (!rl.closed && (line = nextLine()) !== null) yield line
      },
      handlers,
    }
    rl.once = rl.on
    rl.addListener = rl.on
    interfaces.push(rl)
    return rl
  }
  const readline = { createInterface }

  const stdinListeners = { data: [], readable: [], end: [] }
  let stdinConsumed = false
  const processStdin = {
    fd: 0,
    isTTY: false,
    setEncoding: () => processStdin,
    resume: () => processStdin,
    pause: () => processStdin,
    on(event, handler) {
      stdinListeners[event]?.push(handler)
      return processStdin
    },
    read() {
      if (stdinConsumed || !stdin) return null
      stdinConsumed = true
      return stdin
    },
    async *[Symbol.asyncIterator]() {
      if (stdin) yield stdin
    },
  }
  processStdin.once = processStdin.on
  processStdin.addListener = processStdin.on

  const deliverInput = async () => {
    for (const rl of interfaces) {
      let line
      while (!failure && !rl.closed && (line = nextLine()) !== null) {
        for (const handler of rl.handlers.line) await handler(line)
      }
      rl.closed = true
      for (const handler of rl.handlers.close) await handler()
    }
    if (stdin && !failure) {
      for (const handler of stdinListeners.data) await handler(stdin)
    }
    for (const handler of stdinListeners.readable) await handler()
    for (const handler of stdinListeners.end) await handler()
  }

  const fs = {
    readFileSync(target) {
      if (target === 0 || target === '/dev/stdin') return stdin
      throw new Error(`ENOENT: no such file or directory, open '${target}'`)
    },
  }

  const require = (name) => {
    const bare = String(name).replace(/^node:/, '')
    if (bare === 'readline' || bare === 'readline/promises') return readline
    if (bare === 'fs') return fs
    throw new Error(`Cannot find module '${name}' (the sandbox only provides 'fs' and 'readline' for reading input)`)
  }

  const process = {
    argv: ['node', 'main.js'],
    env: {},
    platform: 'sandbox',
    stdin: processStdin,
    stdout: { write: (chunk) => { stdout.write(String(chunk)); return true } },
    stderr: { write: (chunk) => { stderr.write(String(chunk)); return true } },
    exit: (exitCode = 0) => { throw new ExitSignal(exitCode) },
  }

  const input = () => nextLine()
  const programModule = { exports: {} }

  self.addEventListener('unhandledrejection', onUnhandledRejection)
  try {
    const program = new AsyncFunction(...PROGRAM_PARAMS, wrapProgram(code))
    await program(
      fakeConsole, require, process, programModule, programModule.exports, self,
      input, input, input,
      sandboxSetTimeout, sandboxSetInterval, (fn, ...args) => sandboxSetTimeout(fn, 0, ...args),
      sandboxClearTimer, sandboxClearTimer, sandboxClearTimer,
    )
    await deliverInput()
    await whenIdle()
  } catch (error) {
    fail(error)
  } finally {
    self.removeEventListener('unhandledrejection', onUnhandledRejection)
    clearTimers()
  }

  if (failure) {
    try {
      if (failure instanceof ExitSignal) {
        if (failure.code) stderr.write(`Process exited with code ${failure.code}\n`)
      } else if (failure instanceof OutputLimitError) {
        stderr.write(`${failure.message}\n`)
      } else if (typeof failure === 'object' && 'message' in failure) {
        const line = programLine(failure)
        stderr.write(`${failure.name || 'Error'}: ${failure.message}${line ? ` (line ${line})` : ''}\n`)
      } else {
        stderr.write(`Uncaught ${inspect(failure, 1)}\n`)
      }
    } catch { /* stderr full */ }
  }

  return { stdout: stdout.value, stderr: stderr.value }
}

// ─── Python ──────────────────────────────────────────────────────────────────

const PYTHON_DRIVER = `
import io, sys, traceback

class _CappedWriter(io.TextIOBase):
    def __init__(self, limit):
        self._parts = []
        self._size = 0
        self._limit = limit
    def writable(self):
        return True
    def write(self, text):
        self._size += len(text)
        if self._size > self._limit:
            raise RuntimeError("Output limit exceeded (64 KB)")
        self._parts.append(text)
        return len(text)
    def getvalue(self):
        return "".join(self._parts)

def _run_user_code(code, stdin_text, limit):
    out, err = _CappedWriter(limit), _CappedWriter(limit)
    saved = sys.stdin, sys.stdout, sys.stderr
    sys.stdin, sys.stdout, sys.stderr = io.StringIO(stdin_text), out, err
    try:
        exec(compile(code, "main.py", "exec"), {"__name__": "__main__"})
    except SystemExit as exit_:
        if exit_.code not in (None, 0):
            err.write(f"Process exited with code {exit_.code}\\n")
    except BaseException as error:
        report = traceback.TracebackException.from_exception(error)
        report.stack = traceback.StackSummary.from_list([frame for frame in report.stack if frame.filename == "main.py"])
        try:
            err.write("".join(report.format()))
        except RuntimeError:
            pass
    finally:
        sys.stdin, sys.stdout, sys.stderr = saved
    return out.getvalue(), err.getvalue()
`

const loadPython = (id) => {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      self.postMessage({ type: 'status', id, message: 'Loading Python… (the first run downloads the interpreter)' })
      const { loadPyodide } = await import(`${PYODIDE_URL}pyodide.mjs`)
      const pyodide = await loadPyodide({ indexURL: PYODIDE_URL, stdout: () => {}, stderr: () => {} })
      pyodide.runPython(PYTHON_DRIVER)
      pythonRunner = pyodide.globals.get('_run_user_code')
      return pyodide
    })()
  }
  return pyodidePromise
}

const runPython = (code, stdin) => {
  const result = pythonRunner(code, stdin, OUTPUT_LIMIT)
  try {
    const [stdout, stderr] = result.toJs()
    return { stdout, stderr }
  } finally {
    result.destroy()
  }
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

self.onmessage = async ({ data }) => {
  if (!data || data.type !== 'run') return
  const { id, language, code, inputs } = data

  if (!LANGUAGES.includes(language)) {
    self.postMessage({ type: 'error', id, message: `Unsupported language: ${language}` })
    return
  }
  if (boundLanguage && boundLanguage !== language) {
    self.postMessage({ type: 'error', id, message: `This sandbox worker only runs ${boundLanguage}` })
    return
  }
  boundLanguage = language

  try {
    if (language === 'python') await loadPython(id)
  } catch (error) {
    self.postMessage({ type: 'error', id, message: `Python failed to load: ${error?.message || error}` })
    return
  }

  // Runtime is loaded; nothing after this point may reach the network
  lockDown()
  self.postMessage({ type: 'status', id, message: '' })

  for (let index = 0; index < inputs.length; index++) {
    self.postMessage({ type: 'test-start', id, index })
    const startedAt = performance.now()
    let result
    try {
      result = language === 'python' ? runPython(String(code), String(inputs[index] ?? '')) : await runJavaScript(String(code), String(inputs[index] ?? ''))
    } catch (error) {
      // Only the runtime itself throws here (user errors are caught above),
      // e.g. a WebAssembly stack overflow that leaves Pyodide unusable
      self.postMessage({ type: 'error', id, message: `The sandbox crashed: ${error?.message || error}` })
      return
    }
    self.postMessage({
      type: 'test-done',
      id,
      index,
      result: { stdout: String(result.stdout), stderr: String(result.stderr), durationMs: Math.round(performance.now() - startedAt) },
    })
  }

  self.postMessage({ type: 'done', id })
}

// Runs commands through the user's login shell, so PATH matches their terminal (pnpm, brew, nvm),
// even when the engine is started by the desktop app instead of a terminal.
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const SHELL = process.env.SHELL || '/bin/zsh'

export function sh(cmd: string, cwd: string, timeoutMs = 120_000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(SHELL, ['-lc', cmd], { cwd, env: process.env })
    let out = ''
    const add = (b: Buffer) => { out = (out + b.toString()).slice(-20_000) }
    child.stdout.on('data', add)
    child.stderr.on('data', add)
    const t = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.on('close', (code) => { clearTimeout(t); resolve({ code: code ?? 1, out }) })
    child.on('error', (e) => { clearTimeout(t); resolve({ code: 1, out: String(e) }) })
  })
}

// Long-running command in its own process group, so stopping it also stops the dev server it starts.
export function start(cmd: string, cwd: string, env: Record<string, string>): ChildProcess {
  return spawn(SHELL, ['-lc', cmd], { cwd, env: { ...process.env, ...env }, detached: true })
}
// Dev servers often outlive SIGTERM (pnpm, workerd), so the whole group gets SIGKILL if anything is left.
export function stopGroup(child: ChildProcess) {
  if (!child.pid) return
  const pid = child.pid
  try { process.kill(-pid, 'SIGTERM') } catch { return }
  setTimeout(() => { try { process.kill(-pid, 'SIGKILL') } catch {} }, 3000)
}

export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')

export type Repo = { path: string; url?: string; login?: { user: string; pass: string }; lastSha?: string; readAt?: number; port?: number; dataReady?: boolean; appPaths?: string[]; flows?: { title: string; ok: boolean; note?: string }[] }
export type Config = { base?: string; key?: string; repos: Record<string, Repo> }

const DIR = join(homedir(), '.post-maker')
const FILE = join(DIR, 'engine.json')

// One Chrome profile per product, so a sign-in and the data behind it survive between reads.
export const profileDir = (productId: string) => join(DIR, 'profiles', productId)

export function loadConfig(): Config {
  try { return JSON.parse(readFileSync(FILE, 'utf8')) } catch { return { repos: {} } }
}
export function saveConfig(c: Config) {
  mkdirSync(DIR, { recursive: true, mode: 0o700 })
  writeFileSync(FILE, JSON.stringify(c, null, 2), { mode: 0o600 })
}

const CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
]
export const chromePath = () => CHROMES.find(p => existsSync(p)) ?? null

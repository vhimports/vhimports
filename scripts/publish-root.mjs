import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const dist = resolve(projectRoot, 'dist')
const rootAssets = resolve(projectRoot, 'assets')

await cp(resolve(dist, 'index.html'), resolve(projectRoot, 'index.html'))
await cp(resolve(dist, 'painel.html'), resolve(projectRoot, 'painel.html'))
await mkdir(rootAssets, { recursive: true })
await cp(resolve(dist, 'assets'), rootAssets, { recursive: true, force: true })


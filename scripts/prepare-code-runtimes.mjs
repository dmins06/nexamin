// Trusted build-time downloads only. Student code never reaches this process.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const dest = `${root}public/runtimes/code/`
const assets = [
  'python-3.11.3.wasm',
  'python-3.11.3.tar.gz',
  'wasmedge_quickjs.wasm',
  'clang.wasm',
  'clang-fs.tar.gz',
  'wasm-ld.wasm',
].map((name) => ({ name, url: `https://runno.dev/langs/${name}` }))
assets.push(
  {
    name: 'java_home.tar.gz',
    url: 'https://github.com/plasma-umass/doppio_jcl/releases/download/v3.2/java_home.tar.gz',
  },
  {
    name: 'doppio.tgz',
    url: 'https://registry.npmjs.org/doppiojvm/-/doppiojvm-0.5.0.tgz',
  },
  {
    name: 'browserfs.tgz',
    url: 'https://registry.npmjs.org/browserfs/-/browserfs-1.4.3.tgz',
  },
)
const licenses = {
  'PYTHON-LICENSE.txt':'https://raw.githubusercontent.com/python/cpython/v3.11.3/LICENSE',
  'LLVM-LICENSE.txt':'https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-8.0.1/llvm/LICENSE.TXT',
  'LIBCXX-LICENSE.txt':'https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-8.0.1/libcxx/LICENSE.TXT',
  'QUICKJS-LICENSE.txt':'https://raw.githubusercontent.com/bellard/quickjs/master/LICENSE',
  'WASMEDGE-QUICKJS-LICENSE.txt':'https://raw.githubusercontent.com/second-state/wasmedge-quickjs/main/LICENSE',
  'OPENJDK-LICENSE.txt':'https://raw.githubusercontent.com/openjdk/jdk8u/master/LICENSE',
  'VMWARE-LICENSE.txt':'https://raw.githubusercontent.com/vmware-labs/webassembly-language-runtimes/main/LICENSE',
}
assets.push(...Object.entries(licenses).map(([name,url])=>({name,url})))
const lockPath = `${root}scripts/code-runtime-lock.json`,
  recording = process.argv.includes('--record-lock')
const lock = recording ? {} : JSON.parse(await readFile(lockPath, 'utf8'))
await mkdir(dest, { recursive: true })
await writeFile(
  dest + 'fflate.js',
  await readFile(`${root}node_modules/fflate/umd/index.js`),
)
await writeFile(dest+'FFLATE-LICENSE',await readFile(`${root}node_modules/fflate/LICENSE`))
await writeFile(dest+'RUNNO-LICENSE',await readFile(`${root}node_modules/@runno/wasi/LICENSE`))
await writeFile(dest+'SOURCES.md',await readFile(`${root}docs/code-runtime-notices.md`))
function extract(tgz, name) {
  const tar = gunzipSync(tgz)
  for (let off = 0; off + 512 <= tar.length; ) {
    const path = tar
        .subarray(off, off + 100)
        .toString()
        .replace(/\0.*$/s, ''),
      size = parseInt(
        tar
          .subarray(off + 124, off + 136)
          .toString()
          .replace(/\0.*$/s, '')
          .trim() || '0',
        8,
      )
    if (path === name) return tar.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
  }
  throw Error(`Missing archive member: ${name}`)
}
await Promise.all(
  assets.map(async ({ name, url }) => {
    let data
    try {
      data = await readFile(dest + name)
    } catch {
      data = execFileSync(
        'curl',
        [
          '--fail',
          '--location',
          '--retry',
          '2',
          '--max-time',
          '180',
          '--silent',
          '--show-error',
          url,
        ],
        { maxBuffer: 150 * 1024 * 1024 },
      )
    }
    const hash = createHash('sha256').update(data).digest('hex')
    if (!recording && lock[name]?.sha256 !== hash)
      throw Error(`Runtime integrity mismatch: ${name}`)
    if (recording) lock[name] = { url, sha256: hash, bytes: data.length }
    await writeFile(dest + name, data)
    // .gz is treated as Content-Encoding by Vite's static server. Preserve bytes.
    if (name.endsWith('.gz')) await writeFile(dest + name + '.bin', data)
    if (name === 'doppio.tgz') {
      await writeFile(
        dest + 'doppio.js',
        extract(data, 'package/dist/release/doppio.js'),
      )
      await writeFile(
        dest + 'doppio.jar',
        extract(data, 'package/dist/doppio.jar'),
      )
      await writeFile(dest + 'DOPPIO-LICENSE', extract(data, 'package/LICENSE'))
    }
    if (name === 'browserfs.tgz') {
      await writeFile(
        dest + 'browserfs.js',
        extract(data, 'package/dist/browserfs.min.js'),
      )
      await writeFile(
        dest + 'BROWSERFS-LICENSE',
        extract(data, 'package/LICENSE'),
      )
    }
    if(name==='java_home.tar.gz')for(const path of ['ASSEMBLY_EXCEPTION','THIRD_PARTY_README'])await writeFile(dest+path,extract(data,'java_home/'+path))
    console.log(
      `Verified ${name} (${Math.round(data.length / 1024 / 1024)} MiB)`,
    )
  }),
)
if (recording) await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n')

import { describe, it, expect, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { parseNetwork, packetTrace, maskValue } from './network/networkEngine'
import { mlTrace, parsePoints, type MLConfig } from './ai/mlEngine'
import {
  decryptDemo,
  encryptDemo,
  digestDemo,
  deriveDemo,
  demoAuthorization,
  secureQueryDemo,
} from './security/securityEngine'
describe('network model', () => {
  const hosts =
    'PC1 pc 192.168.1.2 255.255.255.0 -\nSW1 switch - - -\nSRV1 server 192.168.1.3 255.255.255.0 -'
  it('moves a local packet only through valid layer2 links', () => {
    const n = parseNetwork(hosts, 'PC1 SW1\nSW1 SRV1')
    expect(
      packetTrace(n.devices, n.links, 'PC1', 'SRV1').at(-1)?.route,
    ).toEqual(['PC1', 'SW1', 'SRV1'])
    expect(packetTrace(n.devices, [], 'PC1', 'SRV1')[0]?.failure).toContain(
      'Unreachable',
    )
  })
  it('identifies duplicate IP/missing gateway/wrong masks', () => {
    const n = parseNetwork(
      hosts.replace('192.168.1.3', '192.168.1.2'),
      'PC1 SW1\nSW1 SRV1',
    )
    expect(
      packetTrace(n.devices, n.links, 'PC1', 'SRV1')[0]?.failure,
    ).toContain('Duplicate')
    const outside = parseNetwork(
      hosts.replace('192.168.1.3', '192.168.2.3'),
      'PC1 SW1\nSW1 SRV1',
    )
    expect(
      packetTrace(outside.devices, outside.links, 'PC1', 'SRV1')[0]?.failure,
    ).toContain('Missing')
    expect(() => maskValue('255.0.255.0')).toThrow()
    expect(() => parseNetwork(hosts, 'PC1 NOPE')).toThrow()
  })
  it('routes directly connected subnets via two real router interfaces', () => {
    const n = parseNetwork(
      'A pc 10.0.1.2 255.255.255.0 10.0.1.1\nR router 10.0.1.1 255.255.255.0 - 10.0.2.1 255.255.255.0\nB server 10.0.2.2 255.255.255.0 10.0.2.1',
      'A R\nR B',
    )
    expect(packetTrace(n.devices, n.links, 'A', 'B').at(-1)?.route).toEqual([
      'A',
      'R',
      'B',
    ])
    expect(packetTrace(n.devices, n.links, 'B', 'A').at(-1)?.failure).toBeNull()
  })
})
describe('measurable local ML', () => {
  const config: MLConfig = {
    model: 'linear-regression',
    points: parsePoints('-4 -3 0\n-3 -2 0\n-2 -1 0\n2 3 1\n3 4 1\n4 5 1'),
    iterations: 100,
    learningRate: 0.2,
    k: 2,
    queryX: 3,
    queryY: 4,
    layers: 1,
    neurons: 4,
    activation: 'tanh',
  }
  it('reduces actual regression MSE with gradient descent', () => {
    const f = mlTrace(config)
    expect(f.at(-1)?.loss ?? 999).toBeLessThan((f[0]?.loss ?? 0) / 5)
    expect(f[0]?.parameters).toEqual([0, 0])
    expect(f.at(-1)?.query ?? 0).toBeCloseTo(4, 0)
  })
  it('reduces KMeans inertia and keeps independent centroid snapshots', () => {
    const f = mlTrace({ ...config, model: 'kmeans' })
    expect(f.at(-1)?.loss ?? 999).toBeLessThanOrEqual(f[0]?.loss ?? 0)
    expect(f[0]?.centroids).not.toBe(f.at(-1)?.centroids)
    expect(f.at(-1)?.centroids).toHaveLength(2)
  })
  it('KNN uses nearest labels, ties are deterministic; tree learns splits', () => {
    expect(mlTrace({ ...config, model: 'knn', k: 3 }).at(-1)?.query).toBe(1)
    const tree = mlTrace({ ...config, model: 'decision-tree' }).at(-1)
    expect(tree?.query).toBe(1)
    expect(tree?.loss).toBe(0)
    expect(tree?.tree.length).toBeGreaterThan(1)
  })
  it.each(['sigmoid', 'tanh', 'relu'] as const)(
    'trains dense MLP with %s and finite loss',
    (activation) => {
      const f = mlTrace({
        ...config,
        model: 'neural-network',
        activation,
        layers: 2,
        neurons: 4,
      })
      expect(f.at(-1)?.loss ?? 999).toBeLessThan(f[0]?.loss ?? 0)
      expect(f.at(-1)?.parameters.every(Number.isFinite)).toBe(true)
      expect(f.at(-1)?.query ?? -1).toBeGreaterThanOrEqual(0)
    },
  )
  it('rejects bad labels, dimensions and resource counts', () => {
    expect(() => parsePoints('0 0 2\n1 1 0')).toThrow()
    expect(() => mlTrace({ ...config, iterations: 999999 })).toThrow()
    expect(() => mlTrace({ ...config, model: 'kmeans', k: 5 })).toThrow()
  })
})
describe('sandbox teaching cryptography and policy', () => {
  it('computes known SHA256 and rejects oversized input', async () => {
    vi.stubGlobal('crypto', webcrypto)
    try {
      expect(await digestDemo('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      )
      await expect(digestDemo('x'.repeat(1025))).rejects.toThrow()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('derives reproducible PBKDF2 with salt and authenticates AES-GCM', async () => {
    vi.stubGlobal('crypto', webcrypto)
    try {
      const salt = new Uint8Array(16),
        a = await deriveDemo('demo-only', salt)
      expect(await deriveDemo('demo-only', salt)).toBe(a)
      salt[0] = 1
      expect(await deriveDemo('demo-only', salt)).not.toBe(a)
      const cipher = await encryptDemo('Dữ liệu mẫu')
      expect(await decryptDemo(cipher)).toBe('Dữ liệu mẫu')
      await expect(decryptDemo(cipher, true)).rejects.toThrow()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('denies password viewing even for admin and separates SQL data from source', () => {
    expect(demoAuthorization('admin', false, 'password')).toBe(false)
    expect(demoAuthorization('student', false, 'read')).toBe(false)
    expect(demoAuthorization('admin', false, 'reset')).toBe(true)
    const demo = secureQueryDemo("' OR 1=1 --")
    expect(demo.parameterized).not.toContain('OR 1=1')
    expect(demo.bindings).toEqual(["' OR 1=1 --"])
  })
})

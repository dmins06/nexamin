import { describe, expect, it } from 'vitest'
import { resolveApiBase } from './apiBase'

describe('production API base', () => {
  it('uses same-origin API for Vercel when no URL is configured', () => {
    expect(resolveApiBase(undefined, true)).toBe('/api/v1')
  })

  it('never bundles a loopback URL into a production login request', () => {
    expect(resolveApiBase('http://localhost:8010/api/v1', true)).toBe('/api/v1')
    expect(resolveApiBase('http://127.0.0.1:8010/api/v1', true)).toBe('/api/v1')
  })

  it('respects an external API URL and strips its trailing slash', () => {
    expect(resolveApiBase('https://api.example.com/api/v1/', true)).toBe('https://api.example.com/api/v1')
  })
})

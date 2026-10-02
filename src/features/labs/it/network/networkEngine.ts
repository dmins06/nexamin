import type { NetworkDevice, NetworkLink } from './networkTypes'
export function ipv4(text: string): number {
  const parts = text.split('.')
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)
  )
    throw Error(`IPv4 không hợp lệ: ${text.slice(0, 30)}.`)
  return parts.reduce((n, p) => (n * 256 + Number(p)) >>> 0, 0)
}
export function maskValue(mask: string): number {
  const n = ipv4(mask),
    inverse = ~n >>> 0
  if (n === 0 || inverse < 3 || (inverse & (inverse + 1)) !== 0)
    throw Error('Subnet mask cần liên tục, prefix 1–30.')
  return n
}
export function sameSubnet(ip: string, other: string, mask: string): boolean {
  const m = maskValue(mask)
  return (ipv4(ip) & m) === (ipv4(other) & m)
}
export function parseNetwork(
  deviceText: string,
  linkText: string,
): { devices: NetworkDevice[]; links: NetworkLink[] } {
  const lines = deviceText.trim().split('\n')
  if (!deviceText.trim() || lines.length > 10)
    throw Error(
      'Nhập 1–10 thiết bị: ID kind IP mask gateway; dùng - nếu trống.',
    )
  const ids = new Set<string>(),
    devices = lines.map((line, i): NetworkDevice => {
      const p = line.trim().split(/\s+/),
        id = p[0] ?? '',
        kind = p[1]
      if (
        (p.length !== 5 && !(kind === 'router' && p.length === 7)) ||
        !/^[A-Za-z][A-Za-z0-9]{0,7}$/.test(id) ||
        ids.has(id)
      )
        throw Error(
          `Dòng ${i + 1}: ID duy nhất và 4 thuộc tính; router có thể thêm IP/mask thứ hai.`,
        )
      if (
        kind !== 'pc' &&
        kind !== 'laptop' &&
        kind !== 'switch' &&
        kind !== 'router' &&
        kind !== 'server'
      )
        throw Error(`Dòng ${i + 1}: kind không hợp lệ.`)
      const ip = p[2] === '-' ? null : (p[2] ?? null),
        subnetMask = p[3] === '-' ? null : (p[3] ?? null),
        gateway = p[4] === '-' ? null : (p[4] ?? null)
      if (ip) ipv4(ip)
      if (subnetMask) maskValue(subnetMask)
      if (gateway) ipv4(gateway)
      if (kind !== 'switch' && (!ip || !subnetMask))
        throw Error(`Thiết bị ${id} cần IP và mask.`)
      if (ip && subnetMask) {
        const value = ipv4(ip),
          mask = maskValue(subnetMask),
          host = (value & ~mask) >>> 0
        if (host === 0 || host === ~mask >>> 0)
          throw Error(`${id}: địa chỉ network/broadcast không dành cho host.`)
      }
      const interfaces = ip && subnetMask ? [{ ip, mask: subnetMask }] : []
      if (p.length === 7) {
        const extraIP = p[5] ?? '',
          extraMask = p[6] ?? ''
        const mask = maskValue(extraMask),
          host = (ipv4(extraIP) & ~mask) >>> 0
        if (!host || host === ~mask >>> 0)
          throw Error('IP interface router cần là địa chỉ host.')
        interfaces.push({ ip: extraIP, mask: extraMask })
      }
      ids.add(id)
      return {
        id,
        kind,
        ip,
        subnetMask,
        gateway,
        x: 40 + (i % 3) * 120,
        y: 50 + Math.floor(i / 3) * 80,
        interfaces,
      }
    })
  const edges = new Set<string>(),
    links: NetworkLink[] = linkText.trim()
      ? linkText
          .trim()
          .split('\n')
          .map((line) => {
            const [from, to, ...rest] = line.trim().split(/\s+/)
            if (
              !from ||
              !to ||
              rest.length ||
              from === to ||
              !ids.has(from) ||
              !ids.has(to)
            )
              throw Error('Link cần hai ID thiết bị khác nhau, đã khai báo.')
            const key = [from, to].sort().join(':')
            if (edges.has(key)) throw Error('Link bị trùng.')
            edges.add(key)
            return { from, to }
          })
      : []
  if (links.length > 20) throw Error('Tối đa 20 link.')
  return { devices, links }
}
export interface PacketFrame {
  at: string | null
  route: string[]
  operation: string
  layer: string
  failure: string | null
}
export function packetTrace(
  devices: readonly NetworkDevice[],
  links: readonly NetworkLink[],
  sourceId: string,
  destinationId: string,
): PacketFrame[] {
  const source = devices.find((d) => d.id === sourceId),
    dest = devices.find((d) => d.id === destinationId),
    frames: PacketFrame[] = []
  const fail = (reason: string) => [
    {
      at: sourceId,
      route: [],
      operation: reason,
      layer: 'Network / IPv4',
      failure: reason,
    },
  ]
  if (
    !source?.ip ||
    !source.subnetMask ||
    !dest?.ip ||
    !dest.subnetMask ||
    source.kind === 'switch' ||
    dest.kind === 'switch'
  )
    return fail('Chọn nguồn và đích là host có IP/mask.')
  const seen = new Set<number>()
  for (const d of devices)
    for (const intf of d.interfaces ??
      (d.ip && d.subnetMask ? [{ ip: d.ip, mask: d.subnetMask }] : [])) {
      const ip = ipv4(intf.ip)
      if (seen.has(ip))
        return fail(`Duplicate IP: ${intf.ip}. Đổi địa chỉ để tránh xung đột.`)
      seen.add(ip)
    }
  const local =
    sameSubnet(source.ip, dest.ip, source.subnetMask) &&
    sameSubnet(dest.ip, source.ip, dest.subnetMask)
  let gateway: NetworkDevice | undefined
  if (!local) {
    if (!source.gateway)
      return fail(
        'Missing gateway: đích ngoài subnet, nguồn cần default gateway.',
      )
    gateway = devices.find(
      (d) =>
        d.kind === 'router' &&
        (d.interfaces ?? [{ ip: d.ip ?? '', mask: d.subnetMask ?? '' }]).some(
          (intf) => intf.ip === source.gateway,
        ),
    )
    if (!gateway) return fail('Gateway không phải router đã khai báo.')
    if (!sameSubnet(source.ip, source.gateway, source.subnetMask))
      return fail('Wrong subnet: default gateway không nằm trong subnet nguồn.')
    const sourcePort = gateway.interfaces?.find((p) => p.ip === source.gateway)
    if (sourcePort && !sameSubnet(sourcePort.ip, source.ip, sourcePort.mask))
      return fail('Wrong subnet: mask interface router không khớp mạng nguồn.')
    const destPort = gateway.interfaces?.find((p) => p.ip === dest.gateway)
    if (
      !destPort ||
      !sameSubnet(dest.ip, destPort.ip, dest.subnetMask) ||
      !sameSubnet(destPort.ip, dest.ip, destPort.mask)
    )
      return fail(
        'Đích cần gateway thuộc subnet đích trên cùng router. Mô hình chỉ route hai mạng trực tiếp, không có bảng route nhiều router.',
      )
  }
  const adjacency = new Map<string, string[]>()
  for (const l of links) {
    adjacency.set(l.from, [...(adjacency.get(l.from) ?? []), l.to])
    adjacency.set(l.to, [...(adjacency.get(l.to) ?? []), l.from])
  }
  const path = (start: string, end: string): string[] => {
    const queue: string[][] = [[start]],
      visited = new Set([start])
    while (queue.length) {
      const route = queue.shift() ?? [],
        current = route.at(-1)
      if (current === end) return route
      if (!current) continue
      const device = devices.find((d) => d.id === current)
      if (current !== start && device?.kind !== 'switch') continue
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue
        if (
          devices.find((d) => d.id === next)?.kind === 'router' &&
          next !== end
        )
          continue
        visited.add(next)
        queue.push([...route, next])
      }
    }
    return []
  }
  const route = local
    ? path(sourceId, destinationId)
    : (() => {
        const first = path(sourceId, gateway?.id ?? ''),
          second = path(gateway?.id ?? '', destinationId)
        return first.length && second.length
          ? [...first, ...second.slice(1)]
          : []
      })()
  if (!route.length)
    return fail(
      local
        ? 'Unreachable: không có đường Layer-2 qua các link/switch đã nối.'
        : 'Unreachable: nguồn hoặc đích chưa nối đến router gateway.',
    )
  frames.push(
    {
      at: sourceId,
      route: [sourceId],
      operation: 'Application: tạo payload bài học giả lập HTTP.',
      layer: 'Application / HTTP',
      failure: null,
    },
    {
      at: sourceId,
      route: [sourceId],
      operation:
        'Transport: đóng gói mô hình TCP (không thực hiện handshake thật).',
      layer: 'Transport / TCP',
      failure: null,
    },
    {
      at: sourceId,
      route: [sourceId],
      operation: `Network: ${source.ip} → ${dest.ip}; ${local ? 'đích cùng subnet' : 'chọn default gateway'}.`,
      layer: 'Network / IPv4',
      failure: null,
    },
  )
  for (const [i, id] of route.entries())
    frames.push({
      at: id,
      route: route.slice(0, i + 1),
      operation: `Data Link: gói mô phỏng tại ${id}; MAC minh họa ${devices.findIndex((d) => d.id === id) + 1}.`,
      layer: 'Data Link / Ethernet',
      failure: null,
    })
  frames.push({
    at: destinationId,
    route,
    operation: 'Đã đến đích trong mô hình; không có gói nào gửi tới mạng thật.',
    layer: 'Application / nhận payload',
    failure: null,
  })
  return frames
}

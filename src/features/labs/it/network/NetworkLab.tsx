import { useMemo } from 'react'
import { parseNetwork, packetTrace } from './networkEngine'
import type { PacketFrame } from './networkEngine'
import { useLabSettings } from '../shared/useLabSettings'
import { attempt } from '../shared/input'
import { usePlayback } from '../shared/usePlayback'
import { SimulationControls } from '../shared/SimulationControls'
import { LabIntro } from '../shared/LabIntro'
import { LabExplain } from '../shared/LabExplain'
const defaults = {
  devices:
    'PC1 pc 192.168.1.2 255.255.255.0 -\nSW1 switch - - -\nSRV1 server 192.168.1.3 255.255.255.0 -',
  links: 'PC1 SW1\nSW1 SRV1',
  source: 'PC1',
  destination: 'SRV1',
}
const empty: PacketFrame[] = []
export function NetworkLab() {
  const { settings: s, change } = useLabSettings('network', defaults),
    topology = useMemo(
      () => attempt(() => parseNetwork(s.devices ?? '', s.links ?? '')),
      [s.devices, s.links],
    ),
    hosts = topology.value?.devices.filter((d) => d.kind !== 'switch') ?? []
  const source = hosts.find((d) => d.id === s.source)?.id ?? hosts[0]?.id ?? '',
    destination =
      hosts.find((d) => d.id === s.destination)?.id ?? hosts.at(-1)?.id ?? ''
  const trace = useMemo(
      () =>
        attempt(() =>
          topology.value
            ? packetTrace(
                topology.value.devices,
                topology.value.links,
                source,
                destination,
              )
            : empty,
        ),
      [topology.value, source, destination],
    ),
    playback = usePlayback(trace.value ?? empty),
    f = playback.frame
  const n = topology.value
  return (
    <>
      <LabIntro
        title="Network Lab"
        description="Đặt thiết bị qua bảng cấu hình, nối link và bước qua packet giả lập từ nguồn đến đích."
        notice="Mô hình IPv4 giáo dục: switch Layer-2 và một router, tối đa hai mạng trực tiếp. Chưa có routing table nhiều router, ARP/TCP handshake đầy đủ; tuyệt đối không phát gói tin thật."
      />
      <div className="it-sim-grid">
        <section className="it-panel">
          <h2>Topology</h2>
          <label>
            Thiết bị: ID kind IP mask gateway
            <textarea
              rows={7}
              maxLength={2000}
              value={s.devices}
              onChange={(e) => change('devices', e.target.value)}
            />
          </label>
          <p className="it-small">
            kind: pc, laptop, switch, router, server. Switch dùng - - -. Router
            có thể thêm cặp IP/mask thứ hai ở cuối dòng.
          </p>
          <label>
            Link: ID đầu ID cuối
            <textarea
              rows={4}
              maxLength={1000}
              value={s.links}
              onChange={(e) => change('links', e.target.value)}
            />
          </label>
          <div className="it-controls">
            <button
              className="it-button"
              onClick={() => {
                change('devices', defaults.devices)
                change('links', defaults.links)
              }}
            >
              Mạng mẫu
            </button>
            <button
              className="it-button"
              onClick={() => {
                change(
                  'devices',
                  'PC1 pc 10.0.1.2 255.255.255.0 10.0.1.1\nR1 router 10.0.1.1 255.255.255.0 - 10.0.2.1 255.255.255.0\nSRV1 server 10.0.2.2 255.255.255.0 10.0.2.1',
                )
                change('links', 'PC1 R1\nR1 SRV1')
              }}
            >
              Hai subnet mẫu
            </button>
          </div>
          {topology.error && (
            <p role="alert" className="it-error">
              {topology.error}
            </p>
          )}
          <div className="it-algorithm-input">
            <label>
              Nguồn
              <select
                value={source}
                onChange={(e) => change('source', e.target.value)}
              >
                {hosts.map((d) => (
                  <option key={d.id}>{d.id}</option>
                ))}
              </select>
            </label>
            <label>
              Đích
              <select
                value={destination}
                onChange={(e) => change('destination', e.target.value)}
              >
                {hosts.map((d) => (
                  <option key={d.id}>{d.id}</option>
                ))}
              </select>
            </label>
          </div>
          <p>
            Thử đổi IP thành trùng nhau, bỏ gateway hoặc xóa link để quan sát
            giải thích lỗi.
          </p>
        </section>
        <section className="it-panel">
          <h2>Packet Visualizer</h2>
          {n && (
            <svg
              className="it-network"
              viewBox={`0 0 320 ${Math.max(160, Math.ceil(n.devices.length / 3) * 80 + 20)}`}
              role="img"
              aria-label={`Topology ${n.devices.length} thiết bị; packet tại ${f?.at ?? 'chưa có'}`}
            >
              {n.links.map((link, i) => {
                const a = n.devices.find((d) => d.id === link.from),
                  b = n.devices.find((d) => d.id === link.to)
                return a && b ? (
                  <line
                    key={i}
                    x1={a.x * 0.8}
                    y1={a.y}
                    x2={b.x * 0.8}
                    y2={b.y}
                  />
                ) : null
              })}
              {n.devices.map((d) => (
                <g key={d.id} className={f?.at === d.id ? 'active' : ''}>
                  <rect
                    x={d.x * 0.8 - 28}
                    y={d.y - 20}
                    width={56}
                    height={40}
                    rx={7}
                  />
                  <text x={d.x * 0.8} y={d.y + 4} textAnchor="middle">
                    {d.id}
                  </text>
                  <text
                    className="it-device-kind"
                    x={d.x * 0.8}
                    y={d.y + 34}
                    textAnchor="middle"
                  >
                    {d.kind}
                  </text>
                </g>
              ))}
            </svg>
          )}
          <p role="status" className={f?.failure ? 'it-error' : 'it-operation'}>
            {f?.operation ?? 'Sửa topology để tiếp tục.'}
          </p>
          <p>Layer: {f?.layer ?? '—'}</p>
          <p>Route: {f?.route.join(' → ') || 'chưa có'}</p>
          <p>
            Source IP: {n?.devices.find((d) => d.id === source)?.ip ?? '—'} ·
            Destination IP:{' '}
            {n?.devices.find((d) => d.id === destination)?.ip ?? '—'}
          </p>
          <SimulationControls {...playback} />
          <p>
            MAC hiển thị là ID minh họa, không phải địa chỉ phần cứng thật. Giới
            hạn mask /1–/30; mô hình không hỗ trợ /31 point-to-point hoặc IPv6.
          </p>
        </section>
      </div>
      <LabExplain
        title="Packet Inspector"
        context={f?.operation ?? 'Network Lab'}
      />
    </>
  )
}

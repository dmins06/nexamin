import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceApi } from '../../lib/workspaceApi'
import { PrivateAttachment } from './PrivateAttachment'

const attachment = {
  url: 'https://never-follow.invalid/synthetic.txt', name: 'Tài liệu thử nghiệm.txt', mime_type: 'text/plain',
}

describe('private attachment UI', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-private-file')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('downloads files only on request and revokes the local URL on unmount', async () => {
    const fetcher = vi.spyOn(workspaceApi, 'messageAttachment').mockResolvedValue(new Blob(['fixture']))
    const user = userEvent.setup()
    const view = render(<PrivateAttachment messageId="fixture" attachment={attachment} />)
    expect(fetcher).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Tải file/ }))
    const link = await screen.findByRole('link', { name: attachment.name })
    expect(link).toHaveAttribute('href', 'blob:synthetic-private-file')
    expect(link).toHaveAttribute('download', attachment.name)
    expect(fetcher.mock.calls[0]?.[0]).toBe('fixture')
    view.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-private-file')
    expect(fetcher.mock.calls[0]?.[1]?.aborted).toBe(true)
  })

  it('offers retry after a permission/network error, never the original public URL', async () => {
    vi.spyOn(workspaceApi, 'messageAttachment')
      .mockRejectedValueOnce(new Error('Không tải được file riêng tư.'))
      .mockResolvedValueOnce(new Blob(['fixture']))
    const user = userEvent.setup()
    render(<PrivateAttachment messageId="fixture" attachment={attachment} />)
    await user.click(screen.getByRole('button', { name: /Tải file/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('riêng tư')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại file' }))
    await screen.findByRole('link')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not publish a stale image result after switching messages', async () => {
    let resolveFirst: ((blob: Blob) => void) | undefined
    vi.spyOn(workspaceApi, 'messageAttachment')
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
      .mockResolvedValueOnce(new Blob(['current']))
    const image = { ...attachment, name: 'fixture.png', mime_type: 'image/png' }
    const view = render(<PrivateAttachment messageId="old" attachment={image} />)
    view.rerender(<PrivateAttachment messageId="new" attachment={image} />)
    await screen.findByRole('img')
    resolveFirst?.(new Blob(['stale']))
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('img')).not.toHaveAttribute('src', attachment.url)
  })
})

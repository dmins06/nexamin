import { useEffect, useState } from 'react'
import { type MessageAttachment, workspaceApi } from '../../lib/workspaceApi'

/** Fetches only by authenticated message ID, never follows a user-supplied URL. */
export function PrivateAttachment({ messageId, attachment }: {
  messageId: string
  attachment: MessageAttachment
}) {
  const [attempt, setAttempt] = useState(0)
  const [resource, setResource] = useState<{ messageId: string; url: string } | null>(null)
  const [error, setError] = useState('')
  const previewImage = attachment.mime_type.startsWith('image/')
  useEffect(() => {
    if (!previewImage && attempt === 0) return
    const controller = new AbortController()
    let objectUrl: string | null = null
    setResource(null)
    setError('')
    workspaceApi.messageAttachment(messageId, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setResource({ messageId, url: objectUrl })
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Không tải được file đính kèm.')
      }
    })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [messageId, attempt, previewImage])

  const url = resource?.messageId === messageId ? resource.url : null
  return <div className="message-attachment">
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Thử tải lại file</button></>
      : url ? <a href={url} download={attachment.name}>
        {previewImage ? <img src={url} alt={attachment.name} /> : <span>{attachment.name}</span>}
      </a> : !previewImage && attempt === 0
        ? <button type="button" onClick={() => setAttempt(1)}>Tải file {attachment.name}</button>
        : <span role="status">Đang tải file đính kèm…</span>}
  </div>
}

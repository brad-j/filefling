import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatestScreenshotInfo, SendProgress, SendStatus } from '../../../main/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DropZone({ status, progress }: { status: SendStatus; progress: SendProgress | null }) {
  const [isDragging, setIsDragging] = useState(false)
  const [latestScreenshot, setLatestScreenshot] = useState<LatestScreenshotInfo | null>(null)
  const dragCounter = useRef(0)

  const refresh = useCallback(async () => {
    setLatestScreenshot(await window.filefling.getLatestScreenshot())
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(refresh, 500)
      return () => clearTimeout(timer)
    }
  }, [status, refresh])

  const sendLatest = async () => {
    await window.filefling.sendFile(latestScreenshot
      ? { filePath: latestScreenshot.filePath, isScreenshot: true }
      : { isScreenshot: true })
  }

  const statusText = status === 'sending'
    ? `Sending ${progress?.filename || 'file'}…`
    : status === 'success'
      ? 'Sent — path copied'
      : status === 'error'
        ? progress?.error || 'Could not send file'
        : null

  return (
    <div
      className={`send-card ${isDragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        dragCounter.current += 1
        setIsDragging(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        dragCounter.current -= 1
        if (dragCounter.current === 0) setIsDragging(false)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={async (event) => {
        event.preventDefault()
        dragCounter.current = 0
        setIsDragging(false)
        const file = event.dataTransfer.files[0]
        if (!file) return
        const filePath = window.filefling.getPathForFile(file)
        if (filePath) await window.filefling.sendFile({ filePath, isScreenshot: false })
      }}
    >
      <div className="send-preview">
        {latestScreenshot?.dataUrl ? (
          <img src={latestScreenshot.dataUrl} alt="Latest screenshot" />
        ) : (
          <div className="empty-preview" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m7 15 3-3 2 2 2-2 3 3" />
            </svg>
          </div>
        )}
        <div className="send-file-copy">
          <span>Latest screenshot</span>
          <strong>{latestScreenshot?.filename || 'No screenshot found'}</strong>
          {latestScreenshot && <small>{formatBytes(latestScreenshot.size)}</small>}
        </div>
      </div>

      <button type="button" onClick={sendLatest} disabled={status === 'sending'} className="send-button">
        {status === 'sending' ? 'Sending…' : 'Send screenshot'}
        {status !== 'sending' && <span aria-hidden="true">↗</span>}
      </button>

      <div className="drop-hint">{isDragging ? 'Drop to send' : 'or drop any file here'}</div>
      {statusText && <p className={`send-status ${status}`}>{statusText}</p>}
    </div>
  )
}

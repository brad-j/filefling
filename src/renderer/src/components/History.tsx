import { useState } from 'react'
import type { HistoryItem } from '../../../main/types'

function formatTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function History({ items, onClear }: { items: HistoryItem[]; onClear: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  if (items.length === 0) return null

  const copy = async (item: HistoryItem) => {
    if (!item.remotePath) return
    await navigator.clipboard.writeText(item.clipboardText || item.remotePath)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1200)
  }

  return (
    <details className="history-compact">
      <summary>Recent <span>{items.length}</span></summary>
      <div className="history-list">
        {items.slice(0, 5).map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => copy(item)}
            disabled={!item.remotePath}
            title={item.remotePath ? 'Copy again' : item.error}
          >
            <i className={item.status} />
            <span>{item.filename}</span>
            <small>{copiedId === item.id ? 'Copied' : item.status === 'error' ? 'Failed' : formatTime(item.timestamp)}</small>
          </button>
        ))}
        <button
          type="button"
          className="clear-history"
          onClick={async () => {
            await window.filefling.clearHistory()
            onClear()
          }}
        >
          Clear recent
        </button>
      </div>
    </details>
  )
}

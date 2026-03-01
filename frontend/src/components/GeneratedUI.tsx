import { useEffect, useRef, useState } from 'react'
import { IFRAME_SHELL } from '@/lib/iframe-shell'
import * as api from '@/lib/api'
import type { VerifiedTask } from '@/types'

interface GeneratedUIProps {
  componentCode: string
  verifiedTasks: VerifiedTask[]
}

export function GeneratedUI({ componentCode, verifiedTasks }: GeneratedUIProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const shellWrittenRef = useRef(false)
  const [shellReady, setShellReady] = useState(false)
  const [iframeHeight, setIframeHeight] = useState(400)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Write the shell HTML into the iframe once on mount
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || shellWrittenRef.current) return
    shellWrittenRef.current = true

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document
    if (!doc) return

    doc.open()
    doc.write(IFRAME_SHELL)
    doc.close()
  }, [])

  // Listen for postMessage events from the iframe
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data
      if (!msg?.type) return

      switch (msg.type) {
        case 'SHELL_READY':
          setShellReady(true)
          break

        case 'RESIZE':
          if (typeof msg.height === 'number' && msg.height > 50) {
            setIframeHeight(msg.height + 40)
          }
          break

        case 'NAVIGATE':
          if (msg.url) window.open(msg.url, '_blank', 'noopener,noreferrer')
          break

        case 'ACTION':
          if (msg.name) handleAction(msg.name)
          break
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedTasks])

  // When shell is ready, send the component + initial sample data
  useEffect(() => {
    if (!shellReady || !componentCode) return

    const initialData = buildDataMap(verifiedTasks, (t) => t.sample_output)
    postToIframe({ type: 'RENDER', code: componentCode, data: initialData })

    // Fetch fresh data in background
    fetchAllData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellReady, componentCode])

  function postToIframe(message: object) {
    iframeRef.current?.contentWindow?.postMessage(message, '*')
  }

  function buildDataMap(
    tasks: VerifiedTask[],
    getValue: (t: VerifiedTask) => unknown,
  ): Record<string, unknown> {
    return Object.fromEntries(
      tasks.filter((t) => t.type === 'data').map((t) => [t.id, getValue(t)]),
    )
  }

  async function fetchAllData() {
    setFetchError(null)
    const dataTasks = verifiedTasks.filter((t) => t.type === 'data')
    if (dataTasks.length === 0) return

    const results = await Promise.allSettled(dataTasks.map((t) => api.getData(t.id)))

    const freshData: Record<string, unknown> = {}
    for (let i = 0; i < dataTasks.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled' && result.value?.success) {
        freshData[dataTasks[i].id] = result.value.data
      } else if (result.status === 'rejected') {
        setFetchError(`Failed to fetch ${dataTasks[i].id}: ${result.reason?.message}`)
      }
    }

    if (Object.keys(freshData).length > 0) {
      postToIframe({ type: 'DATA_UPDATE', data: freshData })
    }
  }

  async function handleAction(instructionName: string) {
    try {
      const result = await api.executeAction(instructionName)
      if (result.success && result.data && Object.keys(result.data).length > 0) {
        postToIframe({ type: 'DATA_UPDATE', data: result.data })
      }
    } catch (err) {
      console.error('[GeneratedUI] Action failed:', err)
    }
  }

  return (
    <div className="w-full">
      <iframe
        ref={iframeRef}
        title="Generated dashboard"
        style={{ height: `${iframeHeight}px` }}
        className="w-full rounded-xl border border-border bg-white transition-all duration-200"
        sandbox="allow-scripts allow-same-origin"
      />
      {fetchError && (
        <p className="mt-2 text-xs text-destructive">{fetchError}</p>
      )}
    </div>
  )
}

/**
 * Remote Session Relay TUI command and indicator
 *
 * Provides /remote command to toggle remote connection relay,
 * and a RemoteIndicator component for the footer status bar.
 */

import { createMemo, createSignal, onMount, onCleanup, Show } from "solid-js"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { DialogAlert } from "@tui/ui/dialog-alert"

type UseSDK = any

/**
 * Register the /remote slash command
 * Call this from a component inside the TUI app
 *
 * @param useSDK - OpenCode's useSDK hook (passed from TUI context)
 */
export function registerRemoteCommand(useSDK: () => UseSDK) {
  const command = useCommandDialog()
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const toast = useToast()

  const kilo = createMemo(() => sync.data.provider_next.connected.includes("kilo"))

  command.register(() => [
    {
      value: "remote.toggle",
      title: "Toggle remote",
      description: "Enable or disable remote session relay",
      category: "Kilo",
      slash: { name: "remote" },
      enabled: kilo(),
      hidden: !kilo(),
      onSelect: async () => {
        try {
          const current = await sdk.client.remote.status()

          if (current.error || !current.data) {
            dialog.replace(() => <DialogAlert title="Error" message="Failed to fetch remote status." />)
            return
          }

          if (current.data.enabled) {
            await sdk.client.remote.disable()
            toast.show({ message: "Remote disabled", variant: "success" })
          } else {
            const result = await sdk.client.remote.enable()
            if (result.error) {
              dialog.replace(() => (
                <DialogAlert title="Not authorized" message="Run `kilo auth login` to enable remote." />
              ))
              return
            }
            toast.show({ message: "Remote enabled", variant: "success" })
          }

          dialog.clear()
        } catch (error) {
          dialog.replace(() => <DialogAlert title="Error" message={`Failed to toggle remote: ${error}`} />)
        }
      },
    },
  ])
}

/**
 * Footer indicator showing remote connection status.
 * Polls every 5 seconds. Only renders when kilo gateway is connected and remote is enabled.
 */
export function RemoteIndicator(props: { sdk: any; theme: any; kilo: boolean }) {
  const [status, setStatus] = createSignal<{
    enabled: boolean
    connected: boolean
  } | null>(null)

  onMount(() => {
    const poll = async () => {
      const res = await props.sdk.client.remote.status().catch(() => null)
      if (res?.data) setStatus(res.data)
    }
    poll()
    const timer = setInterval(poll, 5000)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <Show when={props.kilo && status()?.enabled}>
      <text fg={status()?.connected ? props.theme.success : props.theme.warning}>
        ◆ Remote{status()?.connected ? "" : " …"}
      </text>
    </Show>
  )
}

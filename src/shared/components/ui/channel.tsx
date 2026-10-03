import { Icon, type IconName } from './icon'
import { StatusChip } from './status-chip'

// Canales por los que escribe un cliente, dichos como los dice un dueño.
const CHANNELS: Record<string, { label: string; icon: IconName }> = {
  whatsapp: { label: 'WhatsApp', icon: 'whatsapp' },
  telegram: { label: 'Telegram', icon: 'send' },
  instagram: { label: 'Instagram', icon: 'instagram' },
  messenger: { label: 'Messenger', icon: 'messenger' },
  web: { label: 'Web', icon: 'globe' },
}

export function channelLabel(type: string | null | undefined): string {
  if (!type) return 'Sin canal'
  return CHANNELS[type]?.label ?? type
}

export function channelIcon(type: string | null | undefined): IconName {
  return (type && CHANNELS[type]?.icon) || 'chat'
}

/** Chip neutro con el icono y el nombre del canal. */
export function ChannelChip({ type }: { type: string | null | undefined }) {
  return (
    <StatusChip tone="neutral" icon={<Icon name={channelIcon(type)} className="h-3 w-3" strokeWidth={2.4} />}>
      {channelLabel(type)}
    </StatusChip>
  )
}

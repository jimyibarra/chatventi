// Estructura que devuelve la RPC get_agent_context (jsonb).
export type AgentContext = {
  org_id: string
  conversation: {
    id: string
    status: string
    ai_enabled: boolean
    ai_paused_until: string | null
    channel_type: 'whatsapp' | 'telegram' | 'web'
    channel_external_id: string
    client_id: string | null
    client_handle: string
    client_name: string | null
    should_respond: boolean
  }
  config: {
    enabled: boolean
    system_prompt: string | null
    model: string
    approval_mode: 'off' | 'low_confidence' | 'always'
    approval_chat_id: string | null
  } | null
  branch: { id: string; name: string; timezone: string } | null
  services: {
    id: string
    name: string
    duration_minutes: number
    price: number | null
    description: string | null
  }[]
  knowledge: string[]
  messages: {
    direction: 'inbound' | 'outbound'
    sender: 'contact' | 'agent' | 'ai' | 'system'
    body: string | null
    created_at: string
  }[]
}

// Callbacks de envío inyectados por cada webhook (canal-específicos).
export type AgentSenders = {
  // Envía texto al cliente por su canal. Devuelve el id externo del mensaje (o null).
  sendToCustomer: (text: string) => Promise<string | null>
  // Envía la propuesta a un chat de Telegram del negocio con botones Aprobar/Rechazar.
  sendApproval: (chatId: string, draft: string, approvalId: string) => Promise<void>
}

export type RunAgentResult =
  | { handled: false; reason: string }
  | { handled: true; mode: 'sent' | 'approval'; reply: string }

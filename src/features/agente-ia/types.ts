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
  // Citas futuras activas del cliente (max 5). El agente cancela/reagenda
  // SOLO por ids de esta lista (nunca ids inventados).
  upcoming_appointments: {
    id: string
    starts_at: string
    ends_at: string
    status: string
    services: string
  }[]
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
  // Envía texto + botones de opción rápida al cliente (WA reply buttons /
  // TG inline_keyboard). Máx 3 botones. Opcional: sin él se envía solo texto.
  sendButtons?: (
    text: string,
    buttons: { id: string; title: string }[]
  ) => Promise<string | null>
}

export type RunAgentResult =
  | { handled: false; reason: string }
  | { handled: true; mode: 'sent' | 'approval'; reply: string }

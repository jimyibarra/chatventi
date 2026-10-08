import { describe, expect, it, vi } from 'vitest'
import {
  DRAFT_ACCESS_UNAVAILABLE,
  DRAFT_PAGE_UNAVAILABLE,
  NOTE_ACCESS,
  NOTE_PAGE,
  SANDBOX_PHONE,
  buildPasenTools,
  mapAccessResponse,
  mapSampleResponse,
  samplePageInput,
  type Fetcher,
} from './pasen-tools'

const SALES_ORG = '17a720a3-8f4f-40e7-93e7-abd796c5b2f0'
const SECRET = 'psk_clave_secreta_de_prueba'
const env = {
  PASEN_SALES_ORG_ID: SALES_ORG,
  PASEN_SAMPLE_PAGE_URL: 'https://pasen.test/pagina-muestra',
  PASEN_PANEL_ACCESS_URL: 'https://pasen.test/acceso',
  PASEN_SAMPLE_PAGE_SECRET: SECRET,
}

type Call = { url: string; init: RequestInit }

/** PASEN falso: responde lo que se le diga y guarda lo que recibió. */
function fakePasen(status: number, json: unknown) {
  const calls: Call[] = []
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } })
  }
  return { calls, fetcher }
}

function build(opts: {
  orgId?: string
  sandbox?: boolean
  fetcher?: Fetcher
  notes?: number
  orgOk?: boolean
  envOverride?: Record<string, string | undefined>
  inbound?: string[]
}) {
  const unavailable: string[] = []
  const noted: string[] = []
  const tools = buildPasenTools({
    orgId: opts.orgId ?? SALES_ORG,
    conversationId: 'conv-1',
    clientHandle: '5215512345678',
    inboundTexts: ['hola, soy Luis', 'mi correo es Dueno@Negocio.mx', ...(opts.inbound ?? [])],
    sandbox: opts.sandbox ?? false,
    onUnavailable: (d) => unavailable.push(d),
    env: opts.envOverride ?? env,
    deps: {
      fetcher: opts.fetcher ?? fakePasen(200, { url: 'https://x.pasen.mx', trialUntilText: '22 de octubre', created: true }).fetcher,
      orgLimit: async () => opts.orgOk ?? true,
      countNotes: async () => opts.notes ?? 0,
      note: async (_c, body) => {
        noted.push(body)
      },
    },
  })
  return { tools, unavailable, noted }
}

const run = (t: unknown, input: unknown) =>
  (t as { execute: (i: unknown, o: unknown) => Promise<unknown> }).execute(input, { toolCallId: 't', messages: [] })

const sentBody = (c: Call) => JSON.parse(String(c.init.body)) as Record<string, unknown>

describe('las herramientas de ¡Pasen! existen solo para su organización', () => {
  it('otra organización no las tiene', () => {
    expect(build({ orgId: 'otra-org' }).tools).toBeNull()
  })
  it('sin variables de entorno no existen ni para la de ventas', () => {
    expect(build({ envOverride: {} }).tools).toBeNull()
    expect(build({ envOverride: { ...env, PASEN_SAMPLE_PAGE_SECRET: '' } }).tools).toBeNull()
  })
  it('la de ventas tiene exactamente las dos', () => {
    expect(Object.keys(build({}).tools ?? {}).sort()).toEqual(['create_sample_page', 'send_panel_access'])
  })
})

describe('el teléfono es siempre el de la conversación', () => {
  it('zod descarta un phone que mande el modelo', () => {
    const parsed = samplePageInput.parse({ businessName: 'Barbería Norte', businessType: 'barbería', phone: '5219999999999' })
    expect('phone' in parsed).toBe(false)
  })
  it('la llamada a PASEN lleva el wa_id de la conversación aunque el modelo pase otro', async () => {
    const pasen = fakePasen(200, { url: 'https://x.pasen.mx', trialUntilText: '22 de octubre', created: true })
    const { tools } = build({ fetcher: pasen.fetcher })
    await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería', phone: '5219999999999' })
    const body = sentBody(pasen.calls[0])
    expect(body.phone).toBe('5215512345678')
    expect(body.conversationId).toBe('conv-1')
    expect(body.test).toBe(false)
    expect(body.city).toBeNull()
    expect(pasen.calls[0].url).toBe(env.PASEN_SAMPLE_PAGE_URL)
  })
  it('en el chat de prueba manda test:true y el teléfono de prueba', async () => {
    const pasen = fakePasen(200, { url: 'https://ejemplo.pasen.mx', trialUntilText: '22 de octubre', test: true })
    const { tools, noted } = build({ fetcher: pasen.fetcher, sandbox: true })
    const out = await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })
    expect(sentBody(pasen.calls[0])).toMatchObject({ test: true, phone: SANDBOX_PHONE })
    expect(out).toEqual({ url: 'https://ejemplo.pasen.mx', trialUntilText: '22 de octubre' })
    expect(noted).toEqual([])
  })
})

describe('la clave va en el encabezado y nunca en lo que ve el modelo', () => {
  it('Authorization Bearer y resultado sin la clave', async () => {
    const pasen = fakePasen(200, { url: 'https://x.pasen.mx', trialUntilText: '22 de octubre', created: true })
    const { tools } = build({ fetcher: pasen.fetcher })
    const out = await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })
    expect((pasen.calls[0].init.headers as Record<string, string>).authorization).toBe(`Bearer ${SECRET}`)
    expect(JSON.stringify(out)).not.toContain(SECRET)
    expect(JSON.stringify(sentBody(pasen.calls[0]))).not.toContain(SECRET)
  })
  it('un fallo se registra solo con el código, sin la clave', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { tools } = build({ fetcher: fakePasen(401, { error: 'unauthorized' }).fetcher })
    await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })
    expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET)
    spy.mockRestore()
  })
})

describe('create_sample_page: respuestas de PASEN', () => {
  it('200 → url y fecha, y deja constancia en la conversación', async () => {
    const { tools, noted, unavailable } = build({})
    const out = await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })
    expect(out).toEqual({ url: 'https://x.pasen.mx', trialUntilText: '22 de octubre' })
    expect(noted[0]).toContain(NOTE_PAGE)
    expect(noted[0]).toContain('https://x.pasen.mx')
    expect(unavailable).toEqual([])
  })
  it('422 giro desconocido → error con opciones (sin escalar)', async () => {
    const options = ['Barbería y estética', 'Dentista']
    const { tools, unavailable } = build({ fetcher: fakePasen(422, { error: 'unknown_business_type', message: 'x', options }).fetcher })
    const out = await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'zapatería' })
    expect(out).toEqual({ error: 'unknown_business_type', options })
    expect(unavailable).toEqual([])
  })
  it.each([
    [401, { error: 'unauthorized' }],
    [422, { error: 'invalid_body' }],
    [429, { error: 'rate_limited' }],
    [503, { error: 'unavailable' }],
  ])('%s → no_disponible y escala a humano', async (status, json) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { tools, unavailable, noted } = build({ fetcher: fakePasen(status, json).fetcher })
    const out = await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })
    expect(out).toEqual({ error: 'no_disponible' })
    expect(unavailable).toEqual([DRAFT_PAGE_UNAVAILABLE])
    expect(noted).toEqual([])
    spy.mockRestore()
  })
  it('tiempo agotado o red caída → no_disponible y escala', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetcher: Fetcher = async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    }
    const { tools, unavailable } = build({ fetcher })
    expect(await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })).toEqual({ error: 'no_disponible' })
    expect(unavailable).toEqual([DRAFT_PAGE_UNAVAILABLE])
    spy.mockRestore()
  })
  it('segunda página en la misma conversación → limite, sin llamar a PASEN', async () => {
    const pasen = fakePasen(200, { url: 'https://x.pasen.mx', trialUntilText: '22 de octubre' })
    const { tools, unavailable } = build({ fetcher: pasen.fetcher, notes: 1 })
    expect(await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })).toEqual({ error: 'limite' })
    expect(pasen.calls).toHaveLength(0)
    expect(unavailable).toEqual([DRAFT_PAGE_UNAVAILABLE])
  })
  it('tope por hora de la organización → limite', async () => {
    const pasen = fakePasen(200, { url: 'https://x.pasen.mx', trialUntilText: '22 de octubre' })
    const { tools } = build({ fetcher: pasen.fetcher, orgOk: false })
    expect(await run(tools!.create_sample_page, { businessName: 'Barbería Norte', businessType: 'barbería' })).toEqual({ error: 'limite' })
    expect(pasen.calls).toHaveLength(0)
  })
})

describe('send_panel_access: el correo lo escribió el cliente', () => {
  it('un correo que el cliente NO escribió no se manda a PASEN', async () => {
    const pasen = fakePasen(200, { sent: true })
    const { tools, noted, unavailable } = build({ fetcher: pasen.fetcher })
    expect(await run(tools!.send_panel_access, { email: 'luis@example.com' })).toEqual({ error: 'correo_no_confirmado' })
    expect(pasen.calls).toHaveLength(0)
    expect(noted).toEqual([])
    expect(unavailable).toEqual([])
  })
  it('el correo escrito por el cliente pasa aunque cambie de mayúsculas', async () => {
    const pasen = fakePasen(200, { sent: true })
    const { tools } = build({ fetcher: pasen.fetcher })
    expect(await run(tools!.send_panel_access, { email: 'dueno@negocio.mx' })).toEqual({ resultado: 'enviado' })
  })
})

describe('send_panel_access: respuestas de PASEN', () => {
  it('sent:true → enviado, con constancia', async () => {
    const pasen = fakePasen(200, { sent: true })
    const { tools, noted } = build({ fetcher: pasen.fetcher })
    const out = await run(tools!.send_panel_access, { email: 'dueno@negocio.mx', phone: '5219999999999' })
    expect(out).toEqual({ resultado: 'enviado' })
    expect(sentBody(pasen.calls[0])).toEqual({ email: 'dueno@negocio.mx', phone: '5215512345678', conversationId: 'conv-1', test: false })
    expect(pasen.calls[0].url).toBe(env.PASEN_PANEL_ACCESS_URL)
    expect(noted[0]).toContain(NOTE_ACCESS)
  })
  it('sent:false team_review → lo_revisa_el_equipo', async () => {
    const { tools, noted } = build({ fetcher: fakePasen(200, { sent: false, reason: 'team_review' }).fetcher })
    expect(await run(tools!.send_panel_access, { email: 'dueno@negocio.mx' })).toEqual({ resultado: 'lo_revisa_el_equipo' })
    expect(noted[0]).toContain('revisa')
  })
  it('404 not_found → sin_pagina (sin escalar)', async () => {
    const { tools, unavailable } = build({ fetcher: fakePasen(404, { error: 'not_found' }).fetcher })
    expect(await run(tools!.send_panel_access, { email: 'dueno@negocio.mx' })).toEqual({ error: 'sin_pagina' })
    expect(unavailable).toEqual([])
  })
  it('503 → no_disponible y escala', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { tools, unavailable } = build({ fetcher: fakePasen(503, { error: 'unavailable' }).fetcher })
    expect(await run(tools!.send_panel_access, { email: 'dueno@negocio.mx' })).toEqual({ error: 'no_disponible' })
    expect(unavailable).toEqual([DRAFT_ACCESS_UNAVAILABLE])
    spy.mockRestore()
  })
  it('tercer pedido de acceso en la conversación → limite', async () => {
    const pasen = fakePasen(200, { sent: true })
    const { tools } = build({ fetcher: pasen.fetcher, notes: 2 })
    expect(await run(tools!.send_panel_access, { email: 'dueno@negocio.mx' })).toEqual({ error: 'limite' })
    expect(pasen.calls).toHaveLength(0)
  })
})

describe('mapeo puro de respuestas', () => {
  it('cuerpos raros caen en no_disponible', () => {
    expect(mapSampleResponse({ status: 200, json: null })).toEqual({ error: 'no_disponible' })
    expect(mapSampleResponse({ status: 0, json: null })).toEqual({ error: 'no_disponible' })
    expect(mapAccessResponse({ status: 200, json: { sent: false } })).toEqual({ error: 'no_disponible' })
  })
})

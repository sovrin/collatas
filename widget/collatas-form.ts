// <collatas-form app="sonotas"></collatas-form>
//
// The feedback form for a site registered in collatas. It fetches its rules (which kinds, which
// context, a form token) from the collatas it was loaded from, renders in the light DOM with
// aequitas markup so it looks native in the site, and sends there. The site passes what it wants
// to send along as a property: `form.context = { version: '0.2.0' }`. Only the context fields the
// app allows are shown and sent.
//
// Events: `collatas-sent` once a message went through.
import type { FormRules } from '../shared/contracts'

// The collatas this script came from: rules are fetched and feedback sent there.
const BASE = new URL(import.meta.url).origin

type Child = Node | string | false | null | undefined

/** A tiny element builder: attributes as given, children as nodes or text (never as HTML). */
function h(tag: string, attributes: Record<string, string | boolean> = {}, ...children: Child[]) {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes))
    if (value !== false) element.setAttribute(name, value === true ? '' : value)
  for (const child of children) if (child) element.append(child)
  return element
}

let instances = 0

class CollatasForm extends HTMLElement {
  private values: Record<string, string> = {}
  private rules: FormRules | null = null
  private started = false
  private readonly uid = `collatas-${++instances}`

  constructor() {
    super()
    // A page often sets .context before this module has loaded, on the plain element. That own
    // property would hide the accessor below, so take it over now.
    if (Object.hasOwn(this, 'context')) {
      const early = (this as unknown as { context: Record<string, string> }).context
      delete (this as unknown as { context?: unknown }).context
      this.context = early
    }
  }

  get context() {
    return this.values
  }

  /** What the site sends along; a change after the form is shown updates "Sent along". */
  set context(value: Record<string, string>) {
    this.values = value ?? {}
    if (this.querySelector('form')) this.renderForm(this.draft())
  }

  connectedCallback() {
    if (this.started) return
    this.started = true
    void this.load()
  }

  private async load() {
    this.show(h('p', { class: 'text-muted', role: 'status' }, 'Loading the form…'))
    try {
      const response = await fetch(`${BASE}/v1/apps/${encodeURIComponent(this.app)}/form`)
      if (!response.ok) throw new Error(await reason(response))
      this.rules = (await response.json()) as FormRules
      this.renderForm()
    } catch (error) {
      this.show(
        alert(
          'warning',
          'The feedback form is not available right now.',
          error instanceof Error ? error.message : '',
        ),
      )
    }
  }

  private get app() {
    return this.getAttribute('app') ?? ''
  }

  /** What has been typed so far, kept when the form is drawn again. */
  private draft() {
    const id = (name: string) => `${this.uid}-${name}`
    return {
      kind:
        (this.querySelector(`input[name="${id('kind')}"]:checked`) as HTMLInputElement | null)
          ?.value ?? '',
      message: (this.querySelector(`#${id('message')}`) as HTMLTextAreaElement | null)?.value ?? '',
      email: (this.querySelector(`#${id('email')}`) as HTMLInputElement | null)?.value ?? '',
    }
  }

  /** The context the app allows, cut to each field's length. */
  private allowedContext() {
    const allowed: Record<string, string> = {}
    for (const field of this.rules?.context ?? []) {
      const value = this.values[field.key]
      if (value != null && value !== '') allowed[field.key] = String(value).slice(0, field.max)
    }
    return allowed
  }

  private renderForm(draft = { kind: '', message: '', email: '' }) {
    const rules = this.rules!
    const id = (name: string) => `${this.uid}-${name}`
    const kinds = rules.kinds.map((kind, index) =>
      h(
        'label',
        {},
        h('input', {
          type: 'radio',
          name: id('kind'),
          value: kind.value,
          checked: draft.kind ? draft.kind === kind.value : index === 0,
        }),
        ` ${kind.label}`,
      ),
    )
    const message = h('textarea', {
      id: id('message'),
      class: 'input',
      required: true,
      maxlength: String(rules.maxMessage),
    }) as HTMLTextAreaElement
    message.value = draft.message
    const email = h('input', {
      id: id('email'),
      class: 'input',
      type: 'email',
      autocomplete: 'email',
      maxlength: '254',
      'aria-describedby': id('email-help'),
    }) as HTMLInputElement
    email.value = draft.email
    // People never see this field; a bot filling everything in does.
    const honeypot = h('input', {
      name: 'website',
      tabindex: '-1',
      autocomplete: 'off',
      'aria-hidden': 'true',
    }) as HTMLInputElement
    // What goes along, as shown: the page's address first when the app asks for it. It is read
    // again on sending, so it is the address at that moment.
    // shortcut: the list shows the address from when the form was drawn; redraw it on
    // navigation if a site changes its address while the form is open.
    const context = [
      ...(rules.sendPage ? [['page', location.href] as const] : []),
      ...Object.entries(this.allowedContext()),
    ]
    const send = h(
      'button',
      { type: 'submit', class: 'btn', 'data-size': 's', 'data-variant': 'primary' },
      'Send',
    )
    const status = h('div', { role: 'alert' })

    const form = h(
      'form',
      { class: 'stack gap-4' },
      // A div, not a fieldset: aequitas stacks a fieldset's options, these sit in one row.
      h(
        'div',
        { class: 'field' },
        h('label', { id: id('kind-label') }, 'What is it?'),
        h(
          'div',
          { class: 'cluster gap-4', role: 'radiogroup', 'aria-labelledby': id('kind-label') },
          ...kinds,
        ),
      ),
      h('div', { class: 'field' }, h('label', { for: id('message') }, 'Your message'), message),
      h(
        'div',
        { class: 'field' },
        h('label', { for: id('email') }, 'Email (optional)'),
        email,
        h('small', { id: id('email-help') }, 'Only if you would like an answer.'),
      ),
      h('div', { style: 'position:absolute;inset-inline-start:-10000px' }, honeypot),
      context.length > 0 &&
        h(
          'details',
          { class: 'accordion' },
          h('summary', { class: 'text-s' }, 'Sent along'),
          h(
            'dl',
            { class: 'properties' },
            ...context.flatMap(([key, value]) => [
              h('dt', { class: 'font-mono' }, key),
              h('dd', { class: 'font-mono break-words' }, value),
            ]),
          ),
        ),
      h(
        'p',
        { class: 'caption' },
        `Goes to the developer of ${rules.name}, with ${context.length ? 'the details under Sent along' : 'nothing else'}.`,
      ),
      status,
      send,
    )

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const kind =
        (form.querySelector(`input[name="${id('kind')}"]:checked`) as HTMLInputElement | null)
          ?.value ?? rules.kinds[0]!.value
      send.setAttribute('aria-busy', '')
      send.toggleAttribute('disabled', true)
      status.replaceChildren()
      try {
        const response = await fetch(`${BASE}/v1/apps/${encodeURIComponent(rules.app)}/feedback`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: rules.token,
            kind,
            message: message.value,
            email: email.value.trim(),
            context: this.allowedContext(),
            ...(rules.sendPage ? { page: location.href } : {}),
            website: honeypot.value,
          }),
        })
        if (!response.ok) throw new Error(await reason(response))
        this.show(
          h(
            'div',
            { class: 'alert', 'data-tone': 'success', role: 'status' },
            h('div', {}, h('strong', {}, 'Thank you.'), ' Your message was sent.'),
          ),
        )
        this.dispatchEvent(new CustomEvent('collatas-sent', { bubbles: true }))
      } catch (error) {
        const copy = h('button', { type: 'button', class: 'btn', 'data-size': 's' }, 'Copy message')
        copy.addEventListener('click', async () => {
          await navigator.clipboard.writeText(
            [message.value, ...context.map(([key, value]) => `${key}: ${value}`)].join('\n'),
          )
          copy.textContent = 'Copied'
        })
        status.replaceChildren(
          alert('danger', 'Could not send.', error instanceof Error ? error.message : '', copy),
        )
      } finally {
        send.removeAttribute('aria-busy')
        send.removeAttribute('disabled')
      }
    })
    this.show(form)
  }

  private show(content: Node) {
    this.replaceChildren(content)
  }
}

function alert(tone: string, title: string, detail: string, action?: Node) {
  return h(
    'div',
    { class: 'alert', 'data-tone': tone },
    h('div', {}, h('strong', {}, title), detail ? ` ${detail}` : ''),
    action,
  )
}

/** The server's own sentence for a refused request, or a plain fallback. */
async function reason(response: Response) {
  try {
    const body = (await response.json()) as { statusMessage?: string; message?: string }
    return body.statusMessage || body.message || `The server answered ${response.status}.`
  } catch {
    return `The server answered ${response.status}.`
  }
}

if (!customElements.get('collatas-form')) customElements.define('collatas-form', CollatasForm)

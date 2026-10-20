import type { AppConfig } from '../../shared/contracts'

// Split so a component's own <script> block is not closed by the string.
const SCRIPT_END = '</' + 'script>'

/** What a site puts in its page to show this app's form, loaded from `origin`. */
export function embedSnippet(app: AppConfig, origin: string) {
  const fields = app.context.map((field) => `${field.key}: '…'`).join(', ')
  return [
    `<script type="module" src="${origin}/v1/form.js">${SCRIPT_END}`,
    `<collatas-form app="${app.id}"></collatas-form>`,
    ...(fields
      ? [`<script>document.querySelector('collatas-form').context = { ${fields} }${SCRIPT_END}`]
      : []),
  ].join('\n')
}

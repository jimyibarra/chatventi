/* ChatVenti · Widget de reservas embebible
 * Uso:
 *   <script src="https://www.chatventi.com/widget.js" data-slug="mi-negocio" async></script>
 * Inserta un botón flotante que abre la página de reservas /r/<slug>?embed=1 en un modal.
 * Sin dependencias. Aislado por slug; cada sitio solo ve su propia página pública.
 */
(function () {
  'use strict'

  // Localiza el propio <script> (currentScript no existe si es async).
  var self =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script')
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1 && scripts[i].getAttribute('data-slug')) {
          return scripts[i]
        }
      }
      return null
    })()

  if (!self) return
  var slug = self.getAttribute('data-slug')
  if (!slug) return

  var origin
  try {
    origin = new URL(self.src).origin
  } catch (e) {
    origin = 'https://www.chatventi.com'
  }
  var color = self.getAttribute('data-color') || '#2563eb'
  var label = self.getAttribute('data-label') || 'Reservar cita'
  var bookingUrl = origin + '/r/' + encodeURIComponent(slug) + '?embed=1'

  if (window.__chatventiWidgetLoaded) return
  window.__chatventiWidgetLoaded = true

  function el(tag, styles, attrs) {
    var e = document.createElement(tag)
    if (styles) e.style.cssText = styles
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k])
    return e
  }

  // Botón flotante
  var btn = el(
    'button',
    'position:fixed;bottom:20px;right:20px;z-index:2147483000;border:none;border-radius:999px;' +
      'padding:14px 20px;font:600 15px system-ui,sans-serif;color:#fff;cursor:pointer;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.25);background:' + color + ';'
  )
  btn.textContent = label

  // Overlay + modal con iframe
  var overlay = el(
    'div',
    'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.5);display:none;' +
      'align-items:center;justify-content:center;padding:16px;'
  )
  var modal = el(
    'div',
    'position:relative;width:100%;max-width:460px;height:min(80vh,680px);background:#fff;' +
      'border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.3);'
  )
  var close = el(
    'button',
    'position:absolute;top:8px;right:10px;z-index:1;border:none;background:transparent;' +
      'font-size:22px;line-height:1;color:#6b7280;cursor:pointer;'
  )
  close.innerHTML = '&times;'
  close.setAttribute('aria-label', 'Cerrar')

  var iframe = el('iframe', 'width:100%;height:100%;border:none;', {
    src: bookingUrl,
    title: 'Reservar cita',
    loading: 'lazy',
  })

  function open() {
    overlay.style.display = 'flex'
  }
  function hide() {
    overlay.style.display = 'none'
  }

  btn.addEventListener('click', open)
  close.addEventListener('click', hide)
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hide()
  })

  modal.appendChild(close)
  modal.appendChild(iframe)
  overlay.appendChild(modal)

  function mount() {
    document.body.appendChild(btn)
    document.body.appendChild(overlay)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()

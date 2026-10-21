export class FakeElement {
  textContent = '';
  className = '';
  hidden = false;
  disabled = false;
  style = {};
  attributes = {};
  listeners = new Map();
  children = [];
  value = '';
  scrollTop = 0;
  tabIndex = 0;
  focus() {}
  addEventListener(event, callback) { this.listeners.set(event, callback); }
  removeEventListener(event) { this.listeners.delete(event); }
  appendChild(element) { this.children.push(element); return element; }
  replaceChildren() { this.children = []; }
  remove() {}
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  click() { if (!this.disabled) this.listeners.get('click')?.(); }
}

/** Documento mínimo: mapeia os ids do markup e cria elementos falsos. */
export function fakeDocument(ids) {
  const elements = new Map(ids.map(id => [id, new FakeElement()]));
  const listeners = new Map();
  const document = {
    elements,
    listeners,
    getElementById: id => elements.get(id) ?? null,
    createElement: () => new FakeElement(),
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: event => listeners.delete(event),
  };
  return document;
}

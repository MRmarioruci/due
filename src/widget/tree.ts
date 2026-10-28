/**
 * Walks a widget element the way react-native-android-widget does before drawing it: it calls each
 * component as a plain function until it reaches one of its own widgets, then does the same for the
 * children. Doing it first means a problem (a fragment, a hook) throws where we can catch it and
 * show it, instead of the widget silently staying empty.
 */
type El = { type: unknown; props?: { children?: unknown } & Record<string, unknown> };

export function checkWidgetTree(node: unknown): void {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return;
  if (Array.isArray(node)) return node.forEach(checkWidgetTree);
  let el = node as El;
  while (!(el.type as { __name__?: string })?.__name__) {
    if (typeof el.type !== 'function') throw new Error(`Widget can't draw ${String(el.type)}`);
    el = (el.type as (p: unknown) => El)(el.props);
  }
  checkWidgetTree(el.props?.children);
}

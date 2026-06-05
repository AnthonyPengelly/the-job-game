// Primitives — Icon (Lucide) + Button. Shared across the kit.
// Loaded as a Babel script; exports to window at the bottom.

function Icon({ name, className, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = `<i data-lucide="${name}"></i>`;
    window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
  }, [name]);
  return <span ref={ref} className={className} style={{ display: 'inline-flex', ...style }} />;
}

function Button({ kind = 'primary', size, icon, children, disabled, onClick, style }) {
  const cls = ['btn', `btn-${kind}`, size === 'lg' ? 'btn-lg' : ''].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled} onClick={onClick} style={style}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

Object.assign(window, { Icon, Button });

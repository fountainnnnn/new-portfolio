// The few line icons the design uses, drawn on a 24px grid in currentColor
const Icon = ({ d, children, ...rest }) => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true" {...rest}>{d ? <path d={d} /> : children}</svg>
);

export const ArrowDown = () => <Icon d="M12 5v14M6 13l6 6 6-6" />;
export const ArrowUp = () => <Icon d="M12 19V5M6 11l6-6 6 6" />;
export const ArrowRight = () => <Icon d="M5 12h14M13 6l6 6-6 6" />;
export const ArrowUpRight = () => <Icon d="M7 17 17 7M7 7h10v10" />;
export const Pin = () => <Icon><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></Icon>;

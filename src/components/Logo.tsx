/**
 * Logo Carbon Jar : un bocal qui capture le carbone (bulles de CO2) et fait pousser une
 * feuille — la comptabilité carbone au service de la durabilité.
 */
export function LogoMark({ size = 40, title }: { size?: number; title?: string }) {
  const id = 'cj-grad';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} className="logo-mark">
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id})`} />
      {/* couvercle */}
      <rect x="13" y="7" width="14" height="3.6" rx="1.6" fill="#f6f1e4" />
      {/* bocal */}
      <path d="M12.5 12.6h15a2 2 0 0 1 2 2v14.4a4.4 4.4 0 0 1-4.4 4.4h-10.2a4.4 4.4 0 0 1-4.4-4.4V14.6a2 2 0 0 1 2-2z" fill="none" stroke="#f6f1e4" strokeWidth="2" />
      {/* bulles de CO2 captées */}
      <circle cx="16.4" cy="17.6" r="1.7" fill="#f6f1e4" />
      <circle cx="20.6" cy="16" r="1.05" fill="#f6f1e4" opacity="0.85" />
      <circle cx="18.6" cy="20.6" r="0.75" fill="#f6f1e4" opacity="0.7" />
      {/* feuille */}
      <path d="M15.2 30c0-6.6 4.4-10.2 11.2-10.4.2 6.6-4.4 10.4-11.2 10.4z" fill="#a7f3d0" />
      <path d="M15.6 29.6l7.4-6.6" stroke="#065f46" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Logo complet : symbole + nom. */
export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="brand">
      <LogoMark size={42} />
      <div>
        <div className="brand-name">
          Carbon <span>Jar</span>
        </div>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}

/** Version SVG autonome (favicon, exports). */
export const LOGO_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%2310b981'/><stop offset='1' stop-color='%23065f46'/></linearGradient></defs><rect width='40' height='40' rx='11' fill='url(%23g)'/><rect x='13' y='7' width='14' height='3.6' rx='1.6' fill='%23f6f1e4'/><path d='M12.5 12.6h15a2 2 0 0 1 2 2v14.4a4.4 4.4 0 0 1-4.4 4.4h-10.2a4.4 4.4 0 0 1-4.4-4.4V14.6a2 2 0 0 1 2-2z' fill='none' stroke='%23f6f1e4' stroke-width='2'/><circle cx='16.4' cy='17.6' r='1.7' fill='%23f6f1e4'/><circle cx='20.6' cy='16' r='1.05' fill='%23f6f1e4'/><path d='M15.2 30c0-6.6 4.4-10.2 11.2-10.4.2 6.6-4.4 10.4-11.2 10.4z' fill='%23a7f3d0'/><path d='M15.6 29.6l7.4-6.6' stroke='%23065f46' stroke-width='1.3' stroke-linecap='round'/></svg>`;

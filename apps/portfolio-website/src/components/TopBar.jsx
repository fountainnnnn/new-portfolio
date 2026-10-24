import { CV, GITHUB, LINKEDIN } from "../data/links.js";

// brand, page links and the outside links; each page brings its own bar styles
export default function TopBar({ home = "#top", links = [] }) {
  return (
    <header className="bar">
      <a className="brand" href={home} aria-label="Mervin's Hub, home"><span className="logo"><img src="/img/logo-mark.png" alt="" /></span>Mervin’s Hub</a>
      <nav className="links" aria-label="Sections">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
      <nav className="out" aria-label="Elsewhere"><a href={GITHUB} target="_blank" rel="noreferrer">GitHub<span>↗</span></a><a href={LINKEDIN} target="_blank" rel="noreferrer">LinkedIn<span>↗</span></a><a href={CV}>CV<span>↓</span></a></nav>
    </header>
  );
}

import { CV, GITHUB, LINKEDIN } from "../data/links.js";
import "../styles/menu.css";

const ITEMS = [["Home", "#top"], ["About", "#about"], ["Skills", "#skills"], ["Work", "#work"], ["Experience", "#experience"], ["Contact", "#contact"]];

// the round button that appears once you scroll past the hero, and the drawer it opens
export default function Menu() {
  return (
    <>
      <button className="menu-btn" type="button" aria-label="Menu" aria-expanded="false"><i></i></button>
      <aside className="drawer" aria-label="Menu">
        <ul>{ITEMS.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
        <div className="soc"><a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a><a href={LINKEDIN} target="_blank" rel="noreferrer">LinkedIn</a><a href={CV}>CV</a></div>
      </aside>
    </>
  );
}

import { ALL_TILE_FAN, WORK } from "../data/work.js";
import { ArrowRight, ArrowUpRight } from "./Icons.jsx";
import "../styles/work.css";

export default function Work() {
  return (
    <section className="block wrap" id="work" aria-labelledby="work-h">
      <div className="sh"><h2 className="title" id="work-h">Selected work</h2><p>Hover the first two to flip through their pages.</p></div>
      <div className="tiles" data-perch="work">
        {WORK.map((w) => (
          <a className="tile" href={w.url} target="_blank" rel="noreferrer" key={w.t} data-pages={JSON.stringify(w.pages.map(([name]) => name))}>
            <div className="mat" style={{ background: w.bg }}>
              <div className="stack">{w.pages.map(([, src], i) => <img key={src} src={src} alt={i ? "" : `${w.t} screenshot`} loading="lazy" className={i ? "" : "on"} />)}</div>
              {w.pages.length > 1 && <div className="pages">{w.pages.map((_, i) => <i key={i} className={i ? "" : "on"}></i>)}<em>{w.pages[0][0]}</em></div>}
            </div>
            <div className="row"><h3><span>{w.t}</span><ArrowUpRight /></h3><span className="meta">{w.yr}</span></div>
            <p className="one">{w.one}</p>
          </a>
        ))}
        <a className="tile all" href="/projects">
          <div className="mat"><div className="fan">{ALL_TILE_FAN.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}</div></div>
          <div className="row"><h3><span>All projects</span><ArrowRight /></h3></div>
          <p className="one">Everything else I've built, plus my certificates.</p>
        </a>
      </div>
    </section>
  );
}

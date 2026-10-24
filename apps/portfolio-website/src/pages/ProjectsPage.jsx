import { useEffect, useRef, useState } from "react";
import "../styles/projects.css";
import TopBar from "../components/TopBar.jsx";
import { ArrowUpRight } from "../components/Icons.jsx";
import { PROJECT_GROUPS } from "../data/projects.js";
import { CERTIFICATES } from "../data/certificates.js";
import { EMAIL } from "../data/links.js";

const ISSUERS = ["All", ...new Set(CERTIFICATES.map((c) => c.issuer))];

function ProjectCard({ item: [title, one, stack, url, img] }) {
  return (
    <a className="card" href={url} target="_blank" rel="noreferrer">
      <div className={img ? "mat" : "mat text"}>{img ? <img src={img} alt={`${title} screenshot`} loading="lazy" /> : <b>{title}</b>}</div>
      <h3><span>{title}</span><ArrowUpRight /></h3>
      <p>{one}</p>
      <span className="meta">{stack}</span>
    </a>
  );
}

export default function ProjectsPage() {
  const [issuer, setIssuer] = useState("All");
  const [open, setOpen] = useState(null);
  const view = useRef(null);
  useEffect(() => { if (open) view.current.showModal(); }, [open]);
  // arriving at /projects#certs: React renders after the browser tried to scroll, so do it now
  useEffect(() => { if (location.hash) document.querySelector(location.hash)?.scrollIntoView(); }, []);

  return (
    <div className="wrap">
      <TopBar home="/" links={[["Home", "/"], ["Projects", "#builds"], ["Certificates", "#certs"]]} />

      <div className="head">
        <h1>Everything I've built</h1>
        <p>Hackathon builds, side projects, small AI apps and school work, plus the courses I've finished along the way.</p>
      </div>

      {PROJECT_GROUPS.map((g) => (
        <section className="group" id={g.id} aria-labelledby={`${g.id}-h`} key={g.id}>
          <div className="sh"><h2 id={`${g.id}-h`}>{g.title}</h2><p>{g.note}</p></div>
          <div className="grid">{g.items.map((item) => <ProjectCard item={item} key={item[0]} />)}</div>
        </section>
      ))}

      <section className="group" id="certs" aria-labelledby="c-h">
        <div className="sh"><h2 id="c-h">Certificates</h2><p>Click one to see it full size</p></div>
        <div className="chips" role="group" aria-label="Filter by issuer">
          {ISSUERS.map((name) => <button type="button" key={name} aria-pressed={issuer === name} onClick={() => setIssuer(name)}>{name}</button>)}
        </div>
        <div className="certs">
          {CERTIFICATES.map((c) => (
            <button className="cert" key={c.title} hidden={issuer !== "All" && c.issuer !== issuer} onClick={() => setOpen(c)}>
              <div className="mat"><img src={c.src} alt={`${c.title} certificate`} loading="lazy" /></div>
              <b>{c.title}</b><span>{c.issuer}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="foot">
        <span>Ng Yu Hang (Mervin), Singapore</span>
        <span><a href={`mailto:${EMAIL}`}>{EMAIL}</a></span>
      </footer>

      <dialog id="view" aria-label="Certificate" ref={view} onClick={() => view.current.close()} onClose={() => setOpen(null)}>
        {open && <><img src={open.src} alt={`${open.title} certificate`} /><p>{open.title} · {open.issuer}</p></>}
      </dialog>
    </div>
  );
}

import { CERT_HIGHLIGHTS } from "../data/certificates.js";
import { ArrowRight } from "./Icons.jsx";
import "../styles/recognition.css";

export function Competitions() {
  return (
    <section className="block wrap" aria-labelledby="hon-h">
      <div className="sh"><h2 className="title" id="hon-h">Competitions</h2><p>Olympiads and hackathons</p></div>
      <div className="wgrid" data-perch="wins">
        <div className="lead-win"><div><b>Bronze medal</b><span>National Olympiad in Artificial Intelligence 2026</span><span>AI Singapore</span></div><img src="/img/awards/noai-bronze.jpg" alt="NOAI 2026 bronze certificate of achievement and medal" loading="lazy" /></div>
        <div><b>Top 3</b><span>'SUP Build 2026</span><p>Built SUPAgent in 12 hours.</p></div>
        <div><b>Top 3</b><span>OpenClaw Hackathon</span><p>Built GrowthLab News.</p></div>
      </div>
    </section>
  );
}

export function Certifications() {
  return (
    <section className="block wrap certs" aria-labelledby="cert-h">
      <div className="sh"><h2 className="title" id="cert-h">Certifications</h2><p>A few highlights from 28 courses</p></div>
      <div className="cgrid">
        {CERT_HIGHLIGHTS.map((c) => (
          <button type="button" className="cert-card" data-full={c.src} key={c.title}>
            <span className="mat"><img src={c.src} alt={`${c.title} certificate`} loading="lazy" /></span>
            <span className="logo"><img src={c.logo} alt="" /></span>
            <b>{c.title}</b><span className="by">{c.issuer}</span>
          </button>
        ))}
      </div>
      <div className="more"><a className="btn ghost" href="/projects#certs">All certificates <ArrowRight /></a></div>
    </section>
  );
}

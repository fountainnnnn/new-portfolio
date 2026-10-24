import { CV, GITHUB, LINKEDIN } from "../data/links.js";
import "../styles/footer.css";

export default function Footer() {
  return (
    <footer className="contact" id="contact">
      <div className="curve" aria-hidden="true"><div></div></div>
      <div className="wrap">
        <h2><img src="/img/myself.png" alt="" />Let's build<br />something together</h2>
        <div className="rule" data-perch="footer"></div>
        <div className="pills">
          <a className="btn" href={CV}>Download CV</a>
          <button type="button" className="btn talk" data-contact><span className="face"><img src="/img/mascot/wave-cut.png" alt="" /></span>Get in touch</button>
        </div>
        <div className="foot">
          <div className="grp"><div><span className="meta">Updated</span>October 2026</div><div><span className="meta">Local time</span><span className="clock">--:--</span> in Singapore</div></div>
          <div><span className="meta">Elsewhere</span><div className="soc"><a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a><a href={LINKEDIN} target="_blank" rel="noreferrer">LinkedIn</a></div></div>
        </div>
      </div>
    </footer>
  );
}

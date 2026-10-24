import TopBar from "./TopBar.jsx";
import { ArrowDown, Pin } from "./Icons.jsx";
import { CV, GITHUB, LINKEDIN } from "../data/links.js";
import "../styles/top-bar.css";
import "../styles/hero.css";

const NAME = "Hi, I'm Ng Yu Hang (Mervin)";
const SECTIONS = [["About", "#about"], ["Skills", "#skills"], ["Work", "#work"], ["Experience", "#experience"], ["Contact", "#contact"]];
// detection boxes over the photo: [label, confidence, left, top, width, height] in %
const BOXES = [["tie", "0.91", 39, 79, 15, 19], ["hair", "0.88", 11, 3, 63, 35], ["mervin", "0.99", 25, 25, 45, 42, "main"]];

export default function Hero() {
  return (
    <section className="hero wrap" data-perch="hero">
      <TopBar links={SECTIONS} />
      <div className="body">
        <div>
          <h1 className="display"><span className="sr">{NAME}</span><span className="type" aria-hidden="true" data-text={NAME}></span><span className="cursor" aria-hidden="true"></span></h1>
          <p className="role">Full-stack AI Developer / Data Scientist</p>
          <p className="loc"><Pin />Singapore, Singapore</p>
          <p className="intro">I build AI-backed tools, automation workflows, and practical full-stack apps around documents, data, and agentic systems.</p>
          <div className="ctas">
            <a className="btn solid" href={CV}>Download CV</a>
            <button type="button" className="btn talk" data-contact><span className="face"><img src="/img/mascot/wave-cut.png" alt="" /></span>Contact me</button>
          </div>
          <div className="social">
            <a href={GITHUB} target="_blank" rel="noreferrer" aria-label="GitHub"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/github/github-original.svg" alt="" /></a>
            <a href={LINKEDIN} target="_blank" rel="noreferrer" aria-label="LinkedIn"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/linkedin/linkedin-original.svg" alt="" /></a>
          </div>
        </div>
        <figure className="det" aria-label="Photo of Mervin with object-detection boxes: mervin, hair, suit and tie">
          <div className="frame">
            <div className="photo"><img src="/img/myself.png" alt="Portrait of Mervin Ng" /><span className="scan" aria-hidden="true"></span></div>
            {BOXES.map(([l, c, left, top, width, height, main]) => (
              <div key={l} className={main ? "box main" : "box"} data-l={l} data-c={c} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}></div>
            ))}
          </div>
          <figcaption><span className="model">vision model</span><span className="cap-text"></span><span className="caret"></span></figcaption>
        </figure>
      </div>
      <a className="cue" href="#about" aria-label="Scroll down to see what I build"><span>Scroll down, there’s more</span><ArrowDown /></a>
    </section>
  );
}

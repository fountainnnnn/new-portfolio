import { SKILLS } from "../data/skills.js";
import "../styles/skills.css";

// links to sections on this page stay in the tab; everything else opens a new one
const ext = (href) => (href.startsWith("#") ? {} : { target: "_blank", rel: "noreferrer" });

export default function Skills() {
  return (
    <section className="block wrap" id="skills" aria-labelledby="skills-h">
      <div className="sh"><h2 className="title" id="skills-h">What I can build</h2></div>
      {SKILLS.map((s) => (
        <article className="skill" key={s.viz}>
          <div className="txt">
            <h3 className="title">{s.title}</h3>
            <p>{s.text}</p>
            <div className="tags">{s.tags.map((t) => <span key={t}>{t}</span>)}</div>
            <p className="built"><span>Built in</span>{s.built.map(([name, href]) => <a key={name} href={href} {...ext(href)}>{name}</a>)}</p>
          </div>
          <div className="viz" data-perch={s.perch}><canvas data-viz={s.viz} aria-label={s.label}></canvas></div>
        </article>
      ))}
    </section>
  );
}

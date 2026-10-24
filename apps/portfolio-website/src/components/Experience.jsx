import { EXPERIENCE } from "../data/experience.js";
import "../styles/experience.css";

export default function Experience() {
  return (
    <section className="block wrap" id="experience" aria-labelledby="xp-h">
      <div className="sh"><h2 className="title" id="xp-h">Experience</h2><p>2025 to now</p></div>
      <div data-perch="xp">
        {EXPERIENCE.map((x) => (
          <div className="xrow" id={x.id} key={x.name}>
            <p className="meta">{x.when}</p>
            <div className="co"><span className="logo"><img src={x.logo} alt="" /></span><div><h3>{x.name}</h3><p className="role">{x.role}</p></div></div>
            <p>{x.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

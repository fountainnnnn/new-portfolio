import { Fragment } from "react";
import "../styles/about.css";

const LEAD = "Hello, I'm Yu Hang, though most people know me as Mervin. I've been fascinated by computers since I was young, and today I build AI tools and full-stack apps, from agents to neural networks. One day I hope to build something that helps millions of people.";
const FACTS = [["Studying", "Applied AI & Analytics, Singapore Polytechnic"], ["Now", "Founding engineer, Influencees"], ["Also", "AI engineer intern, SP DSAC"], ["Building", "Reyolk"]];

export default function About() {
  // each word is its own span so they light up one by one as you scroll
  const words = LEAD.split(" ");
  return (
    <section className="block wrap about" id="about" aria-labelledby="about-h">
      <div className="sh"><h2 className="title" id="about-h">About</h2><p>Student, builder, Singapore.</p></div>
      <div className="grid">
        <p className="lead" data-words>{words.map((w, i) => <Fragment key={i}>{i ? " " : ""}<span className="w">{w}</span></Fragment>)}</p>
        <div className="side" data-perch="about">
          <dl>{FACTS.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl>
          <a className="btn ghost" href="#work" style={{ justifySelf: "start" }}>See the work</a>
        </div>
      </div>
    </section>
  );
}

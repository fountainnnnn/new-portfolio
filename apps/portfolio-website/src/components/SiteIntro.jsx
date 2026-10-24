import "../styles/site-intro.css";

// The opening lines from the previous site, same words and timing; lib/home.js ends it
export default function SiteIntro() {
  return (
    <div className="site-intro is-playing" role="status" aria-live="polite" aria-label="Hello. I'm Mervin. An AI Full Stack Enthusiast. Welcome to my website.">
      <div className="intro-stage">
        <p className="intro-line intro-line-hello">Hello! :D</p>
        <p className="intro-line intro-line-name">I’m Mervin<span>An AI Full Stack Enthusiast :)</span></p>
        <p className="intro-line intro-line-welcome">Welcome to my website!</p>
      </div>
    </div>
  );
}

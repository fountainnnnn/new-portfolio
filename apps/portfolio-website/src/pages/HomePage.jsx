import { useEffect } from "react";
import "../styles/base.css";
import SiteIntro from "../components/SiteIntro.jsx";
import Menu from "../components/Menu.jsx";
import Hero from "../components/Hero.jsx";
import About from "../components/About.jsx";
import Skills from "../components/Skills.jsx";
import Work from "../components/Work.jsx";
import Experience from "../components/Experience.jsx";
import { Competitions, Certifications } from "../components/Recognition.jsx";
import ToolsBelt from "../components/ToolsBelt.jsx";
import Footer from "../components/Footer.jsx";
import Overlays from "../components/Overlays.jsx";
import Mascot from "../components/Mascot.jsx";
import { startHome } from "../lib/home.js";
import { startVisuals } from "../visuals/index.js";

export default function HomePage() {
  useEffect(() => {
    startHome();
    return startVisuals(document);
  }, []);
  return (
    <>
      <SiteIntro />
      <Menu />
      <main id="top">
        <Hero />
        <About />
        <Skills />
        <Work />
        <Experience />
        <Competitions />
        <Certifications />
        <ToolsBelt />
      </main>
      <Footer />
      <Overlays />
      <Mascot />
    </>
  );
}

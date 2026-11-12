import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown } from "./Icons.jsx";
import { CV, CV_ML } from "../data/links.js";
import "../styles/cv-picker.css";

const OPTIONS = [
  [CV, "AI Engineer", "AI, GenAI and full-stack AI roles"],
  [CV_ML, "ML Engineer", "Model training and evaluation"],
];
const WIDTH = 300, GAP = 8, MARGIN = 16;

// any CV link (marked data-cv) drops down a choice of CV under itself; the link still works without JavaScript
export default function CvPicker() {
  const ref = useRef(null);
  const anchor = useRef(null);
  const [state, setState] = useState({ open: false, x: 0, y: 0, up: false });

  useEffect(() => {
    const close = () => { anchor.current?.setAttribute("aria-expanded", "false"); anchor.current = null; setState((s) => ({ ...s, open: false })); };
    const onClick = (e) => {
      const link = e.target.closest?.("a[data-cv]");
      if (link) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (anchor.current === link) return close();
        anchor.current?.setAttribute("aria-expanded", "false");
        anchor.current = link;
        link.setAttribute("aria-expanded", "true");
        const r = link.getBoundingClientRect();
        const up = r.bottom + 180 > innerHeight && r.top > 200;
        const x = Math.min(Math.max(MARGIN, r.left), innerWidth - WIDTH - MARGIN) + scrollX;
        const y = (up ? r.top - GAP : r.bottom + GAP) + scrollY;
        setState({ open: true, x, y, up });
        return;
      }
      if (!ref.current?.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === "Escape" && anchor.current) { const a = anchor.current; close(); a.focus(); } };
    document.querySelectorAll("a[data-cv]").forEach((a) => a.setAttribute("aria-haspopup", "true"));
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    addEventListener("resize", close);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); removeEventListener("resize", close); };
  }, []);

  return createPortal(
    <div ref={ref} className={`cv-drop${state.open ? " open" : ""}${state.up ? " up" : ""}`} style={{ left: state.x, top: state.y, width: WIDTH }} role="menu" aria-label="Choose a CV" inert={state.open ? undefined : ""}>
      {OPTIONS.map(([href, title, note]) => (
        <a key={title} role="menuitem" href={href} target="_blank" rel="noreferrer" onClick={() => setState((s) => ({ ...s, open: false }))}>
          <span><b>{title}</b><small>{note}</small></span><ArrowDown />
        </a>
      ))}
    </div>,
    document.body
  );
}

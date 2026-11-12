import { useEffect, useRef } from "react";
import { ArrowDown } from "./Icons.jsx";
import { CV, CV_ML } from "../data/links.js";
import "../styles/cv-picker.css";

const OPTIONS = [
  [CV, "AI Engineer", "AI, GenAI and full-stack AI engineering roles"],
  [CV_ML, "ML Engineer", "Model training, evaluation and ML projects"],
];

// any CV link (marked data-cv) asks which version first; the link still works without JavaScript
export default function CvPicker() {
  const ref = useRef(null);
  useEffect(() => {
    const open = (e) => {
      const link = e.target.closest?.("a[data-cv]");
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      ref.current?.showModal();
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);
  const close = () => ref.current?.close();
  return (
    <dialog ref={ref} className="cv-pick" aria-labelledby="cv-pick-title" onClick={(e) => e.target === ref.current && close()}>
      <div className="in">
        <h2 id="cv-pick-title">Which CV would you like?</h2>
        <ul>
          {OPTIONS.map(([href, title, note]) => (
            <li key={title}><a href={href} target="_blank" rel="noreferrer" onClick={close}><span><b>{title}</b><small>{note}</small></span><ArrowDown /></a></li>
          ))}
        </ul>
        <button type="button" className="close" onClick={close}>Cancel</button>
      </div>
    </dialog>
  );
}

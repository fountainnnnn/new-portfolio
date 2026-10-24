import { ArrowUp } from "./Icons.jsx";

// fixed bits that sit above the page: back to top, and the full-size certificate viewer
export default function Overlays() {
  return (
    <>
      <button type="button" className="to-top" aria-label="Back to top"><ArrowUp /></button>
      <dialog className="cert-view" aria-label="Certificate"><img alt="" /></dialog>
    </>
  );
}

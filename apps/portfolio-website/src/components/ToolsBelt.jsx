import "../styles/belt.css";

const ICONS = "https://skillicons.dev/icons?i=py,ts,js,react,nextjs,nodejs,fastapi,pytorch,tensorflow,sklearn,opencv,flutter,dart,docker,postgres,supabase,azure,aws,cloudflare,githubactions,linux,git&perline=22&theme=light";
const NAMES = "Python, TypeScript, JavaScript, React, Next.js, Node.js, FastAPI, PyTorch, TensorFlow, scikit-learn, OpenCV, Flutter, Dart, Docker, PostgreSQL, Supabase, Azure, AWS, Cloudflare, GitHub Actions, Linux, Git";

// two copies side by side so the strip loops seamlessly
export default function ToolsBelt() {
  return (
    <section className="belt-wrap" aria-label="Tools I build with">
      <p className="meta wrap">Tools I use most</p>
      <div className="belt"><img src={ICONS} alt={NAMES} /><img src={ICONS} alt="" aria-hidden="true" /></div>
    </section>
  );
}

/* Contact: any [data-contact] button sends mini Mervin over with a message form in his window.
   The form posts { email, message, page } as JSON to /api/contact, which emails it with Resend. */
export function startContact(el, mascot) {
  const mini = el.querySelector(".mini");
  const CONTACT_URL = "/api/contact";
  const contactForm = mini.querySelector(".msg-form"), cStatus = contactForm.querySelector(".contact-status"), cSend = contactForm.querySelector(".send");
  const setStatus = (text, kind = "") => { cStatus.textContent = text; cStatus.className = `contact-status ${kind}`; };
  function openContact(trigger) {
    mini.classList.add("contact-mode"); setStatus("");
    mascot.open = true; el.setAttribute("aria-expanded", "true");
    mascot.goTo?.(trigger); mascot.cheer = 0.9;
    setTimeout(() => contactForm.querySelector("textarea").focus({ preventScroll: true }), 80);
  }
  document.querySelectorAll("[data-contact]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openContact(b); }));
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(contactForm));
    const message = data.message.trim(), email = data.email.trim();
    if (data.company) return;   // a bot filled the hidden field
    if (message.length < 5) return setStatus("Write a little more first.", "err");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus("That email doesn't look right.", "err");
    cSend.disabled = true; setStatus("Sending…"); mascot.thinking = true;
    try {
      const res = await fetch(CONTACT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, message, page: location.href }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (data.fallback === "email") {   // email sending isn't set up: open their mail app with the message filled in
        location.href = `mailto:${data.to}?subject=${encodeURIComponent("Hello from ngyuhang.com")}&body=${encodeURIComponent(`${message}\n\nReply to: ${email}`)}`;
        setStatus("Opening your email app with your message.", "ok");
        return;
      }
      contactForm.reset(); setStatus("Sent! I'll get back to you soon.", "ok"); mascot.cheer = 1.4;
    } catch {
      setStatus("Couldn't send just now. Email me at spiralcrust@gmail.com instead.", "err");
    } finally { cSend.disabled = false; mascot.thinking = false; }
  });
}

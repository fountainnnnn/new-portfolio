import { useEffect, useRef } from "react";
import { startMascot } from "../mascot/engine.js";
import { startChat } from "../mascot/chat.js";
import { startContact } from "../mascot/contact.js";
import { ArrowRight } from "./Icons.jsx";
import "../styles/mascot.css";

// mini Mervin, his speech bubble, and his window (the chat, or the contact form)
export default function Mascot() {
  const ref = useRef(null);
  useEffect(() => {
    const { api, stop } = startMascot(ref.current);
    startChat(ref.current, api);
    startContact(ref.current, api);
    return stop;
  }, []);
  return (
    <div className="mascot" ref={ref} role="button" tabIndex={0} aria-label="Chat with mini Mervin" aria-controls="mini" aria-expanded="false" hidden>
      <div className="flip"></div><span className="say"></span>
      <div className="mini" id="mini" role="dialog" aria-label="Chat with mini Mervin">
        <div className="thread" aria-live="polite"></div>
        <form className="msg-form" noValidate>
          <p className="contact-h">Leave me a message</p>
          <label className="sr" htmlFor="c-msg">Your message</label><textarea id="c-msg" name="message" rows={4} maxLength={2000} required placeholder="What would you like to build, or ask?"></textarea>
          <label className="sr" htmlFor="c-email">Your email</label><input id="c-email" name="email" type="email" autoComplete="email" maxLength={200} required placeholder="Your email, so I can reply" />
          <input className="hp" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button type="submit" className="send">Send message</button>
          <p className="contact-status" role="status"></p>
        </form>
        <form className="ask"><label className="sr" htmlFor="mini-in">Ask mini Mervin</label><input id="mini-in" autoComplete="off" maxLength={300} placeholder="Ask me anything" /><button type="submit" aria-label="Send"><ArrowRight /></button></form>
      </div>
    </div>
  );
}

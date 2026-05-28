"use client";

/* eslint-disable @next/next/no-html-link-for-pages */
import { useState } from "react";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 select-none pointer-events-none">
      <div className="w-[calc(100%-24px)] md:w-[min(96%,1500px)] my-[10px] md:my-[18px] mx-auto bg-white/88 backdrop-blur-[18px] saturate-[150%] rounded-[18px] shadow-[0_0_0_1px_rgba(17,24,39,0.08),0_16px_40px_rgba(17,24,39,0.11),0_2px_8px_rgba(17,24,39,0.06)] py-[8px] px-[14px] md:px-[22px] flex items-center justify-between transition-all duration-300 pointer-events-auto">
        {/* Brand/Logo */}
        <a
          href="/index.html#hero"
          className="inline-flex items-center font-bold text-[#111827] text-[16px] md:text-[18.4px] py-[5px] md:py-[6px] tracking-[-0.01em] hover:opacity-90 transition duration-200"
        >
          Mervin&apos;s Hub <span className="text-[#c1c1c1] font-light mx-[6px] md:mx-[8px]">/</span> <span className="text-[#275efe]">Decidr</span>
        </a>

        {/* Desktop Navigation Pill */}
        <nav className="hidden md:flex items-center gap-[4px] bg-[#f7f8fa]/78 px-[4px] py-[4px] rounded-full shadow-[inset_0_0_0_1px_rgba(17,24,39,0.06)]">
          <a
            href="/index.html#about"
            className="inline-flex items-center justify-center min-h-[38px] px-[14px] py-[8px] rounded-full text-[15.6px] font-[650] text-[#566273] hover:text-[#111827] hover:bg-white/42 hover:shadow-[inset_0_0_0_1px_rgba(17,24,39,0.04)] hover:-translate-y-[1px] transition-all duration-200"
          >
            About
          </a>
          <a
            href="/projects.html"
            className="inline-flex items-center justify-center min-h-[38px] px-[14px] py-[8px] rounded-full text-[15.6px] font-[650] text-[#111827] bg-white shadow-[0_1px_3px_rgba(17,24,39,0.05),0_0_0_1px_rgba(17,24,39,0.04)] transition-all duration-200"
          >
            Projects
          </a>
          <a
            href="/index.html#skills"
            className="inline-flex items-center justify-center min-h-[38px] px-[14px] py-[8px] rounded-full text-[15.6px] font-[650] text-[#566273] hover:text-[#111827] hover:bg-white/42 hover:shadow-[inset_0_0_0_1px_rgba(17,24,39,0.04)] hover:-translate-y-[1px] transition-all duration-200"
          >
            Skills
          </a>
          <a
            href="/certificates.html"
            className="inline-flex items-center justify-center min-h-[38px] px-[14px] py-[8px] rounded-full text-[15.6px] font-[650] text-[#566273] hover:text-[#111827] hover:bg-white/42 hover:shadow-[inset_0_0_0_1px_rgba(17,24,39,0.04)] hover:-translate-y-[1px] transition-all duration-200"
          >
            Certifications
          </a>
          <a
            href="/index.html#contact"
            className="inline-flex items-center justify-center min-h-[38px] px-[14px] py-[8px] rounded-full text-[15.6px] font-[650] text-white bg-[#202731] hover:bg-[#111827] hover:-translate-y-[1px] transition-all duration-200 shadow-[0_0_0_1px_rgba(17,24,39,0.1),0_8px_18px_rgba(17,24,39,0.14)] ml-[4px]"
          >
            Contact
          </a>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden flex flex-col gap-[4px] items-center justify-center w-[42px] h-[42px] rounded-[14px] bg-[#f7f8fa] shadow-[inset_0_0_0_1px_rgba(17,24,39,0.08)] hover:bg-[#f1f3f5] transition-all duration-200"
          aria-label="Toggle Navigation"
          aria-expanded={isOpen}
        >
          <span className={`w-[18px] h-[2px] rounded-full bg-[#202731] transition-all duration-300 ${isOpen ? "rotate-45 translate-y-[6px]" : ""}`} />
          <span className={`w-[18px] h-[2px] rounded-full bg-[#202731] transition-all duration-300 ${isOpen ? "opacity-0" : ""}`} />
          <span className={`w-[18px] h-[2px] rounded-full bg-[#202731] transition-all duration-300 ${isOpen ? "-rotate-45 -translate-y-[6px]" : ""}`} />
        </button>
      </div>

      {/* Mobile Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-[68px] left-[12px] right-[12px] bg-white/95 backdrop-blur-[18px] saturate-[150%] rounded-[18px] shadow-[0_16px_40px_rgba(17,24,39,0.12),0_0_0_1px_rgba(17,24,39,0.08)] border border-gray-100 p-[8px] flex flex-col gap-[5px] md:hidden animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <a
            href="/index.html#about"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex items-center min-h-[42px] px-[16px] py-[11px] rounded-[10px] text-[15.6px] font-[650] text-[#566273] hover:text-[#111827] hover:bg-[#f7f8fa] transition duration-200"
          >
            About
          </a>
          <a
            href="/projects.html"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex items-center min-h-[42px] px-[16px] py-[11px] rounded-[10px] text-[15.6px] font-[650] text-[#111827] bg-[#f7f8fa] shadow-[inset_0_0_0_1px_rgba(17,24,39,0.06)] transition duration-200"
          >
            Projects
          </a>
          <a
            href="/index.html#skills"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex items-center min-h-[42px] px-[16px] py-[11px] rounded-[10px] text-[15.6px] font-[650] text-[#566273] hover:text-[#111827] hover:bg-[#f7f8fa] transition duration-200"
          >
            Skills
          </a>
          <a
            href="/certificates.html"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex items-center min-h-[42px] px-[16px] py-[11px] rounded-[10px] text-[15.6px] font-[650] text-[#566273] hover:text-[#111827] hover:bg-[#f7f8fa] transition duration-200"
          >
            Certifications
          </a>
          <a
            href="/index.html#contact"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex items-center justify-center min-h-[42px] px-[16px] py-[11px] rounded-[10px] text-[15.6px] font-[650] text-white bg-[#202731] hover:bg-[#111827] transition duration-200 shadow-[0_0_0_1px_rgba(17,24,39,0.1),0_8px_18px_rgba(17,24,39,0.14)] mt-[2px]"
          >
            Contact
          </a>
        </div>
      )}
    </header>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const animatedElements = document.querySelectorAll("[data-animate]");
  if (!animatedElements.length) return;

  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      const el = entry.target;
      const direction = el.getAttribute("data-animate");
      const persistHero = el.classList.contains("hero-section")
        || el.classList.contains("predict-hero")
        || el.classList.contains("profile-hero")
        || el.classList.contains("auth-hero");

      if (entry.isIntersecting) {
        const delay = index * 80;
        setTimeout(() => {
          el.classList.add("animate-in");
          el.classList.add(`from-${direction}`);
          el.classList.remove("animate-out");
          el.classList.remove(`to-${direction}`);
        }, delay);
        if (persistHero) {
          animationObserver.unobserve(el);
        }
      } else if (!persistHero) {
        el.classList.remove("animate-in");
        el.classList.remove(`from-${direction}`);
        el.classList.add("animate-out");
        el.classList.add(`to-${direction}`);
      }
    });
  }, { threshold: 0.2 });

  animatedElements.forEach(el => animationObserver.observe(el));
});

document.addEventListener("DOMContentLoaded", function () {
  const elements = document.querySelectorAll(".stat");
  const speed = 80;           // typing speed (ms per character)
  const delayBetween = 1500;  // pause before deleting
  const deleteSpeed = 40;     // deleting speed
  const pauseBeforeNext = 10;// pause before typing again

  elements.forEach(el => {
    const text = el.textContent.trim();
    const maxWidthSpan = document.createElement("span");
    maxWidthSpan.style.visibility = "hidden";
    maxWidthSpan.textContent = text;
    el.innerHTML = ""; 
    el.appendChild(maxWidthSpan);

    const typeSpan = document.createElement("span");
    typeSpan.classList.add("typewriter-text");
    el.appendChild(typeSpan);

    let i = 0;
    let isDeleting = false;

    function typeLoop() {
      if (!isDeleting && i <= text.length) {
        typeSpan.textContent = text.substring(0, i);
        i++;
        setTimeout(typeLoop, speed);
      } else if (isDeleting && i >= 0) {
        typeSpan.textContent = text.substring(0, i);
        i--;
        setTimeout(typeLoop, deleteSpeed);
      } else {
        isDeleting = !isDeleting;
        setTimeout(typeLoop, isDeleting ? delayBetween : pauseBeforeNext);
      }
    }

    setTimeout(typeLoop, 400);
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const nav = document.querySelector(".main-nav");
  const hero = document.querySelector(".hero-section")
    || document.querySelector(".predict-hero")
    || document.querySelector(".auth-hero")
    || document.querySelector(".profile-hero");
  if (!nav) return;
  if (!hero) {
    nav.classList.add("is-docked");
    return;
  }

  const setDocked = (isDocked) => {
    if (isDocked) {
      nav.classList.add("is-docked");
    } else {
      nav.classList.remove("is-docked");
    }
  };

  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => setDocked(!entry.isIntersecting));
      },
      { threshold: 0.2, rootMargin: "-80px 0px 0px 0px" }
    );
    navObserver.observe(hero);
  } else {
    const fallback = () => {
      const heroRect = hero.getBoundingClientRect();
      setDocked(heroRect.bottom <= 0);
    };
    window.addEventListener("scroll", fallback, { passive: true });
    window.addEventListener("resize", fallback);
    fallback();
  }
});

// Menu burger (mobile)
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
if (toggle && links) {
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("open"))
  );
}

// Lightbox pour les captures des rapports
const lightbox = document.createElement("div");
lightbox.className = "lightbox";
lightbox.innerHTML =
  '<button class="lightbox-close" aria-label="Fermer">&times;</button><img alt=""><figcaption></figcaption>';
document.body.appendChild(lightbox);

const lbImg = lightbox.querySelector("img");
const lbCaption = lightbox.querySelector("figcaption");

document.querySelectorAll(".gallery figure").forEach((fig) => {
  fig.addEventListener("click", () => {
    const img = fig.querySelector("img");
    const caption = fig.querySelector("figcaption");
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCaption.textContent = caption ? caption.textContent : "";
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  });
});

function closeLightbox() {
  lightbox.classList.remove("open");
  document.body.style.overflow = "";
}

lightbox.addEventListener("click", closeLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

// Apparition douce des sections au défilement
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

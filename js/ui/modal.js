/**
 * Simple accessible modal helper. Returns a close() function.
 * `bodyHTML` is trusted markup built by our own screens (never raw user input).
 */
export function openModal({ title, bodyHTML, actions = [], onClose, dismissible = true }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "presentation");

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  if (title) modal.setAttribute("aria-label", title);

  modal.innerHTML = `
    ${title ? `<h2 class="text-center" style="margin-bottom:12px">${title}</h2>` : ""}
    <div class="modal-body">${bodyHTML || ""}</div>
    <div class="row-wrap center" style="margin-top:20px">
      ${actions.map((a, i) => `<button class="btn ${a.variant ? "btn-" + a.variant : ""}" data-action-index="${i}">${a.label}</button>`).join("")}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKeydown);
    onClose?.();
  }

  function onKeydown(e) {
    if (e.key === "Escape" && dismissible) close();
  }
  document.addEventListener("keydown", onKeydown);

  if (dismissible) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }

  actions.forEach((a, i) => {
    modal.querySelector(`[data-action-index="${i}"]`).addEventListener("click", () => {
      a.onClick?.();
      if (a.closeOnClick !== false) close();
    });
  });

  const firstFocusable = modal.querySelector("button, input, select, [tabindex]");
  firstFocusable?.focus();

  return close;
}

export default { openModal };

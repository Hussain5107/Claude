let stack = null;

function ensureStack() {
  if (stack && document.body.contains(stack)) return stack;
  stack = document.createElement("div");
  stack.className = "toast-stack";
  stack.setAttribute("aria-live", "polite");
  stack.setAttribute("role", "status");
  document.body.appendChild(stack);
  return stack;
}

export function showToast(message, { icon = "✨", duration = 2600 } = {}) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span aria-hidden="true">${icon}</span> ${message}`;
  ensureStack().appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 300ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 320);
  }, duration);
}

export default { showToast };

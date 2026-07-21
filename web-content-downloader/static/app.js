const form = document.getElementById("form");
const engineSelect = document.getElementById("engine");
const modeRow = document.getElementById("modeRow");
const statusBox = document.getElementById("status");
const barFill = document.getElementById("barFill");
const statusText = document.getElementById("statusText");
const fileLink = document.getElementById("fileLink");
const errorText = document.getElementById("errorText");
const submitBtn = form.querySelector("button");

function toggleModeRow() {
  modeRow.style.display = engineSelect.value === "ytdlp" ? "block" : "none";
}
engineSelect.addEventListener("change", toggleModeRow);
toggleModeRow();

function resetUI() {
  errorText.hidden = true;
  statusBox.hidden = true;
  fileLink.hidden = true;
  barFill.style.width = "0%";
}

async function poll(jobId) {
  const res = await fetch(`/api/status/${jobId}`);
  const data = await res.json();

  if (data.error && !data.status) {
    errorText.textContent = data.error;
    errorText.hidden = false;
    submitBtn.disabled = false;
    return;
  }

  statusText.textContent = data.message || data.status;

  if (data.status === "downloading") {
    const match = /(\d+(\.\d+)?)%/.exec(data.message || "");
    barFill.style.width = match ? `${match[1]}%` : "50%";
  } else if (data.status === "processing" || data.status === "queued") {
    barFill.style.width = "90%";
  }

  if (data.status === "done") {
    barFill.style.width = "100%";
    fileLink.href = `/api/file/${jobId}`;
    fileLink.hidden = false;
    submitBtn.disabled = false;
    return;
  }

  if (data.status === "error") {
    errorText.textContent = data.error || "Something went wrong.";
    errorText.hidden = false;
    submitBtn.disabled = false;
    return;
  }

  setTimeout(() => poll(jobId), 800);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  resetUI();
  submitBtn.disabled = true;

  const url = document.getElementById("url").value.trim();
  const engine = engineSelect.value;
  const mode = document.getElementById("mode").value;

  statusBox.hidden = false;
  statusText.textContent = "Starting…";

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, engine, mode }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorText.textContent = data.error || "Request failed.";
      errorText.hidden = false;
      submitBtn.disabled = false;
      return;
    }

    poll(data.job_id);
  } catch (err) {
    errorText.textContent = "Could not reach the server.";
    errorText.hidden = false;
    submitBtn.disabled = false;
  }
});

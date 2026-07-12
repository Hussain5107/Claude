const $ = (id) => document.getElementById(id);

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function scriptPromptTemplate() {
  const theme = $("theme").value.trim() || "[THEME]";
  const durationSeconds = Number($("duration").value) || 900;
  const minutes = Math.round(durationSeconds / 60);
  const words = Math.round(minutes * 90);
  return `Write an original guided meditation script on the theme: "${theme}".

Write approximately ${minutes} minutes of spoken narration at a slow, calm
pace (~130 words per minute) — aim for roughly ${words} words total (leaving
room for natural pauses in the final audio). Break it into 6-10 sections,
with a blank line between each section.

Each section will have a silent pause inserted after it in the final audio,
so write each one as a self-contained spoken passage that doesn't depend on
the listener having just heard a sentence cut off.

Write in second person, present tense, calm and unhurried. Use concrete
sensory language rather than generic affirmations. Do not use headings,
numbering, stage directions, or bracketed notes — only the words to be
spoken aloud, in plain paragraphs.`;
}

function metadataPromptTemplate() {
  const theme = $("theme").value.trim() || "[THEME]";
  const sections = splitParagraphs($("scriptText").value);
  const sectionsBlock = sections.length
    ? sections.map((s, i) => `Section ${i + 1}: ${s}`).join("\n\n")
    : "[PASTE YOUR SCRIPT SECTIONS HERE FIRST]";
  return `Here is the full narration script for a guided meditation video on the
theme "${theme}", broken into its sections in order:

${sectionsBlock}

Write YouTube metadata for this video and return ONLY a JSON object (no
other text, no markdown code fences) in exactly this shape:

{
  "title": "an SEO-optimized YouTube title for the meditation/wellness niche, under 70 characters, no clickbait, one emoji max if natural",
  "description": "a 3-5 paragraph YouTube description covering what the meditation helps with, who it's for, and a soft call to subscribe, naturally optimized for meditation/wellness/sleep/anxiety search terms relevant to the theme without keyword-stuffing",
  "tags": ["15-25 relevant lowercase tags, no # symbol"],
  "chapterTitles": ["exactly one short 2-5 word label per section above, in order"]
}`;
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = "Copied!";
    setTimeout(() => (button.textContent = original), 1500);
  } catch {
    alert("Couldn't copy automatically — here's the text:\n\n" + text);
  }
}

$("copyScriptPrompt").addEventListener("click", () => {
  copyToClipboard(scriptPromptTemplate(), $("copyScriptPrompt"));
});
$("copyMetadataPrompt").addEventListener("click", () => {
  copyToClipboard(metadataPromptTemplate(), $("copyMetadataPrompt"));
});

function renderReport(report) {
  const el = $("inspectionReport");
  const lines = [];
  lines.push(`<div class="verdict ${report.verdict}">${report.verdict.toUpperCase().replace("_", " ")}</div>`);
  lines.push(`<div class="hint">Word count: ${report.wordCount} (~${report.estimatedDurationSeconds}s of narration)</div>`);
  if (report.projectedTotalSeconds !== undefined) {
    lines.push(`<div class="hint">Projected total video length: ~${report.projectedTotalSeconds}s</div>`);
  }
  if (report.findings.length === 0) {
    lines.push(`<div class="finding info">No issues found.</div>`);
  } else {
    for (const f of report.findings) {
      lines.push(`<div class="finding ${f.severity}"><strong>${f.category}</strong>: ${f.message}</div>`);
    }
  }
  el.innerHTML = lines.join("\n");
  return report;
}

let lastReport = null;

$("runInspection").addEventListener("click", async () => {
  const text = $("scriptText").value;
  if (!text.trim()) {
    alert("Paste a script first.");
    return;
  }
  $("runInspection").disabled = true;
  try {
    const res = await fetch("/api/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetDurationSeconds: Number($("duration").value) || undefined }),
    });
    const report = await res.json();
    lastReport = report;
    renderReport(report);
  } catch (e) {
    $("inspectionReport").innerHTML = `<div class="finding fail">Inspection request failed: ${e}</div>`;
  } finally {
    $("runInspection").disabled = false;
  }
});

function renderProgress(html) {
  $("progress").innerHTML = html;
}

const stepLabels = [];

function progressHTML(events) {
  const steps = events.filter((e) => e.type === "step");
  const lastStep = steps[steps.length - 1];
  const voProgress = [...events].reverse().find((e) => e.type === "voiceover-progress");
  const renderProgressEvents = events.filter((e) => e.type === "render-progress");
  const outputs = events.filter((e) => e.type === "output");
  const done = events.find((e) => e.type === "done");
  const jobError = events.find((e) => e.type === "job-error");

  const parts = [];
  for (const s of steps) {
    const isLast = s === lastStep;
    const cls = done ? "complete" : isLast ? "active" : "complete";
    parts.push(`<div class="step-line ${cls}">[${s.step}/${s.total}] ${s.label}${isLast && !done ? "..." : ""}</div>`);
  }
  if (voProgress && !done) {
    const pct = Math.round((voProgress.done / voProgress.total) * 100);
    parts.push(`<div class="hint">Voiceover: segment ${voProgress.done}/${voProgress.total}</div>`);
    parts.push(`<div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`);
  }
  const latestPerFormat = {};
  for (const e of renderProgressEvents) latestPerFormat[e.format] = e;
  for (const key of Object.keys(latestPerFormat)) {
    const e = latestPerFormat[key];
    const pct = Math.round((e.framesDone / e.framesTotal) * 100);
    parts.push(`<div class="hint">Render (${e.format}): frame ${e.framesDone}/${e.framesTotal}</div>`);
    parts.push(`<div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`);
  }
  for (const o of outputs) {
    parts.push(`<div class="hint">Output: ${o.path}</div>`);
  }
  if (jobError) {
    parts.push(`<div class="finding fail">${jobError.message}</div>`);
  }
  if (done) {
    parts.push(`<div class="finding info">Done. Video ready in videos/${done.slug}/out/</div>`);
  }
  return parts.join("\n");
}

$("generateBtn").addEventListener("click", async () => {
  const theme = $("theme").value.trim();
  if (!theme) {
    alert("Enter a theme first.");
    return;
  }
  let manualMetadata = undefined;
  const metaText = $("metadataJson").value.trim();
  if (metaText) {
    try {
      manualMetadata = JSON.parse(metaText);
      $("metadataStatus").textContent = "";
    } catch (e) {
      $("metadataStatus").textContent = "Metadata JSON is invalid — fix it before generating, or leave it blank.";
      return;
    }
  }

  $("generateBtn").disabled = true;
  renderProgress("Starting...");

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme,
        targetDurationSeconds: Number($("duration").value) || 900,
        format: $("format").value,
        musicPath: $("musicPath").value.trim() || undefined,
        scriptText: $("scriptText").value.trim() || undefined,
        skipInspection: $("skipInspection").checked,
        manualMetadata,
      }),
    });
    const { jobId, error } = await res.json();
    if (error) {
      renderProgress(`<div class="finding fail">${error}</div>`);
      $("generateBtn").disabled = false;
      return;
    }

    const events = [];
    const source = new EventSource(`/api/jobs/${jobId}/stream`);
    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      events.push(event);
      renderProgress(progressHTML(events));
      if (event.type === "done" || event.type === "job-error") {
        source.close();
        $("generateBtn").disabled = false;
        if (event.type === "done") loadVideos();
      }
    };
    source.onerror = () => {
      source.close();
      $("generateBtn").disabled = false;
    };
  } catch (e) {
    renderProgress(`<div class="finding fail">Request failed: ${e}</div>`);
    $("generateBtn").disabled = false;
  }
});

async function loadVideos() {
  const gallery = $("videoGallery");
  try {
    const res = await fetch("/api/videos");
    const videos = await res.json();
    if (videos.length === 0) {
      gallery.innerHTML = `<div class="empty">No videos generated yet.</div>`;
      return;
    }
    gallery.innerHTML = videos
      .map(
        (v) => `
      <div class="video-tile">
        <h3>${v.theme}</h3>
        ${v.videos
          .map(
            (f) => `<video controls preload="none" src="${f.url}"></video><a href="${f.url}" download>${f.name}</a>`
          )
          .join("")}
        ${v.metadataUrl ? `<a href="${v.metadataUrl}" target="_blank">metadata.txt</a>` : ""}
      </div>`
      )
      .join("");
  } catch (e) {
    gallery.innerHTML = `<div class="empty">Couldn't load videos: ${e}</div>`;
  }
}

loadVideos();

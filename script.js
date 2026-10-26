
"use strict";

/* =========================================================
   LazyDesk AI — Local-first productivity assistant
   AI backend: Ollama running on your own computer
   ========================================================= */

const OLLAMA_DEFAULT_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:3b";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
    ollamaUrl: OLLAMA_DEFAULT_URL,
    model: DEFAULT_MODEL,
    connected: false,
    tasks: [],
    files: [],
    summary: "",
    brief: ""
};

let toastTimer;

/* ---------- Safe helpers ---------- */

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showToast(message, type = "") {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = "toast show" + (type ? " " + type : "");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.className = "toast";
    }, 3200);
}

function setBusy(button, busy, busyText = "Working...") {
    if (!button) return;

    if (busy) {
        button.dataset.originalText = button.textContent;
        button.textContent = busyText;
        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

function setResult(element, content, isHTML = false) {
    if (!element) return;
    if (isHTML) element.innerHTML = content;
    else element.textContent = content;
}

function downloadText(filename, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(content) {
    try {
        await navigator.clipboard.writeText(content);
        showToast("Copied to clipboard.", "success");
    } catch {
        const area = document.createElement("textarea");
        area.value = content;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();

        const copied = document.execCommand("copy");
        area.remove();

        showToast(
            copied ? "Copied to clipboard." : "Copy failed. Please select the text manually.",
            copied ? "success" : "error"
        );
    }
}

/* ---------- Navigation ---------- */

function openPage(pageName) {
    const pages = $$(".page");
    const links = $$(".nav-link");

    pages.forEach((page) => {
        page.classList.toggle("active", page.id === `page-${pageName}`);
    });

    links.forEach((link) => {
        const active = link.dataset.page === pageName;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });

    const activeLink = links.find(
        (link) => link.dataset.page === pageName
    );

    const title = activeLink
        ? activeLink.textContent.trim()
        : "Dashboard";

    const breadcrumb = $("#breadcrumbTitle");
    if (breadcrumb) breadcrumb.textContent = title;

    $("#sidebar")?.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

$$(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
        openPage(link.dataset.page || "dashboard");
    });
});

$("#menuToggle")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
});

document.addEventListener("click", (event) => {
    const sidebar = $("#sidebar");
    const menuToggle = $("#menuToggle");

    if (
        window.innerWidth <= 850 &&
        sidebar?.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        !menuToggle?.contains(event.target)
    ) {
        sidebar.classList.remove("open");
    }
});

$$("[data-open-page]").forEach((button) => {
    button.addEventListener("click", () => {
        openPage(button.dataset.openPage);
    });
});

/* ---------- Theme ---------- */

function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    const button = $("#themeToggle");

    if (button) {
        button.textContent = dark ? "☀️" : "🌙";
        button.title = dark ? "Switch to light theme" : "Switch to dark theme";
        button.setAttribute("aria-label", button.title);
    }
}

try {
    applyTheme(localStorage.getItem("lazydesk-theme") === "dark");
} catch {
    applyTheme(false);
}

$("#themeToggle")?.addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    applyTheme(dark);

    try {
        localStorage.setItem("lazydesk-theme", dark ? "dark" : "light");
    } catch {
        // Theme still works for the current page.
    }
});

/* ---------- Ollama connection ---------- */

function normaliseBaseUrl(value) {
    return String(value || OLLAMA_DEFAULT_URL).trim().replace(/\/+$/, "");
}

function updateConnectionUI(connected, message = "") {
    state.connected = connected;

    const status = $("#connectionStatus");
    const dot = $("#modelDot");
    const modelStatus = $("#modelStatus");
    const modelName = $("#modelName");

    if (status) {
        status.textContent = message || (connected ? "Ollama connected" : "Ollama offline");
    }

    if (dot) {
        dot.style.background = connected ? "#16865b" : "#e2a33a";
    }

    if (modelStatus) {
        modelStatus.textContent = connected ? "Connected" : "Not connected";
    }

    if (modelName) {
        modelName.textContent = state.model;
    }
}

async function ollamaRequest(path, options = {}) {
    const url = normaliseBaseUrl(state.ollamaUrl) + path;

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(
            `Ollama returned HTTP ${response.status}` +
            (details ? `: ${details.slice(0, 180)}` : "")
        );
    }

    return response.json();
}

async function checkOllama({ quiet = false } = {}) {
    const urlInput = $("#ollamaUrl");
    const modelSelect = $("#modelSelect");

    state.ollamaUrl = normaliseBaseUrl(
        urlInput?.value || state.ollamaUrl
    );

    if (modelSelect?.value) {
        state.model = modelSelect.value;
    }

    try {
        const data = await ollamaRequest("/api/tags");
        const models = Array.isArray(data.models) ? data.models : [];

        updateConnectionUI(true);

        if (modelSelect) {
            const previous = state.model;
            modelSelect.replaceChildren();

            models.forEach((model) => {
                const option = document.createElement("option");
                option.value = model.name;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });

            if (models.length) {
                const match = models.find((model) => model.name === previous);
                modelSelect.value = match ? match.name : models[0].name;
                state.model = modelSelect.value;
            } else {
                const option = document.createElement("option");
                option.value = DEFAULT_MODEL;
                option.textContent = DEFAULT_MODEL + " (not installed)";
                modelSelect.appendChild(option);
                state.model = DEFAULT_MODEL;
            }
        }

        if (!quiet) {
            if (models.length) {
                showToast(`Connected. Found ${models.length} local model(s).`, "success");
            } else {
                showToast("Ollama is running, but no models are installed.", "error");
            }
        }

        return models;
    } catch (error) {
        updateConnectionUI(false);

        if (!quiet) {
            showToast(
                "Cannot connect to Ollama. Start Ollama and check its URL/CORS settings.",
                "error"
            );
        }

        console.error("Ollama connection error:", error);
        return null;
    }
}

async function askAI(prompt, systemPrompt = "You are LazyDesk AI, a helpful productivity assistant. Be clear, practical, and concise.") {
    const data = await ollamaRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({
            model: state.model || DEFAULT_MODEL,
            stream: false,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            options: { temperature: 0.3 }
        })
    });

    const answer = data?.message?.content?.trim();
    if (!answer) throw new Error("The model returned an empty response.");
    return answer;
}

$("#testConnectionBtn")?.addEventListener("click", async () => {
    const button = $("#testConnectionBtn");
    setBusy(button, true, "Checking...");
    await checkOllama();
    setBusy(button, false);
});

$("#saveSettingsBtn")?.addEventListener("click", async () => {
    const urlInput = $("#ollamaUrl");
    const modelSelect = $("#modelSelect");

    state.ollamaUrl = normaliseBaseUrl(
        urlInput?.value || OLLAMA_DEFAULT_URL
    );

    if (modelSelect?.value) state.model = modelSelect.value;

    try {
        localStorage.setItem("lazydesk-ollama-url", state.ollamaUrl);
        localStorage.setItem("lazydesk-ollama-model", state.model);
    } catch {
        // Settings still apply for this session.
    }

    const message = $("#setupMessage");
    if (message) message.textContent = "Settings saved for this session.";

    await checkOllama();
});

/* ---------- Smart Summary ---------- */

const summaryInput = $("#summaryInput");
const summaryCount = $("#summaryCharCount");

function updateSummaryCount() {
    if (summaryCount) {
        summaryCount.textContent = `${summaryInput?.value.length || 0} characters`;
    }
}

summaryInput?.addEventListener("input", updateSummaryCount);

$("#summarySample")?.addEventListener("click", () => {
    if (!summaryInput) return;

    summaryInput.value =
        "Our team discussed the upcoming project launch. The design needs to be finished by Wednesday, testing should begin on Thursday, and the final review is planned for Friday. Priya will complete the interface, Rahul will test the main features, and I will prepare the presentation. We should report any major problems in the team channel before the review.";

    updateSummaryCount();
});

$("#clearSummary")?.addEventListener("click", () => {
    if (summaryInput) summaryInput.value = "";
    state.summary = "";
    updateSummaryCount();

    setResult(
        $("#summaryResult"),
        "Your summary will appear here after you submit some text."
    );
});

$("#summarizeBtn")?.addEventListener("click", async () => {
    const text = summaryInput?.value.trim();
    if (!text) {
        showToast("Paste some text first.", "error");
        return;
    }

    const button = $("#summarizeBtn");
    setBusy(button, true, "Summarising...");

    try {
        const answer = await askAI(
            `Summarise the following text in simple language. Provide:
1. A short overview.
2. The most important points.
3. Any deadlines, decisions, or action items explicitly mentioned.
Do not invent facts.

TEXT:
${text}`,
            "You are a careful summarisation assistant. Preserve names, dates, facts, and uncertainty. Do not add information that is not in the source."
        );

        state.summary = answer;
        setResult($("#summaryResult"), answer);
        showToast("Summary generated.", "success");
    } catch (error) {
        setResult(
            $("#summaryResult"),
            `Could not generate a summary.\n\n${error.message}\n\nCheck that Ollama is running, the selected model is installed, and the browser is allowed to connect to it.`
        );
        showToast("Summary generation failed.", "error");
    } finally {
        setBusy(button, false);
    }
});

$("#copySummary")?.addEventListener("click", () => {
    if (!state.summary) {
        showToast("Generate a summary first.", "error");
        return;
    }
    copyText(state.summary);
});

$("#downloadSummary")?.addEventListener("click", () => {
    if (!state.summary) {
        showToast("Generate a summary first.", "error");
        return;
    }
    downloadText("lazydesk-summary.txt", state.summary);
});

/* ---------- Auto Task Maker ---------- */

function renderTasks() {
    const container = $("#taskResults");
    if (!container) return;

    if (!state.tasks.length) {
        container.innerHTML =
            '<div class="empty-state"><div class="empty-icon">✓</div><p>Your generated tasks will appear here.</p></div>';
    } else {
        container.replaceChildren();

        state.tasks.forEach((task, index) => {
            const item = document.createElement("div");
            item.className = "task-item" + (task.done ? " done" : "");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = task.done;
            checkbox.setAttribute("aria-label", "Mark task complete");
            checkbox.addEventListener("change", () => {
                task.done = checkbox.checked;
                renderTasks();
            });

            const content = document.createElement("div");
            content.className = "task-item-content";

            const title = document.createElement("div");
            title.className = "task-title";
            title.textContent = task.title;

            const detail = document.createElement("p");
            detail.textContent = task.detail || "Generated from your notes.";

            const meta = document.createElement("div");
            meta.className = "task-meta";

            const badge = document.createElement("span");
            badge.className = "badge";
            badge.textContent = task.priority || "Normal";
            meta.appendChild(badge);

            content.append(title, detail, meta);

            const remove = document.createElement("button");
            remove.className = "task-delete";
            remove.type = "button";
            remove.textContent = "×";
            remove.title = "Delete task";
            remove.setAttribute("aria-label", `Delete task ${index + 1}`);
            remove.addEventListener("click", () => {
                state.tasks.splice(index, 1);
                renderTasks();
            });

            item.append(checkbox, content, remove);
            container.appendChild(item);
        });
    }

    const count = $("#taskCount");
    if (count) {
        const remaining = state.tasks.filter((task) => !task.done).length;
        count.textContent = `${remaining} remaining`;
    }

    const dashboardTasks = $("#dashboardTasks");
    if (dashboardTasks) {
        dashboardTasks.textContent = String(
            state.tasks.filter((task) => !task.done).length
        );
    }
}

function parseTasks(answer) {
    return answer
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && /^(\d+[.)]\s*|[-*•]\s*|\[[ xX]\]\s*)/.test(line))
        .map((line) => {
            const title = line
                .replace(/^(\d+[.)]\s*|[-*•]\s*|\[[ xX]\]\s*)/, "")
                .trim();

            return {
                title: title || "Review generated task",
                detail: "Generated from your notes.",
                priority: /urgent|asap|immediately|critical/i.test(title)
                    ? "High priority"
                    : "Normal",
                done: false
            };
        });
}

$("#generateTasksBtn")?.addEventListener("click", async () => {
    const input = $("#taskInput");
    const text = input?.value.trim();

    if (!text) {
        showToast("Enter your notes or plans first.", "error");
        return;
    }

    const button = $("#generateTasksBtn");
    setBusy(button, true, "Creating tasks...");

    try {
        const answer = await askAI(
            `Turn these notes into a practical task checklist.
Return only a numbered list, one task per line.
Keep each task specific and concise. Include deadlines only when stated in the notes.
Do not invent owners or deadlines.

NOTES:
${text}`,
            "You convert notes into clear action items. Never invent deadlines, people, or commitments."
        );

        const parsed = parseTasks(answer);

        if (parsed.length) {
            state.tasks = [...state.tasks, ...parsed];
            renderTasks();
            showToast(`${parsed.length} task(s) created.`, "success");
        } else {
            setResult($("#taskResults"), answer);
            showToast("The model returned text, but no checklist was detected.", "error");
        }
    } catch (error) {
        showToast(`Task generation failed: ${error.message}`, "error");
    } finally {
        setBusy(button, false);
    }
});

$("#clearTaskInput")?.addEventListener("click", () => {
    if ($("#taskInput")) $("#taskInput").value = "";
});

$("#exportTasks")?.addEventListener("click", () => {
    if (!state.tasks.length) {
        showToast("There are no tasks to export.", "error");
        return;
    }

    const text = state.tasks.map((task, index) => {
        return `${index + 1}. [${task.done ? "x" : " "}] ${task.title}`;
    }).join("\n");

    downloadText("lazydesk-tasks.txt", text);
});

/* ---------- File Organizer Suggestions ---------- */

const fileInput = $("#fileInput");
const dropZone = $("#fileDropZone");

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function suggestFileName(fileName) {
    const lastDot = fileName.lastIndexOf(".");
    const extension = lastDot > 0 ? fileName.slice(lastDot) : "";
    const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;

    const cleaned = base
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_");

    return (cleaned || "untitled") + extension.toLowerCase();
}

function processFiles(fileList) {
    const files = [...fileList];

    if (!files.length) return;

    const maxFiles = 100;
    const selected = files.slice(0, maxFiles);

    state.files = selected.map((file) => ({
        original: file.name,
        suggested: suggestFileName(file.name),
        size: file.size,
        type: file.type || "Unknown type"
    }));

    renderFiles();

    if (files.length > maxFiles) {
        showToast("Only the first 100 files were added.", "error");
    } else {
        showToast("Filename suggestions are ready.", "success");
    }
}

function renderFiles() {
    const container = $("#fileResults");
    if (!container) return;

    if (!state.files.length) {
        container.innerHTML =
            '<div class="empty-state"><div class="empty-icon">📁</div><p>Select files to see suggested filenames. Your files are not uploaded.</p></div>';
        return;
    }

    container.replaceChildren();

    state.files.forEach((file) => {
        const item = document.createElement("div");
        item.className = "file-item";

        const name = document.createElement("div");
        name.className = "file-name";
        name.style.flex = "1";

        const oldName = document.createElement("strong");
        oldName.textContent = file.original;

        const info = document.createElement("small");
        info.textContent = `${formatBytes(file.size)} · ${file.type}`;

        const newName = document.createElement("small");
        newName.textContent = `Suggested: ${file.suggested}`;

        name.append(oldName, info, newName);
        item.appendChild(name);

        if (file.original === file.suggested) {
            const badge = document.createElement("span");
            badge.className = "badge badge-neutral";
            badge.textContent = "Already tidy";
            item.appendChild(badge);
        } else {
            const badge = document.createElement("span");
            badge.className = "badge";
            badge.textContent = "Suggestion";
            item.appendChild(badge);
        }

        container.appendChild(item);
    });
}

fileInput?.addEventListener("change", () => {
    processFiles(fileInput.files || []);
});

if (dropZone) {
    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.classList.remove("dragover");
        processFiles(event.dataTransfer?.files || []);
    });

    dropZone.addEventListener("click", (event) => {
        if (event.target.closest("button, input, a")) return;
        fileInput?.click();
    });

    dropZone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput?.click();
        }
    });
}

$("#exportRenamePlan")?.addEventListener("click", () => {
    if (!state.files.length) {
        showToast("Select some files first.", "error");
        return;
    }

    const lines = [
        "LazyDesk AI — Suggested File Rename Plan",
        "Note: This is a plan only. It does not rename files on your computer.",
        "",
        ...state.files.map((file) =>
            `${file.original}  ->  ${file.suggested}`
        )
    ];

    downloadText("lazydesk-rename-plan.txt", lines.join("\n"));
});

/* ---------- Morning Brief ---------- */

$("#generateBriefBtn")?.addEventListener("click", async () => {
    const button = $("#generateBriefBtn");
    setBusy(button, true, "Preparing brief...");

    const pendingTasks = state.tasks.filter((task) => !task.done);

    const taskText = pendingTasks.length
        ? pendingTasks.map((task, i) => `${i + 1}. ${task.title}`).join("\n")
        : "No pending tasks have been added.";

    const prompt = `Prepare a short, practical productivity brief for today.
Use these sections:
1. Focus for today
2. Suggested priorities
3. First small step
4. Helpful reminder

Pending tasks:
${taskText}

Do not invent appointments, deadlines, or personal calendar events. Clearly base suggestions on the supplied tasks.`;

    try {
        state.brief = await askAI(
            prompt,
            "You are a calm, practical productivity coach. Keep the brief concise, encouraging, and realistic. Never claim access to calendars or data that was not supplied."
        );

        setResult($("#briefResult"), state.brief);
        showToast("Your brief is ready.", "success");
    } catch (error) {
        setResult(
            $("#briefResult"),
            `Could not generate your brief.\n\n${error.message}\n\nCheck your Ollama connection and selected model.`
        );
        showToast("Morning brief failed.", "error");
    } finally {
        setBusy(button, false);
    }
});

/* ---------- Initialisation ---------- */

async function initialise() {
    try {
        const savedUrl = localStorage.getItem("lazydesk-ollama-url");
        const savedModel = localStorage.getItem("lazydesk-ollama-model");

        if (savedUrl) state.ollamaUrl = normaliseBaseUrl(savedUrl);
        if (savedModel) state.model = savedModel;
    } catch {
        // Defaults are fine if localStorage is unavailable.
    }

    if ($("#ollamaUrl")) {
        $("#ollamaUrl").value = state.ollamaUrl;
    }

    if ($("#modelSelect")) {
        const option = document.createElement("option");
        option.value = state.model;
        option.textContent = state.model;
        $("#modelSelect").appendChild(option);
        $("#modelSelect").value = state.model;
    }

    renderTasks();
    renderFiles();
    updateSummaryCount();
    updateConnectionUI(false, "Checking Ollama...");

    // Quiet check avoids showing a popup on initial page load.
    await checkOllama({ quiet: true });
}

initialise();

const adminKey = "tennis-rsvp-admin";
const eventsList = document.getElementById("eventsList");
const emptyState = document.getElementById("emptyState");
const eventForm = document.getElementById("eventForm");
const adminPanel = document.getElementById("adminPanel");
const adminTokenKey = "tennis-rsvp-admin-token";
const adminToggle = document.getElementById("adminToggle");
const resetDemo = document.getElementById("resetDemo");
const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");

const eventIdInput = document.getElementById("eventId");
const eventTitleInput = document.getElementById("eventTitle");
const eventDateInput = document.getElementById("eventDate");
const eventLocationInput = document.getElementById("eventLocation");
const eventNotesInput = document.getElementById("eventNotes");
const eventColorInput = document.getElementById("eventColor");

const template = document.getElementById("eventCardTemplate");

const state = {
  events: [],
  admin: loadAdminMode(),
  rsvpName: "",
};

async function fetchEvents() {
  const response = await fetch("/api/events");
  if (!response.ok) {
    throw new Error("Failed to load events");
  }
  state.events = await response.json();
}

function loadAdminMode() {
  return localStorage.getItem(adminKey) === "true";
}

function saveAdminMode(value) {
  localStorage.setItem(adminKey, String(value));
}
function getAdminToken() {
  return localStorage.getItem(adminTokenKey) || "";
}

function saveAdminToken(token) {
  localStorage.setItem(adminTokenKey, token);
}

function clearAdminToken() {
  localStorage.removeItem(adminTokenKey);
}

function adminHeaders() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleAdminResponse(response) {
  if (response.status === 401) {
    clearAdminToken();
    state.admin = false;
    adminPanel.hidden = true;
    adminToggle.textContent = "Admin mode";
    alert("Admin session expired. Please log in again.");
    return false;
  }
  return response.ok;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isPastEvent(value) {
  if (!value) return false;
  return new Date(value) < new Date();
}

function renderEvents() {
  const filtered = filterEvents();
  eventsList.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((event) => {
    const card = template.content.cloneNode(true);
    const cardRoot = card.querySelector(".event-card");
    const colorBar = card.querySelector(".event-color");
    const title = card.querySelector(".event-title");
    const meta = card.querySelector(".event-meta");
    const notes = card.querySelector(".event-notes");
    const summary = card.querySelector(".rsvp-summary");
    const rsvpNames = card.querySelector(".rsvp-names");
    const buttons = card.querySelectorAll(".rsvp");
    const actions = card.querySelector(".event-actions");

    colorBar.style.background = event.color || "var(--primary)";
    title.textContent = event.title;
    meta.textContent = `${formatDateTime(event.date)}${event.location ? ` · ${event.location}` : ""}`;
    notes.textContent = event.notes || "";

    summary.innerHTML = "";
    const totals = tallyResponses(event.responses || {});
    summary.append(
      createSummaryChip("Yes", totals.yes),
      createSummaryChip("Maybe", totals.maybe),
      createSummaryChip("No", totals.no)
    );

    if (state.admin) {
      rsvpNames.hidden = false;
      rsvpNames.innerHTML = buildRsvpNames(event.responses || {});
    } else {
      rsvpNames.hidden = true;
      rsvpNames.innerHTML = "";
    }

    buttons.forEach((button) => {
      const choice = button.dataset.choice;
      const current = getUserResponse(event);
      button.classList.toggle("active", current === choice);
      button.addEventListener("click", () => handleRsvp(event.id, choice));
    });

    if (state.admin) {
      actions.hidden = false;
      actions.querySelector(".edit").addEventListener("click", () => loadEventIntoForm(event));
      actions.querySelector(".delete").addEventListener("click", () => deleteEvent(event.id));
    }

    if (isPastEvent(event.date)) {
      cardRoot.classList.add("past");
    }

    eventsList.appendChild(cardRoot);
  });
}

function filterEvents() {
  const term = searchInput.value.trim().toLowerCase();
  const status = filterStatus.value;
  return state.events
    .filter((event) => {
      if (!term) return true;
      return (
        event.title.toLowerCase().includes(term) ||
        (event.location || "").toLowerCase().includes(term) ||
        (event.notes || "").toLowerCase().includes(term)
      );
    })
    .filter((event) => {
      if (status === "all") return true;
      const past = isPastEvent(event.date);
      return status === "past" ? past : !past;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function createSummaryChip(label, value) {
  const chip = document.createElement("div");
  chip.className = "summary-chip";
  chip.textContent = `${label}: ${value}`;
  return chip;
}

function tallyResponses(responses) {
  return Object.values(responses).reduce(
    (totals, response) => {
      totals[response] = (totals[response] || 0) + 1;
      return totals;
    },
    { yes: 0, maybe: 0, no: 0 }
  );
}

function buildRsvpNames(responses) {
  const grouped = { yes: [], maybe: [], no: [] };
  Object.entries(responses).forEach(([name, choice]) => {
    if (grouped[choice]) {
      grouped[choice].push(name);
    }
  });

  return [
    renderRsvpGroup("Yes", grouped.yes),
    renderRsvpGroup("Maybe", grouped.maybe),
    renderRsvpGroup("No", grouped.no),
  ].join("");
}

function renderRsvpGroup(label, names) {
  if (!names.length) {
    return `
      <div class="rsvp-group">
        <div class="rsvp-label">${label}</div>
        <div>None yet</div>
      </div>
    `;
  }

  const list = names
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<li class="rsvp-pill">${escapeHtml(name)}</li>`)
    .join("");

  return `
    <div class="rsvp-group">
      <div class="rsvp-label">${label}</div>
      <ul class="rsvp-list">${list}</ul>
    </div>
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function handleRsvp(eventId, choice) {
  const name = promptForName();
  if (!name) return;
  await fetch(`/api/events/${eventId}/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, choice }),
  });
  await refresh();
}

function promptForName() {
  let name = localStorage.getItem("tennis-rsvp-name") || "";
  name = window.prompt("Your name for RSVP:", name || "");
  if (!name) return "";
  localStorage.setItem("tennis-rsvp-name", name.trim());
  return name.trim();
}

function getUserResponse(event) {
  const name = localStorage.getItem("tennis-rsvp-name") || "";
  if (!name || !event.responses) return "";
  return event.responses[name] || "";
}

function loadEventIntoForm(event) {
  eventIdInput.value = event.id;
  eventTitleInput.value = event.title;
  eventDateInput.value = event.date;
  eventLocationInput.value = event.location || "";
  eventNotesInput.value = event.notes || "";
  eventColorInput.value = event.color || "#1f7aec";
  adminPanel.scrollIntoView({ behavior: "smooth" });
}

async function deleteEvent(eventId) {
  if (!confirm("Delete this event?")) return;
  const response = await fetch(`/api/events/${eventId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!(await handleAdminResponse(response))) return;
  await refresh();
}

function clearForm() {
  eventIdInput.value = "";
  eventForm.reset();
  eventColorInput.value = "#1f7aec";
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const payload = {
    id: eventIdInput.value || crypto.randomUUID(),
    title: eventTitleInput.value.trim(),
    date: eventDateInput.value,
    location: eventLocationInput.value.trim(),
    notes: eventNotesInput.value.trim(),
    color: eventColorInput.value,
  };

  if (!payload.title || !payload.date) {
    return;
  }

  if (eventIdInput.value) {
    const response = await fetch(`/api/events/${payload.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(payload),
    });
    if (!(await handleAdminResponse(response))) return;
  } else {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(payload),
    });
    if (!(await handleAdminResponse(response))) return;
  }

  clearForm();
  await refresh();
}

function toggleAdminMode() {
  state.admin = !state.admin;
  adminPanel.hidden = !state.admin;
  saveAdminMode(state.admin);
  adminToggle.textContent = state.admin ? "Exit admin" : "Admin mode";
  renderEvents();
}

async function loadDemoData() {
  const demo = [
    {
      id: crypto.randomUUID(),
      title: "Weekly Tennis",
      date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      location: "City Courts",
      notes: "Bring a can of balls.",
      color: "#1f7aec",
    },
    {
      id: crypto.randomUUID(),
      title: "Doubles Night",
      date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 16),
      location: "Westside Park",
      notes: "We need 8 people for two courts.",
      color: "#f97316",
    },
  ];

  for (const event of demo) {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(event),
    });
    if (!(await handleAdminResponse(response))) return;
  }
  await refresh();
}

async function refresh() {
  try {
    await fetchEvents();
    renderEvents();
  } catch (error) {
    eventsList.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "Unable to load events. Is the server running?";
  }
}

async function ensureAdminLogin() {
  if (getAdminToken()) {
    return true;
  }
  const username = window.prompt("Admin username:", "");
  if (!username) return false;
  const password = window.prompt("Admin password:", "");
  if (!password) return false;
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    alert("Invalid admin credentials.");
    return false;
  }
  const data = await response.json();
  saveAdminToken(data.token);
  return true;
}

function init() {
  adminPanel.hidden = !state.admin;
  adminToggle.textContent = state.admin ? "Exit admin" : "Admin mode";

  eventForm.addEventListener("submit", handleFormSubmit);
  document.getElementById("clearForm").addEventListener("click", clearForm);
  adminToggle.addEventListener("click", async () => {
    if (!state.admin) {
      const ok = await ensureAdminLogin();
      if (!ok) return;
    } else {
      clearAdminToken();
    }
    toggleAdminMode();
  });
  resetDemo.addEventListener("click", loadDemoData);
  searchInput.addEventListener("input", renderEvents);
  filterStatus.addEventListener("change", renderEvents);

  refresh();
}

init();

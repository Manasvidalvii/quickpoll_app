const API_URL = "https://quickpoll-app-0iep.onrender.com/api/polls";
const activeCharts = {}; 
const openChartPollIds = new Set();

document.addEventListener("DOMContentLoaded", () => {
  setupDarkMode();
  setupDynamicOptions();

  // CHECK IF URL HAS A SPECIFIC POLL ID (e.g. index.html?id=12345)
  const urlParams = new URLSearchParams(window.location.search);
  const singlePollId = urlParams.get("id");

  const pollFormContainer = document.getElementById("pollForm")?.parentElement;

  if (singlePollId) {
    // Hide the "Create Poll" card if someone is viewing a single poll link
    if (pollFormContainer) pollFormContainer.style.display = "none";
    
    // Add a "Create Your Own Poll" button at top
    const header = document.querySelector("header");
    if (header) {
      const createNewBtn = document.createElement("a");
      createNewBtn.href = window.location.pathname; // Reloads cleanly without ?id=
      createNewBtn.className = "bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition";
      createNewBtn.innerText = "➕ Create New Poll";
      header.appendChild(createNewBtn);
    }

    fetchSinglePoll(singlePollId);
  } else {
    // Normal mode: setup create form and fetch all polls
    setupPollForm();
    fetchPolls();
  }
});

function setupPollForm() {
  const pollForm = document.getElementById("pollForm");
  if (!pollForm) return;

  pollForm.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
  });

  pollForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const question = document.getElementById("question").value;
    const durationMinutes = parseInt(document.getElementById("duration").value);
    const textInputs = document.querySelectorAll(".option-text");

    const options = Array.from(textInputs)
      .map((input) => input.value.trim())
      .filter((text) => text !== "");

    if (options.length < 2) return alert("Please fill out at least 2 options!");

    const payload = { question, options, durationMinutes };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        pollForm.reset();
        resetOptionFields();
        fetchPolls();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to create poll.");
      }
    } catch (err) {
      console.error("Error submitting poll:", err);
    }
  });
}

// --- FETCH ALL vs SINGLE POLL ---
async function fetchPolls() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return;
    const polls = await res.json();
    if (Array.isArray(polls)) renderPolls(polls);
  } catch (error) {
    console.error("Error fetching polls:", error);
  }
}

async function fetchSinglePoll(pollId) {
  try {
    const res = await fetch(`${API_URL}/${pollId}`);
    if (!res.ok) {
      document.getElementById("pollsList").innerHTML = '<p class="text-center text-red-500 py-4 font-semibold">Poll not found or deleted.</p>';
      return;
    }
    const poll = await res.json();
    renderPolls([poll]); // Render just this single poll
  } catch (error) {
    console.error("Error fetching single poll:", error);
  }
}

// --- RENDER POLLS ---
function renderPolls(polls) {
  const pollsList = document.getElementById("pollsList");
  if (!pollsList) return;

  if (!Array.isArray(polls) || polls.length === 0) {
    pollsList.innerHTML = '<p class="text-center text-gray-400 py-4">No polls available.</p>';
    return;
  }

  pollsList.innerHTML = "";

  polls.forEach((poll) => {
    const isExpired = poll.expiresAt && new Date(poll.expiresAt) < new Date();
    
    // Generate Direct Shareable Link for THIS specific poll
    const currentBaseUrl = window.location.origin + window.location.pathname;
    const shareablePollUrl = `${currentBaseUrl}?id=${poll._id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(shareablePollUrl)}`;

    const createdDate = poll.createdAt 
      ? new Date(poll.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) 
      : "Unknown date";

    const isChartOpen = openChartPollIds.has(poll._id);

    const card = document.createElement("div");
    card.className = "bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4 relative";

    let statusHeader = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-xl font-bold">${poll.question}</h3>
          <div class="flex items-center gap-2 mt-1">
            ${
              isExpired
                ? `<span class="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-xs font-bold px-2.5 py-0.5 rounded">🔴 EXPIRED</span>`
                : poll.expiresAt
                ? `<span class="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400 text-xs font-bold px-2.5 py-0.5 rounded">⏱️ Active Timer</span>`
                : `<span class="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 text-xs font-bold px-2.5 py-0.5 rounded">♾️ Open</span>`
            }
            <span class="text-xs text-gray-400 font-medium">📅 ${createdDate}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button 
            onclick="deletePoll('${poll._id}')" 
            class="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg transition-all text-sm font-semibold flex items-center gap-1 border border-red-200 dark:border-red-800"
            title="Delete Poll"
          >
            🗑️ Delete
          </button>
          <img src="${qrCodeUrl}" alt="QR Code" class="w-16 h-16 border dark:border-gray-700 p-1 rounded" title="Scan to Share Poll" />
        </div>
      </div>
    `;

    let optionsHTML = (poll.options || [])
      .map((opt) => {
        const percentage = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
        return `
          <div 
            onclick="${!isExpired ? `castVote('${poll._id}', '${opt._id}')` : ''}" 
            class="p-3 border dark:border-gray-700 rounded-lg ${!isExpired ? 'cursor-pointer hover:border-blue-500' : 'cursor-not-allowed'} transition-all relative overflow-hidden bg-gray-50 dark:bg-gray-700/50"
          >
            <div class="flex justify-between font-semibold text-sm z-10 relative">
              <span>${opt.text}</span>
              <span>${opt.votes} votes (${percentage}%)</span>
            </div>
            <div class="absolute top-0 left-0 bottom-0 bg-blue-100 dark:bg-blue-900/40 -z-0 transition-all duration-500" style="width: ${percentage}%"></div>
          </div>
        `;
      })
      .join("");

    card.innerHTML = `
      ${statusHeader}
      <div class="space-y-3">${optionsHTML}</div>
      
      <!-- SHARE LINK BAR -->
      <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-xs">
        <span class="text-gray-400 font-bold">🔗 Share:</span>
        <input type="text" readonly value="${shareablePollUrl}" class="bg-transparent w-full font-mono text-gray-600 dark:text-gray-300 focus:outline-none" />
        <button onclick="copyShareLink('${shareablePollUrl}', this)" class="bg-blue-500 text-white font-bold px-2 py-1 rounded hover:bg-blue-600 shrink-0">Copy</button>
      </div>

      <div class="flex justify-between items-center mt-2 pt-2 border-t dark:border-gray-700">
        <p class="text-xs text-gray-400">Total Votes: ${poll.totalVotes || 0}</p>
        <button onclick="toggleChart('${poll._id}')" class="text-xs text-blue-500 font-bold hover:underline">📊 Toggle Chart View</button>
      </div>
      <div id="chartContainer-${poll._id}" class="${isChartOpen ? '' : 'hidden'} mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
        <canvas id="chart-${poll._id}"></canvas>
      </div>
    `;

    pollsList.appendChild(card);

    if (isChartOpen) renderChartInstance(poll);
  });
}

// --- COPY LINK HELPER ---
function copyShareLink(url, btn) {
  navigator.clipboard.writeText(url);
  const originalText = btn.innerText;
  btn.innerText = "Copied! ✅";
  btn.classList.replace("bg-blue-500", "bg-green-500");
  setTimeout(() => {
    btn.innerText = originalText;
    btn.classList.replace("bg-green-500", "bg-blue-500");
  }, 2000);
}

// --- DYNAMIC OPTION INPUT LOGIC ---
function setupDynamicOptions() {
  const addBtn = document.getElementById("addOptionBtn");
  const container = document.getElementById("choiceOptionsContainer");

  if (addBtn && container) {
    addBtn.addEventListener("click", () => {
      const optionCount = container.querySelectorAll(".option-row").length + 1;
      if (optionCount > 10) return alert("Maximum 10 options allowed!");

      const row = document.createElement("div");
      row.className = "flex gap-2 option-row";
      row.innerHTML = `
        <input type="text" class="option-text w-full p-3 border dark:border-gray-700 dark:bg-gray-700 rounded-lg" placeholder="Option ${optionCount} Text" required />
        <button type="button" onclick="removeOption(this)" class="px-3 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-lg font-bold hover:bg-red-200">✕</button>
      `;
      container.appendChild(row);
    });
  }
}

function removeOption(btn) {
  const container = document.getElementById("choiceOptionsContainer");
  if (container.querySelectorAll(".option-row").length <= 2) {
    return alert("A poll must have at least 2 options!");
  }
  btn.parentElement.remove();
}

function resetOptionFields() {
  const container = document.getElementById("choiceOptionsContainer");
  if (!container) return;
  container.innerHTML = `
    <div class="flex gap-2 option-row">
      <input type="text" class="option-text w-full p-3 border dark:border-gray-700 dark:bg-gray-700 rounded-lg" placeholder="Option 1 Text" required />
    </div>
    <div class="flex gap-2 option-row">
      <input type="text" class="option-text w-full p-3 border dark:border-gray-700 dark:bg-gray-700 rounded-lg" placeholder="Option 2 Text" required />
    </div>
  `;
}

// --- DARK MODE LOGIC ---
function setupDarkMode() {
  const toggleBtn = document.getElementById("themeToggle");
  if (!toggleBtn) return;

  if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
    toggleBtn.textContent = "☀️";
  } else {
    document.documentElement.classList.remove("dark");
    toggleBtn.textContent = "🌙";
  }

  toggleBtn.addEventListener("click", () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
      toggleBtn.textContent = "🌙";
    } else {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
      toggleBtn.textContent = "☀️";
    }
  });
}

// --- CHART TOGGLE & RENDER LOGIC ---
function toggleChart(pollId) {
  if (openChartPollIds.has(pollId)) {
    openChartPollIds.delete(pollId);
    if (activeCharts[pollId]) {
      activeCharts[pollId].destroy();
      delete activeCharts[pollId];
    }
  } else {
    openChartPollIds.add(pollId);
  }
  const urlParams = new URLSearchParams(window.location.search);
  const singlePollId = urlParams.get("id");
  if (singlePollId) fetchSinglePoll(singlePollId);
  else fetchPolls();
}

function renderChartInstance(poll) {
  const canvas = document.getElementById(`chart-${poll._id}`);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (activeCharts[poll._id]) activeCharts[poll._id].destroy();

  activeCharts[poll._id] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: poll.options.map((o) => o.text),
      datasets: [{
        label: "Votes",
        data: poll.options.map((o) => o.votes),
        backgroundColor: "rgba(59, 130, 246, 0.6)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// --- VOTE & DELETE ---
async function castVote(pollId, optionId) {
  try {
    const res = await fetch(`${API_URL}/${pollId}/vote`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId })
    });
    const data = await res.json();
    if (!res.ok) alert(data.message);
    else {
      const urlParams = new URLSearchParams(window.location.search);
      const singlePollId = urlParams.get("id");
      if (singlePollId) fetchSinglePoll(singlePollId);
      else fetchPolls();
    }
  } catch (err) {
    console.error("Error casting vote:", err);
  }
}

async function deletePoll(pollId) {
  if (!confirm("Are you sure you want to delete this poll?")) return;
  try {
    const res = await fetch(`${API_URL}/${pollId}`, { method: "DELETE" });
    if (res.ok) {
      window.location.href = window.location.pathname; // Reset to main page
    } else {
      const data = await res.json();
      alert(data.message || "Failed to delete poll.");
    }
  } catch (err) {
    console.error("Error deleting poll:", err);
  }
}

// Background auto-refresh
setInterval(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const singlePollId = urlParams.get("id");
  if (singlePollId) fetchSinglePoll(singlePollId);
  else fetchPolls();
}, 3000);
const COLORS = [
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange"
];

const AUTOSAVE_KEY = "ctb.webapp.autosave.v1";
const THEME_KEY = "ctb.webapp.theme";

const state = {
  snapshot: {
    version: 1,
    generatedAt: new Date().toISOString(),
    groups: [],
    tabs: []
  },
  windows: [],
  lastMovedId: null,
  lastMovedAt: 0
};

let autosaveTimer = null;
let maxWindowId = 0;
let maxGroupNumeric = 0;
let isDragging = false;
let showDuplicatesOnly = false;
let dragState = {
  tabId: null,
  windowId: null,
  groupId: null,
  index: 0,
  placeholder: null
};

const statusEl = document.getElementById("status");
const workspaceEl = document.getElementById("workspace");
const tooltipEl = document.getElementById("tooltip");
const tooltipTitleEl = tooltipEl.querySelector(".tooltip-title");
const tooltipUrlEl = tooltipEl.querySelector(".tooltip-url");
const overallCountEl = document.getElementById("overall-count");
const importInput = document.getElementById("import-json");
const exportButton = document.getElementById("export-json");
const toggleDuplicatesButton = document.getElementById("toggle-duplicates");
const clearAutosaveButton = document.getElementById("clear-autosave");
const searchTitleInput = document.getElementById("search-title");
const searchUrlInput = document.getElementById("search-url");
const themeToggleButton = document.getElementById("theme-toggle");

const windowTemplate = document.getElementById("window-template");
const addWindowTemplate = document.getElementById("add-window-template");
const groupTemplate = document.getElementById("group-template");
const tabTemplate = document.getElementById("tab-template");

function setStatus(message) {
  statusEl.textContent = message || "";
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    themeToggleButton.classList.remove("theme-dark");
    themeToggleButton.classList.add("theme-light");
    themeToggleButton.innerHTML = `
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z" stroke="currentColor" stroke-width="1.4" fill="none" />
          <path d="M10 6.2V5M10 15v-1.2M6.2 10H5M15 10h-1.2M7.1 7.1l-.8-.8M13.7 13.7l-.8-.8M12.9 7.1l.8-.8M7.1 12.9l-.8.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
        </svg>
      </span>
    `;
  } else {
    root.setAttribute("data-theme", "light");
    themeToggleButton.classList.remove("theme-light");
    themeToggleButton.classList.add("theme-dark");
    themeToggleButton.innerHTML = `
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M14.5 12.9A6.5 6.5 0 117.1 5.5a5 5 0 007.4 7.4z" stroke="currentColor" stroke-width="1.4" fill="none" />
        </svg>
      </span>
    `;
  }
  localStorage.setItem(THEME_KEY, theme);
}

function normalizeSearchValue(value) {
  return (value || "").toString().trim().toLowerCase();
}

function getDuplicateUrlSet() {
  const counts = new Map();
  for (const tab of state.snapshot.tabs) {
    if (!tab.url) continue;
    const key = tab.url;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicates = new Set();
  for (const [key, count] of counts.entries()) {
    if (count > 1) duplicates.add(key);
  }
  return duplicates;
}

function matchWithMode(rawNeedle, haystack) {
  if (!rawNeedle) return true;
  if (!haystack) return false;
  if (rawNeedle.startsWith("'")) {
    let exact = rawNeedle.slice(1);
    if (exact.endsWith("'")) {
      exact = exact.slice(0, -1);
    }
    return exact.length === 0 ? true : haystack.includes(exact);
  }
  let i = 0;
  let j = 0;
  while (i < rawNeedle.length && j < haystack.length) {
    if (rawNeedle[i] === haystack[j]) {
      i += 1;
    }
    j += 1;
  }
  return i === rawNeedle.length;
}

function tabMatchesSearch(tab) {
  const titleNeedle = normalizeSearchValue(searchTitleInput.value);
  const urlNeedle = normalizeSearchValue(searchUrlInput.value);
  if (!titleNeedle && !urlNeedle) return true;
  const titleHay = normalizeSearchValue(tab.title || tab.url || "");
  const urlHay = normalizeSearchValue(tab.url || "");
  const titleOk = matchWithMode(titleNeedle, titleHay);
  const urlOk = matchWithMode(urlNeedle, urlHay);
  return titleOk && urlOk;
}

function tabPassesFilters(tab, duplicateSet) {
  if (showDuplicatesOnly) {
    if (!duplicateSet || !duplicateSet.has(tab.url)) return false;
  }
  return tabMatchesSearch(tab);
}

function showTooltipForTab(tabNode, anchorRect) {
  if (!tabNode) return;
  const title = tabNode.dataset.fullTitle || "";
  const url = tabNode.dataset.fullUrl || "";
  if (!title && !url) return;
  tooltipTitleEl.textContent = title;
  tooltipUrlEl.textContent = url;
  const left = Math.min(anchorRect.left, window.innerWidth - 460);
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `0px`;
  tooltipEl.style.visibility = "hidden";
  tooltipEl.classList.add("visible");
  const height = tooltipEl.getBoundingClientRect().height;
  const top = Math.max(12, anchorRect.top - height - 8);
  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.visibility = "visible";
  tooltipEl.setAttribute("aria-hidden", "false");
}

function hideTooltip() {
  tooltipEl.classList.remove("visible");
  tooltipEl.setAttribute("aria-hidden", "true");
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const payload = {
      snapshot: state.snapshot,
      windows: state.windows
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    setStatus("Autosaved.");
  }, 400);
}

function computeMaxIds() {
  maxWindowId = 0;
  maxGroupNumeric = 0;
  for (const tab of state.snapshot.tabs) {
    if (Number.isFinite(tab.windowId)) {
      maxWindowId = Math.max(maxWindowId, tab.windowId);
    }
  }
  for (const group of state.snapshot.groups) {
    if (Number.isFinite(group.windowId)) {
      maxWindowId = Math.max(maxWindowId, group.windowId);
    }
    if (typeof group.id === "string") {
      const num = Number.parseInt(group.id.replace("g", ""), 10);
      if (Number.isFinite(num)) {
        maxGroupNumeric = Math.max(maxGroupNumeric, num);
      }
    }
  }
  for (const id of state.windows) {
    if (Number.isFinite(id)) {
      maxWindowId = Math.max(maxWindowId, id);
    }
  }
}

function normalizeSnapshot(snapshot) {
  const normalized = {
    version: 1,
    generatedAt: new Date().toISOString(),
    groups: [],
    tabs: []
  };

  if (snapshot && Array.isArray(snapshot.groups)) {
    normalized.groups = snapshot.groups
      .filter((group) => group && typeof group.id === "string")
      .map((group) => ({
        id: group.id,
        title: typeof group.title === "string" ? group.title : "",
        color: COLORS.includes(group.color) ? group.color : "grey",
        collapsed: Boolean(group.collapsed),
        windowId: Number.isFinite(group.windowId) ? group.windowId : 0
      }));
  }

  const groupsById = new Map(normalized.groups.map((group) => [group.id, group]));

  if (snapshot && Array.isArray(snapshot.tabs)) {
    normalized.tabs = snapshot.tabs
      .filter((tab) => tab && typeof tab.url === "string" && tab.url.length > 0)
      .map((tab) => {
        const windowId = Number.isFinite(tab.windowId) ? tab.windowId : 0;
        const groupId = typeof tab.groupId === "string" ? tab.groupId : null;
        const group = groupId ? groupsById.get(groupId) : null;
        return {
          url: tab.url,
          title: typeof tab.title === "string" ? tab.title : "",
          pinned: Boolean(tab.pinned),
          active: Boolean(tab.active),
          muted: Boolean(tab.muted),
          windowId,
          index: Number.isFinite(tab.index) ? tab.index : 0,
          groupId: group && group.windowId === windowId ? groupId : null
        };
      });
  }

  return normalized;
}

function deriveWindows(snapshot) {
  const ids = new Set();
  for (const tab of snapshot.tabs) {
    if (Number.isFinite(tab.windowId)) ids.add(tab.windowId);
  }
  for (const group of snapshot.groups) {
    if (Number.isFinite(group.windowId)) ids.add(group.windowId);
  }
  return Array.from(ids).sort((a, b) => a - b);
}

function loadSnapshot(snapshot, windows = []) {
  state.snapshot = normalizeSnapshot(snapshot);
  state.windows = windows.length ? windows.slice() : deriveWindows(state.snapshot);
  if (state.windows.length === 0) {
    state.windows = [];
  }
  computeMaxIds();
  assignEditorIds();
  setStatus("Loaded.");
  render();
  scheduleAutosave();
}

function restoreAutosave() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw);
    if (payload && payload.snapshot) {
      loadSnapshot(payload.snapshot, Array.isArray(payload.windows) ? payload.windows : []);
      setStatus("Restored from autosave.");
      return true;
    }
  } catch (error) {
    console.error(error);
  }
  return false;
}

function ensureWindowExists(windowId) {
  if (!state.windows.includes(windowId)) {
    state.windows.push(windowId);
  }
}

function getGroupsForWindow(windowId) {
  return state.snapshot.groups.filter((group) => group.windowId === windowId);
}

function getTabsForGroup(windowId, groupId) {
  const duplicateSet = showDuplicatesOnly ? getDuplicateUrlSet() : null;
  return state.snapshot.tabs
    .filter(
      (tab) =>
        tab.windowId === windowId &&
        tab.groupId === groupId &&
        tabPassesFilters(tab, duplicateSet)
    )
    .sort((a, b) => a.index - b.index);
}

function getUngroupedTabs(windowId) {
  const duplicateSet = showDuplicatesOnly ? getDuplicateUrlSet() : null;
  return state.snapshot.tabs
    .filter(
      (tab) =>
        tab.windowId === windowId &&
        !tab.groupId &&
        tabPassesFilters(tab, duplicateSet)
    )
    .sort((a, b) => a.index - b.index);
}

function reindexGroup(windowId, groupId, orderedTabs) {
  orderedTabs.forEach((tab, index) => {
    tab.windowId = windowId;
    tab.groupId = groupId;
    tab.index = index;
  });
}

function moveTab(tabId, targetWindowId, targetGroupId, targetIndex) {
  const selectedTab = state.snapshot.tabs.find((t) => t._editorId === tabId);
  if (!selectedTab) return;

  const sourceWindowId = selectedTab.windowId;
  const sourceGroupId = selectedTab.groupId;
  const sourceList = sourceGroupId
    ? getTabsForGroup(sourceWindowId, sourceGroupId)
    : getUngroupedTabs(sourceWindowId);
  const targetList = targetGroupId
    ? getTabsForGroup(targetWindowId, targetGroupId)
    : getUngroupedTabs(targetWindowId);

  const filteredSource = sourceList.filter((t) => t !== selectedTab);
  if (sourceWindowId === targetWindowId && sourceGroupId === targetGroupId) {
    const sourceIndex = sourceList.indexOf(selectedTab);
    let adjustedIndex = targetIndex;
    if (sourceIndex !== -1 && sourceIndex < targetIndex) {
      adjustedIndex -= 1;
    }
    adjustedIndex = Math.max(0, Math.min(adjustedIndex, filteredSource.length));
    filteredSource.splice(adjustedIndex, 0, selectedTab);
    reindexGroup(sourceWindowId, sourceGroupId, filteredSource);
  } else {
    reindexGroup(sourceWindowId, sourceGroupId, filteredSource);
    targetList.splice(Math.min(targetIndex, targetList.length), 0, selectedTab);
    reindexGroup(targetWindowId, targetGroupId, targetList);
  }

  scheduleAutosave();
  state.lastMovedId = selectedTab._editorId;
  state.lastMovedAt = Date.now();
  render();

  setTimeout(() => {
    if (state.lastMovedId === selectedTab._editorId && Date.now() - state.lastMovedAt >= 1800) {
      state.lastMovedId = null;
      render();
    }
  }, 1900);
}

function removeTab(tab) {
  const windowId = tab.windowId;
  const groupId = tab.groupId;
  state.snapshot.tabs = state.snapshot.tabs.filter((t) => t !== tab);
  const list = groupId ? getTabsForGroup(windowId, groupId) : getUngroupedTabs(windowId);
  reindexGroup(windowId, groupId, list);
  scheduleAutosave();
  render();
}

function createWindow() {
  maxWindowId += 1;
  state.windows.push(maxWindowId);
  scheduleAutosave();
  render();
}

function deleteWindow(windowId) {
  const windowTabs = state.snapshot.tabs.filter((tab) => tab.windowId === windowId);
  if (windowTabs.length > 0) {
    const confirmDelete = window.confirm(
      `Delete window and close ${windowTabs.length} tab(s)?`
    );
    if (!confirmDelete) return;
  }
  state.windows = state.windows.filter((id) => id !== windowId);
  state.snapshot.groups = state.snapshot.groups.filter((group) => group.windowId !== windowId);
  state.snapshot.tabs = state.snapshot.tabs.filter((tab) => tab.windowId !== windowId);
  scheduleAutosave();
  render();
}

function createGroup(windowId) {
  maxGroupNumeric += 1;
  const group = {
    id: `g${maxGroupNumeric}`,
    title: "New Group",
    color: "grey",
    collapsed: false,
    windowId
  };
  state.snapshot.groups.push(group);
  scheduleAutosave();
  render();
}

function deleteGroup(group) {
  const groupTabs = state.snapshot.tabs.filter((tab) => tab.groupId === group.id);
  if (groupTabs.length > 0) {
    const confirmDelete = window.confirm(
      `Delete group and close ${groupTabs.length} tab(s)?`
    );
    if (!confirmDelete) return;
  }
  state.snapshot.groups = state.snapshot.groups.filter((g) => g !== group);
  state.snapshot.tabs = state.snapshot.tabs.filter((tab) => tab.groupId !== group.id);
  scheduleAutosave();
  render();
}

function updateGroup(group, patch) {
  Object.assign(group, patch);
  scheduleAutosave();
}

function updateTab(tab, patch) {
  Object.assign(tab, patch);
  scheduleAutosave();
}

function buildExportSnapshot() {
  const exportGroups = state.snapshot.groups.map((group) => ({
    id: group.id,
    title: group.title,
    color: group.color,
    collapsed: Boolean(group.collapsed),
    windowId: group.windowId
  }));

  const tabsByWindow = new Map();
  for (const tab of state.snapshot.tabs) {
    if (!tabsByWindow.has(tab.windowId)) tabsByWindow.set(tab.windowId, []);
    tabsByWindow.get(tab.windowId).push(tab);
  }

  const exportTabs = [];
  for (const windowId of state.windows) {
    const windowTabs = tabsByWindow.get(windowId) || [];
    const ungrouped = windowTabs.filter((tab) => !tab.groupId).sort((a, b) => a.index - b.index);
    const groups = state.snapshot.groups.filter((group) => group.windowId === windowId);
    const ordered = [...ungrouped];
    for (const group of groups) {
      const groupTabs = windowTabs
        .filter((tab) => tab.groupId === group.id)
        .sort((a, b) => a.index - b.index);
      ordered.push(...groupTabs);
    }

    ordered.forEach((tab, index) => {
      exportTabs.push({
        url: tab.url,
        title: tab.title,
        pinned: Boolean(tab.pinned),
        active: Boolean(tab.active),
        muted: Boolean(tab.muted),
        windowId,
        index,
        groupId: tab.groupId || null
      });
    });
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    groups: exportGroups,
    tabs: exportTabs
  };
}

function downloadJson(snapshot) {
  const text = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "chrome-tabs.json";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function createColorOptions(select) {
  select.innerHTML = "";
  for (const color of COLORS) {
    const option = document.createElement("option");
    option.value = color;
    option.textContent = color;
    select.appendChild(option);
  }
}

function truncateUrl(url) {
  if (typeof url !== "string") return "";
  if (url.length <= 50) return url;
  return `${url.slice(0, 50)}...`;
}

function truncateTitle(title) {
  if (typeof title !== "string") return "";
  if (title.length <= 50) return title;
  return `${title.slice(0, 50)}...`;
}

function faviconUrl(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch (error) {
    return "";
  }
}

function clearDropPlaceholder(resetNode = true) {
  if (dragState.placeholder && dragState.placeholder.parentElement) {
    dragState.placeholder.parentElement.removeChild(dragState.placeholder);
  }
  if (resetNode) {
    dragState.placeholder = null;
  }
  dragState.windowId = null;
  dragState.groupId = null;
}

function ensureDropPlaceholder(container) {
  if (!dragState.placeholder) {
    dragState.placeholder = document.createElement("div");
    dragState.placeholder.className = "drop-placeholder";
  }
  if (dragState.placeholder.parentElement !== container) {
    clearDropPlaceholder(false);
    container.appendChild(dragState.placeholder);
  }
}

function attachDropHandlers(container, windowId, groupId) {
  let dragDepth = 0;
  container.addEventListener("dragover", (event) => {
    event.preventDefault();
    container.classList.add("drop-target");
    const tabNodes = Array.from(container.querySelectorAll(".tab"));
    const mouseY = event.clientY;
    let insertIndex = tabNodes.length;
    let insertBeforeNode = null;
    for (let i = 0; i < tabNodes.length; i++) {
      const rect = tabNodes[i].getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (mouseY < midpoint) {
        insertIndex = i;
        insertBeforeNode = tabNodes[i];
        break;
      }
    }

    ensureDropPlaceholder(container);
    if (insertBeforeNode) {
      container.insertBefore(dragState.placeholder, insertBeforeNode);
    } else {
      container.appendChild(dragState.placeholder);
    }

    dragState.windowId = windowId;
    dragState.groupId = groupId;
    dragState.index = insertIndex;
  });
  container.addEventListener("dragenter", () => {
    dragDepth += 1;
  });
  container.addEventListener("dragleave", (event) => {
    if (event.relatedTarget && container.contains(event.relatedTarget)) {
      return;
    }
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      container.classList.remove("drop-target");
      clearDropPlaceholder();
    }
  });
  container.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    container.classList.remove("drop-target");
    const tabId = event.dataTransfer.getData("text/plain");
    if (!tabId) return;
    const insertIndex =
      dragState.windowId === windowId && dragState.groupId === groupId
        ? dragState.index
        : container.querySelectorAll(".tab").length;
    clearDropPlaceholder();
    moveTab(tabId, windowId, groupId, insertIndex);
  });
}

function renderTab(tab, index, windowId, groupId) {
  if (!tab._editorId) {
    tab._editorId = `t${index}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  const tabNode = tabTemplate.content.firstElementChild.cloneNode(true);
  if (state.lastMovedId === tab._editorId && Date.now() - state.lastMovedAt < 2000) {
    tabNode.classList.add("recently-moved");
  }
  tabNode.dataset.tabId = tab._editorId;
  tabNode.dataset.index = String(index);
  tabNode.dataset.fullTitle = tab.title || tab.url || "";
  tabNode.dataset.fullUrl = tab.url || "";

  const openButton = tabNode.querySelector(".tab-open");
  const faviconImg = tabNode.querySelector(".tab-favicon");
  const titleText = tab.title || tab.url;
  openButton.textContent = truncateTitle(titleText);
  openButton.dataset.tooltip = "tab";
  openButton.addEventListener("click", () => {
    window.open(tab.url, "_blank", "noopener");
  });

  const iconUrl = faviconUrl(tab.url);
  if (iconUrl) {
    faviconImg.src = iconUrl;
  } else {
    faviconImg.classList.add("hidden");
  }

  const urlEl = tabNode.querySelector(".tab-url");
  urlEl.textContent = truncateUrl(tab.url);
  urlEl.dataset.tooltip = "tab";

  const closeButton = tabNode.querySelector(".tab-close");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => removeTab(tab));

  tabNode.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", tab._editorId);
    dragState.tabId = tab._editorId;
    isDragging = true;
    hideTooltip();
    tabNode.classList.add("dragging");
  });

  tabNode.addEventListener("dragend", () => {
    clearDropPlaceholder();
    isDragging = false;
    tabNode.classList.remove("dragging");
  });

  return tabNode;
}

function renderGroup(windowId, group) {
  const groupNode = groupTemplate.content.firstElementChild.cloneNode(true);
  const titleInput = groupNode.querySelector(".group-title");
  const colorSelect = groupNode.querySelector(".group-color");
  const deleteButton = groupNode.querySelector(".delete-group");
  const tabsContainer = groupNode.querySelector(".tabs");
  const countChip = groupNode.querySelector(".count-chip");

  const initialColor = group.color || "grey";
  groupNode.dataset.groupColor = initialColor;
  groupNode.classList.add(`group-color-${initialColor}`);

  titleInput.value = group.title || "";
  titleInput.addEventListener("input", (event) => {
    updateGroup(group, { title: event.target.value });
  });

  createColorOptions(colorSelect);
  colorSelect.value = group.color || "grey";
  colorSelect.addEventListener("change", (event) => {
    const nextColor = event.target.value;
    const prevColor = groupNode.dataset.groupColor;
    if (prevColor) {
      groupNode.classList.remove(`group-color-${prevColor}`);
    }
    groupNode.dataset.groupColor = nextColor;
    groupNode.classList.add(`group-color-${nextColor}`);
    updateGroup(group, { color: nextColor });
  });

  deleteButton.addEventListener("click", () => deleteGroup(group));

  const tabs = getTabsForGroup(windowId, group.id);
  countChip.textContent = String(tabs.length);
  if (tabs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Drop tabs here.";
    tabsContainer.appendChild(empty);
  } else {
    tabs.forEach((tab, index) => {
      tabsContainer.appendChild(renderTab(tab, index, windowId, group.id));
    });
  }

  attachDropHandlers(tabsContainer, windowId, group.id);
  return groupNode;
}

function renderUngrouped(windowId) {
  const groupNode = document.createElement("div");
  groupNode.className = "group ungrouped-group";

  const header = document.createElement("div");
  header.className = "group-header";
  groupNode.appendChild(header);

  const label = document.createElement("div");
  label.className = "ungrouped-label";
  label.textContent = "Ungrouped";
  header.appendChild(label);

  const countChip = document.createElement("span");
  countChip.className = "count-chip";
  header.appendChild(countChip);

  const tabsContainer = document.createElement("div");
  tabsContainer.className = "tabs";
  groupNode.appendChild(tabsContainer);

  const tabs = getUngroupedTabs(windowId);
  countChip.textContent = String(tabs.length);
  if (tabs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Drop tabs here.";
    tabsContainer.appendChild(empty);
  } else {
    tabs.forEach((tab, index) => {
      tabsContainer.appendChild(renderTab(tab, index, windowId, null));
    });
  }

  attachDropHandlers(tabsContainer, windowId, null);
  return groupNode;
}

function renderWindow(windowId, index) {
  const windowNode = windowTemplate.content.firstElementChild.cloneNode(true);
  const title = windowNode.querySelector(".window-title");
  const addGroupButton = windowNode.querySelector(".add-group");
  const deleteWindowButton = windowNode.querySelector(".delete-window");
  const groupsContainer = windowNode.querySelector(".groups");

  title.textContent = `Window ${index + 1}`;
  const duplicateSet = showDuplicatesOnly ? getDuplicateUrlSet() : null;
  const windowTabs = state.snapshot.tabs.filter(
    (tab) => tab.windowId === windowId && tabPassesFilters(tab, duplicateSet)
  );
  const countChip = document.createElement("span");
  countChip.className = "count-chip";
  countChip.textContent = String(windowTabs.length);
  title.appendChild(countChip);

  addGroupButton.addEventListener("click", () => createGroup(windowId));
  deleteWindowButton.addEventListener("click", () => deleteWindow(windowId));

  groupsContainer.appendChild(renderUngrouped(windowId));

  const groups = getGroupsForWindow(windowId);
  groups.forEach((group) => {
    groupsContainer.appendChild(renderGroup(windowId, group));
  });

  return windowNode;
}

function render() {
  workspaceEl.innerHTML = "";

  const duplicateSet = showDuplicatesOnly ? getDuplicateUrlSet() : null;
  const overallCount = state.snapshot.tabs.filter((tab) => tabPassesFilters(tab, duplicateSet)).length;
  overallCountEl.textContent = `Total tabs: ${overallCount}`;

  const duplicateCount = getDuplicateUrlSet().size;
  toggleDuplicatesButton.textContent = showDuplicatesOnly
    ? `Showing Duplicates (${duplicateCount})`
    : `Show Duplicates (${duplicateCount})`;

  state.windows.forEach((windowId, index) => {
    workspaceEl.appendChild(renderWindow(windowId, index));
  });

  if (state.windows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No windows yet. Import JSON or create a window.";
    workspaceEl.appendChild(empty);
  }

  const addWindowNode = addWindowTemplate.content.firstElementChild.cloneNode(true);
  const addButton = addWindowNode.querySelector(".add-window-button");
  addButton.addEventListener("click", () => {
    createWindow();
    setStatus("Created new window.");
  });
  workspaceEl.appendChild(addWindowNode);
}

function assignEditorIds() {
  state.snapshot.tabs.forEach((tab, index) => {
    if (!tab._editorId) {
      tab._editorId = `t${index}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  });
}

importInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    loadSnapshot(data);
    setStatus(`Imported ${state.snapshot.tabs.length} tabs.`);
  } catch (error) {
    setStatus(`Import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});

exportButton.addEventListener("click", () => {
  assignEditorIds();
  const snapshot = buildExportSnapshot();
  downloadJson(snapshot);
  setStatus(`Exported ${snapshot.tabs.length} tabs.`);
});

clearAutosaveButton.addEventListener("click", () => {
  localStorage.removeItem(AUTOSAVE_KEY);
  setStatus("Autosave cleared.");
});

toggleDuplicatesButton.addEventListener("click", () => {
  showDuplicatesOnly = !showDuplicatesOnly;
  toggleDuplicatesButton.classList.toggle("active", showDuplicatesOnly);
  toggleDuplicatesButton.textContent = showDuplicatesOnly ? "Showing Duplicates" : "Show Duplicates";
  render();
});

themeToggleButton.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

function handleSearchInput() {
  render();
}

searchTitleInput.addEventListener("input", handleSearchInput);
searchUrlInput.addEventListener("input", handleSearchInput);

if (!restoreAutosave()) {
  render();
  setStatus("Ready. Import a JSON file to begin.");
}

assignEditorIds();

const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(savedTheme === "dark" ? "dark" : "light");

workspaceEl.addEventListener(
  "mouseenter",
  (event) => {
    const target = event.target.closest("[data-tooltip=\"tab\"]");
    if (!target || isDragging) return;
    const tabNode = target.closest(".tab");
    if (!tabNode) return;
    tabNode.classList.add("hovered");
    const rect = target.getBoundingClientRect();
    showTooltipForTab(tabNode, rect);
  },
  true
);

workspaceEl.addEventListener(
  "mouseleave",
  (event) => {
    const target = event.target.closest("[data-tooltip=\"tab\"]");
    if (!target) return;
    const tabNode = target.closest(".tab");
    if (tabNode) {
      tabNode.classList.remove("hovered");
    }
    hideTooltip();
  },
  true
);

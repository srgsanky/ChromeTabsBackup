
// Regex to capture URL to amazon.com and simplify the URL
const AMAZON_REGEX = /(?<canonical>https:\/\/www.amazon.com\/.*?\/dp\/[^/]+\/).*/;


// This method is copied from https://stackoverflow.com/questions/985272/selecting-text-in-an-element-akin-to-highlighting-with-your-mouse
// can be used to select next of a given DOM node
function selectText(nodeId) {
    const node = document.getElementById(nodeId);

    if (document.body.createTextRange) {
        const range = document.body.createTextRange();
        range.moveToElementText(node);
        range.select();
    } else if (window.getSelection) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        console.warn("Could not select text in node: Unsupported browser.");
    }
}


// Get all the tab groups currently open in chrome.
// This method is copied from chatGPT.
function getAllTabGroups() {
    return new Promise((resolve, reject) => {
        chrome.tabGroups.query({}, (groups) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(groups);
            }
        });
    });
}


// Copy the given text to clipboard.
// Copied from https://stackoverflow.com/questions/3436102/copy-to-clipboard-in-chrome-extension
function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        //clipboard successfully set
    }, () => {
        //clipboard write failed, use fallback
        console.error('Copy to clipboard failed')
    });
}


function tabsQuery(queryInfo) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query(queryInfo, (tabs) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(tabs);
            }
        });
    });
}

function tabsCreate(createProperties) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create(createProperties, (tab) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(tab);
            }
        });
    });
}

function tabsGroup(groupProperties) {
    return new Promise((resolve, reject) => {
        chrome.tabs.group(groupProperties, (groupId) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(groupId);
            }
        });
    });
}

function windowsCreate(createData) {
    return new Promise((resolve, reject) => {
        chrome.windows.create(createData, (window) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(window);
            }
        });
    });
}

function tabGroupsUpdate(groupId, updateProperties) {
    return new Promise((resolve, reject) => {
        chrome.tabGroups.update(groupId, updateProperties, (group) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(group);
            }
        });
    });
}

function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download(
        {
            url,
            filename,
            saveAs: true
        },
        () => {
            URL.revokeObjectURL(url);
        }
    );
}

function normalizeGroupId(rawId) {
    if (rawId === null || rawId === undefined) return null;
    return `g${rawId}`;
}

function buildTabsSnapshot(tabs, groups) {
    const groupsData = groups.map((group) => ({
        id: normalizeGroupId(group.id),
        title: group.title || "",
        color: group.color || "",
        collapsed: Boolean(group.collapsed),
        windowId: group.windowId
    }));

    const tabsData = tabs.map((tab) => ({
        url: tab.url || "",
        title: tab.title || "",
        pinned: Boolean(tab.pinned),
        active: Boolean(tab.active),
        muted: Boolean(tab.mutedInfo && tab.mutedInfo.muted),
        windowId: tab.windowId,
        index: tab.index,
        groupId: tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? null : normalizeGroupId(tab.groupId)
    }));

    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        groups: groupsData,
        tabs: tabsData
    };
}

async function exportMarkdownTable() {
    const groups = await getAllTabGroups();
    const groups_map = {};
    for (const group of groups) {
        groups_map[group.id] = group.title;
    }

    const result = await tabsQuery({});
    // Track the seen URLs to dedupe tabs
    const seenUrls = new Set();

    let output = [];
    let count = 1;
    output.push('||Name|URL|Tab Group|');
    output.push('|---|---|---|---|');
    for (const t of result) {
        let url = t.url;
        const match = url.match(AMAZON_REGEX);
        if (match) {
            url = match.groups.canonical;
        }

        if (url.length === 0) {
            // Skip blank tabs
            continue;
        }

        if (seenUrls.has(url)) {
            // Skip duplicate tabs
            chrome.tabs.remove(t.id); // Automatically close the duplicate tab
            continue;
        }
        seenUrls.add(url);

        let title = t.title;
        // Replace char that will break the markdown table
        title = title.replaceAll('|', ':');
        const tab_group_id = t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? '' : groups_map[t.groupId];
        output.push(`|${count}|${title}|${url}|${tab_group_id}|`);
        count++;
    }

    const table_text = output.join('\n');
    document.getElementById('output').innerText = table_text;
    selectText('output');
    copyTextToClipboard(table_text);
}

async function exportJsonSnapshot() {
    const groups = await getAllTabGroups();
    const tabs = await tabsQuery({});
    const snapshot = buildTabsSnapshot(tabs, groups);
    const jsonText = JSON.stringify(snapshot, null, 2);
    document.getElementById('output').innerText = jsonText;
    downloadTextFile('chrome-tabs.json', jsonText, 'application/json');
}

async function importJsonSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tabs)) {
        throw new Error('Invalid JSON: expected an object with a tabs array.');
    }

    const groupsById = new Map();
    if (Array.isArray(snapshot.groups)) {
        for (const group of snapshot.groups) {
            if (group && typeof group.id === 'string') {
                groupsById.set(group.id, group);
            }
        }
    }

    const tabs = snapshot.tabs
        .filter((tab) => tab && typeof tab.url === 'string' && tab.url.length > 0)
        .map((tab) => ({
            ...tab,
            windowId: Number.isFinite(tab.windowId) ? tab.windowId : 0,
            index: Number.isFinite(tab.index) ? tab.index : 0
        }));

    const tabsByWindow = new Map();
    for (const tab of tabs) {
        const list = tabsByWindow.get(tab.windowId) || [];
        list.push(tab);
        tabsByWindow.set(tab.windowId, list);
    }

    for (const [windowKey, windowTabs] of tabsByWindow.entries()) {
        windowTabs.sort((a, b) => a.index - b.index);
        const firstTab = windowTabs[0];
        const createdWindow = await windowsCreate({
            url: firstTab.url,
            focused: false
        });
        const windowId = createdWindow.id;

        const createdTabIdsByGroup = new Map();
        const createdTabs = [];

        // Track the first tab created by windows.create
        if (createdWindow.tabs && createdWindow.tabs.length > 0) {
            const created = createdWindow.tabs[0];
            createdTabs.push({ id: created.id, active: Boolean(firstTab.active) });
            if (firstTab.groupId) {
                const list = createdTabIdsByGroup.get(firstTab.groupId) || [];
                list.push(created.id);
                createdTabIdsByGroup.set(firstTab.groupId, list);
            }
            if (firstTab.pinned) {
                chrome.tabs.update(created.id, { pinned: true });
            }
        } else {
            const created = await tabsCreate({
                windowId,
                url: firstTab.url,
                pinned: Boolean(firstTab.pinned),
                active: false,
                index: 0
            });
            createdTabs.push({ id: created.id, active: Boolean(firstTab.active) });
            if (firstTab.groupId) {
                const list = createdTabIdsByGroup.get(firstTab.groupId) || [];
                list.push(created.id);
                createdTabIdsByGroup.set(firstTab.groupId, list);
            }
        }

        for (let i = 1; i < windowTabs.length; i++) {
            const tab = windowTabs[i];
            const created = await tabsCreate({
                windowId,
                url: tab.url,
                pinned: Boolean(tab.pinned),
                active: false,
                index: i
            });
            createdTabs.push({ id: created.id, active: Boolean(tab.active) });
            if (tab.groupId) {
                const list = createdTabIdsByGroup.get(tab.groupId) || [];
                list.push(created.id);
                createdTabIdsByGroup.set(tab.groupId, list);
            }
        }

        for (const [groupKey, tabIds] of createdTabIdsByGroup.entries()) {
            if (tabIds.length === 0) continue;
            const groupId = await tabsGroup({ tabIds });
            const groupMeta = groupsById.get(groupKey);
            const groupWindowId = groupMeta && Number.isFinite(groupMeta.windowId) ? groupMeta.windowId : windowKey;
            if (groupMeta && groupWindowId === windowKey) {
                await tabGroupsUpdate(groupId, {
                    title: groupMeta.title || '',
                    color: groupMeta.color || 'grey',
                    collapsed: Boolean(groupMeta.collapsed)
                });
            }
        }

        const activeTab = createdTabs.find((tab) => tab.active);
        if (activeTab) {
            chrome.tabs.update(activeTab.id, { active: true });
        }
    }
}

const exportMarkdownButton = document.getElementById('export-md');
exportMarkdownButton.addEventListener('click', async () => {
    try {
        await exportMarkdownTable();
    } catch (error) {
        document.getElementById('output').innerText = `Error: ${error.message}`;
    }
});

const exportJsonButton = document.getElementById('export-json');
exportJsonButton.addEventListener('click', async () => {
    try {
        await exportJsonSnapshot();
    } catch (error) {
        document.getElementById('output').innerText = `Error: ${error.message}`;
    }
});

const importJsonInput = document.getElementById('import-json');
importJsonInput.addEventListener('change', async (event) => {
    try {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const text = await file.text();
        const snapshot = JSON.parse(text);
        await importJsonSnapshot(snapshot);
        document.getElementById('output').innerText = `Imported ${snapshot.tabs.length} tabs.`;
        event.target.value = '';
    } catch (error) {
        document.getElementById('output').innerText = `Error: ${error.message}`;
    }
});

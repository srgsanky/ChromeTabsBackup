
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


const button = document.querySelector("button");
button.addEventListener("click", async () => {
    const groups = await getAllTabGroups()
    const groups_map = {}
    for (const group of groups) {
        groups_map[group.id] = group.title
    }
    // Get all tabs from all windows
    chrome.tabs.query({},
        (result) => {
            // Track the seen URLs to dedupe tabs
            const seenUrls = new Set()

            let output = []
            let count = 1
            output.push('||Name|URL|Tab Group|')
            output.push('|---|---|---|---|')
            for (const t of result) {
                let url = t.url
                const match = url.match(AMAZON_REGEX);
                if (match) {
                    url = match.groups.canonical
                }

                if (url.length === 0) {
                    // Skip blank tabs
                    continue
                }

                if (seenUrls.has(url)) {
                    // Skip duplicate tabs
                    chrome.tabs.remove(t.id) // Automatically close the duplicate tab
                    continue
                }
                seenUrls.add(url)

                let title = t.title
                // Replace char that will break the markdown table
                title = title.replaceAll('|', ':')
                const tab_group_id = t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? '' : groups_map[t.groupId]
                output.push(`|${count}|${title}|${url}|${tab_group_id}|`)
                count++
            }

            const table_text = output.join('\n')
            document.getElementById('output').innerText = table_text
            selectText('output')
            copyTextToClipboard(table_text)
        }
    )
});


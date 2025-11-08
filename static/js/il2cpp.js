// method data
let methodData = {};
let allEntries = [];
let visibleEntries = [];
let sortField = null;
let sortAsc = true;
let advancedMethodLines = [];

// DOM elements
const fullDropZone = document.getElementById("fullDropZone");
const advWindow = document.getElementById("advWindow");

// Table stuff
let rowHeights = [];
let totalHeight = 0;
let scrollTop = 0;

// windows stuff
const openWindows = new Set();
let dragCounter = 0;

// tagging methods
const visibleTags = {
    "inlined": "Potentially Inlined",
    "used-by-inline": "Used by Inlined methods",
    "stripped": "Stripped",
    "matched": "Matched",
}

// platform nice names
const platformNames = {
    "win-x86": "Windows x86 (32-bit)",
    "win-x86_64": "Windows x86_64 (64-bit)",
    "android-arm64": "Android ARM64 (64-bit)",
    "android-arm": "Android ARMv7 (32-bit)",
}

// Z indexing
let currentZ = 500

// setup the initial state
setupTable();
setupFileInput();
setupAdvancedMethodWindow();
setupVersionSelector();

// Theme toggle functionality
const savedTheme = localStorage.getItem("theme");
const html = document.documentElement;

if (savedTheme) {
    html.setAttribute("data-theme", savedTheme);
}
if (!savedTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");
}

document.getElementById("toggleThemeBtn").addEventListener("click", () => {
    const current = html.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
});

// setup version selector dropdown
function setupVersionSelector() {
    const versionWindow = document.getElementById('versionsWindow');
    const versionList = document.getElementById('versionsList');
    const closeButton = versionWindow.querySelector('.window-close');
    closeButton.addEventListener('click', () => {
        versionWindow.classList.add('hidden');
    });

    document.getElementById('browseVersions').addEventListener('click', () => {
        versionWindow.classList.remove('hidden');
    });

    // get game version data
    fetch('il2cpp/available_versions.json')
        .then(response => response.json())
        .then(data => {
            Object.entries(data).forEach(([version, versionData]) => {
                const option = `
<div class="version-dropdown">
<button class="dropdown-toggle">
<div class="version-info">
    <span class="version-number">${version}</span>
    <span class="game-version">${versionData.game_version}</span>
    <span class="release-date">${versionData.release_date}</span>
</div>
<span class="dropdown-arrow">▼</span>
</button>
<div class="dropdown-content"></div>
</div>`;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = option.trim();

                const versionDropdown = tempDiv.querySelector('.version-dropdown');

                tempDiv.querySelector('.dropdown-toggle').addEventListener('click', () => {
                    versionDropdown.classList.toggle('active');
                });

                const dropdownContent = tempDiv.querySelector('.dropdown-content');
                Object.entries(versionData.analyses).forEach(([analysis, analysisData]) => {
                    const niceName = platformNames[analysis] || analysis;
                    const analysisOption = `
            <div class="analysis-option" data-platform="${niceName}">
                <span class="platform-name">${niceName}</span>
            </div>`;
                    const analysisTempDiv = document.createElement('div');
                    analysisTempDiv.innerHTML = analysisOption.trim();
                    analysisTempDiv.querySelector('.analysis-option').addEventListener('click', () => {
                        loadFileFromUrl(analysisData);
                        versionWindow.classList.add('hidden');
                    });
                    dropdownContent.appendChild(analysisTempDiv.firstChild);
                });

                versionList.appendChild(versionDropdown);
            });
        })
        .catch(error => {
            console.error('Error fetching version data:', error);
        });
}

// setup advanced method filter window
function setupAdvancedMethodWindow() {
    document.getElementById("advMethodApply").addEventListener("click", () => {
        const input = document.getElementById("advMethodInput").value.trim();
        advancedMethodLines = input ? input.split(/\r?\n/).map(line => line.trim()).filter(line => line) : [];
        renderVirtualTable();
    });

    advWindow.querySelector('.window-close').addEventListener('click', () => {
        advWindow.classList.add("hidden");
    });

    document.getElementById("advSearch").addEventListener("click", () => {
        advWindow.classList.toggle("hidden");
    });

    document.getElementById("advMethodClear").addEventListener("click", () => {
        document.getElementById("advMethodInput").value = '';
        advancedMethodLines = [];
        renderVirtualTable();
    });

    setupWindowDrag(advWindow);
    setupWindowResize(advWindow, advWindow.querySelector('.resize-handle'));
}

// setup necessary listeners for virtual table and filtering
function setupTable() {

    // multi-toggle dropdowns
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.multi-filter-dropdown').forEach(dropdown => {
            if (!dropdown.contains(e.target) && !dropdown.previousElementSibling.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });

    document.querySelectorAll('.multi-filter').forEach(filter => {
        filter.querySelector('.multi-filter-toggle').addEventListener('click', (e) => {
            filter.querySelector('.multi-filter-dropdown').classList.toggle('hidden');
        });
    });

    // scroll
    document.getElementById("virtual-viewport").addEventListener("scroll", renderVisibleRows);

    // filters
    document.getElementById("searchInput").addEventListener("input", renderVirtualTable);
    document.getElementById("returnTypeInput").addEventListener("input", renderVirtualTable);
    document.getElementById("showCompilerGenerated").addEventListener("change", renderVirtualTable);
    document.getElementById("generic").addEventListener("change", renderVirtualTable);
    document.getElementById("minMonoCount").addEventListener("input", renderVirtualTable);
    document.getElementById("maxMonoCount").addEventListener("input", renderVirtualTable);
    document.getElementById("minXrefCount").addEventListener("input", renderVirtualTable);
    document.getElementById("maxXrefCount").addEventListener("input", renderVirtualTable);
    document.getElementById("minThisCount").addEventListener("input", renderVirtualTable);
    document.getElementById("maxThisCount").addEventListener("input", renderVirtualTable);

    // toggle buttons
    document.querySelectorAll(".toggle-button").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleButtonState(btn);
            renderVirtualTable();
        });
    });

    // multi-filter toggles
    document.querySelectorAll('.multi-filter-button').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('toggled');
            renderVirtualTable();
        });
    });

    // sorting
    document.querySelectorAll(".virtual-header .cell").forEach(th => {
        th.addEventListener("click", () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortAsc = !sortAsc;
            } else {
                sortField = field;
                sortAsc = true;
            }

            document.querySelectorAll(".virtual-header .cell").forEach(cell => {
                cell.classList.remove("sort-asc", "sort-desc");
            });

            th.classList.add(sortAsc ? "sort-asc" : "sort-desc");

            renderVirtualTable();
        });
    });
}

// setup file loading
function setupFileInput() {
    document.getElementById("fileInput").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        loadFile(file);
    });

    window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;
        fullDropZone.classList.add("active");
    });

    window.addEventListener("dragleave", (e) => {
        dragCounter--;
        if (dragCounter === 0) {
            fullDropZone.classList.remove("active");
        }
    });

    window.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    window.addEventListener("drop", (e) => {
        e.preventDefault();
        fullDropZone.classList.remove("active");
        dragCounter = 0;

        const file = e.dataTransfer.files[0];
        if (!file || file.type !== "application/json") {
            alert("Please drop a valid JSON file.");
            return;
        }
        loadFile(file);
    });
}

// gets next Z index for ordering windows.
function getNextZIndex() {
    return ++currentZ;
}

// updates the entries list when a new JSON is loaded.
function updateDatasetFromJson() {
    allEntries = Object.entries(methodData).map(([method, data]) => {
        return {
            method,
            returnType: data.ReturnType,
            monoCount: data.MonoCount,
            xrefCount: data.XrefCount,
            thisCount: data.ThisCount || 0,
            type: data.Type || "Method",
            tags: data.Tags || []
        };
    });

    renderVirtualTable();
}

// calculates filters and renders the table.
function renderVirtualTable() {
    const filter = document.getElementById("searchInput").value.trim().toLowerCase();
    const returnTypeFilter = document.getElementById("returnTypeInput").value.trim().toLowerCase();

    const selectedTags = Array.from(document.querySelectorAll('#tagFilter .toggle-button.toggled')).map(btn => btn.dataset.filter);
    const typeFilter = Array.from(document.querySelectorAll('#typeFilter .toggle-button.toggled')).map(btn => btn.dataset.filter);

    const showCompilerGenerated = document.getElementById("showCompilerGenerated").classList.contains("toggled");
    const generic = document.getElementById("generic").classList.contains("toggled");

    const minMono = parseInt(document.getElementById("minMonoCount").value, 10) || 0;
    const maxMono = parseInt(document.getElementById("maxMonoCount").value, 10) || Infinity;

    const minXref = parseInt(document.getElementById("minXrefCount").value, 10) || 0;
    const maxXref = parseInt(document.getElementById("maxXrefCount").value, 10) || Infinity;

    const minThis = parseInt(document.getElementById("minThisCount").value, 10) || 0;
    const maxThis = parseInt(document.getElementById("maxThisCount").value, 10) || Infinity;

    visibleEntries = allEntries.filter(entry => {

        function startsWith(element, index, array) {
            return entry.method.startsWith(element);
        }

        const matchesMethod = !filter || entry.method.toLowerCase().includes(filter);
        const matchesReturn = !returnTypeFilter || (entry.returnType.toLowerCase().includes(returnTypeFilter));
        const matchesTag = selectedTags.length === 0 || selectedTags.some(tag => entry.tags.includes(tag));
        const matchesType = typeFilter.length === 0 || typeFilter.includes(entry.type);
        const matchesCompilerGenerated = showCompilerGenerated || !entry.tags.includes("compiler-generated");
        const matchesGeneric = generic || !entry.tags.includes("generic");
        const matchesMonoCount = entry.monoCount >= minMono && entry.monoCount <= maxMono;
        const matchesXrefCount = entry.xrefCount >= minXref && entry.xrefCount <= maxXref;
        const matchesThisCount = (entry.thisCount || 0) >= minThis && (entry.thisCount || 0) <= maxThis;
        const matchesMultiMethod = advancedMethodLines.length === 0 || advancedMethodLines.some(startsWith);

        return matchesMethod && matchesReturn && matchesTag && matchesType &&
            matchesCompilerGenerated && matchesGeneric && matchesMonoCount && matchesXrefCount
            && matchesThisCount && matchesMultiMethod;
    });

    if (sortField) {
        visibleEntries.sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];

            if (sortField === "tags") {
                const valA = a.tags.join(", ");
                const valB = b.tags.join(", ");
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    let percent = Math.round(visibleEntries.length / allEntries.length * 100) || 0;
    document.getElementById("countDisplay").textContent = `${visibleEntries.length} / ${allEntries.length} (${percent}%)`;
    rowHeights = new Array(visibleEntries.length).fill(40);
    totalHeight = rowHeights.reduce((a, b) => a + b, 0);
    document.getElementById("virtual-spacer").style.height = totalHeight + "px";
    renderVisibleRows();

    // we use requestAnimationFrame to call renderVisibleRows again
    // to fix row height issues when changing filters or sorting
    requestAnimationFrame(() => {
        renderVisibleRows();
    });
}

// renders visible rows.
function renderVisibleRows() {
    const container = document.getElementById("virtual-viewport");
    const content = document.getElementById("virtual-content");
    scrollTop = container.scrollTop;
    const height = container.clientHeight;

    let start = 0;
    let offset = 0;
    while (offset + (rowHeights[start] || 40) < scrollTop && start < rowHeights.length) {
        offset += rowHeights[start];
        start++;
    }

    let end = start;
    let visibleHeight = 0;
    while (visibleHeight < height && end < rowHeights.length) {
        visibleHeight += rowHeights[end];
        end++;
    }

    content.innerHTML = '';
    let y = offset;

    for (let i = start; i < end; i++) {
        const entry = visibleEntries[i];
        const row = document.createElement("div");
        row.className = "row";
        row.style.position = "absolute";
        row.style.top = y + "px";
        row.style.left = 0;
        row.style.right = 0;

        row.innerHTML = `
  <div class="cell col-method">
    <button class="copy-btn" title="Copy"></button>
    <span class="method-name">${highlightMatch(entry.method, document.getElementById("searchInput").value)}</span>
  </div>
  <div class="cell col-return">
    <span class="return-type">${highlightMatch(entry.returnType, document.getElementById("returnTypeInput").value)}</span>
  </div>
  <div class="cell col-count">${entry.monoCount}</div>
  <div class="cell col-count">${entry.xrefCount}</div>
  <div class="cell col-count">${entry.thisCount || 0}</div>
  <div class="cell col-type">${entry.type}</div>
  <div class="cell col-tag"></div>
`;
        const tagCell = row.querySelector(".col-tag");
        entry.tags.forEach(tag => {
            if (!visibleTags[tag]) return;
            const tagSpan = document.createElement("span");
            tagSpan.classList.add("tag", tag);
            tagSpan.textContent = visibleTags[tag];
            tagCell.appendChild(tagSpan);
        });

        const copyBtn = row.querySelector(".copy-btn");
        setupCopyButton(copyBtn, entry.method);

        row.addEventListener('click', () => createUsageWindow(entry.method));
        content.appendChild(row);

        requestAnimationFrame(() => {
            const h = row.getBoundingClientRect().height;
            if (h !== rowHeights[i]) {
                rowHeights[i] = h;
                document.getElementById("virtual-spacer").style.height =
                    rowHeights.reduce((a, b) => a + b, 0) + "px";
            }
        });

        y += rowHeights[i] || 40;
    }
}

// sets up a copy button with a desired text
function setupCopyButton(button, textToCopy) {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(textToCopy).then(() => {
            button.classList.add('copy-flash');
            setTimeout(() => {
                button.classList.remove('copy-flash');
            }, 1000);
        }).catch(err => {
            button.classList.add('copy-error');
            setTimeout(() => {
                button.classList.remove('copy-error');
            }, 1000);
            console.error('Failed to copy:', err);
        });
    });
}

// creates a window to display method usages.
function createUsageWindow(methodName) {
    const method = methodData[methodName];
    if (!method) {
        return;
    }

    const existing = document.querySelector(`.usage-window[data-method="${CSS.escape(methodName)}"]`);
    if (existing) {
        // Bring it to front
        existing.style.zIndex = getNextZIndex();
        return;
    }

    const windowEl = document.createElement('div');
    const windowId = 'window-' + Date.now();

    windowEl.className = 'usage-window';
    windowEl.id = windowId;
    windowEl.setAttribute("data-method", methodName);
    windowEl.style.zIndex = getNextZIndex();

    windowEl.addEventListener("mousedown", () => {
        windowEl.style.zIndex = getNextZIndex();
    });

    const header = document.createElement('div');
    header.className = 'window-header';

    const title = document.createElement('span');
    title.className = 'window-title';
    title.textContent = `Usages of: ${methodName}`;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'window-close';
    closeBtn.textContent = '×';

    header.append(title, closeBtn);
    windowEl.append(header);

    const body = document.createElement('div');
    body.className = 'window-body';

    const showDiffsToggle = document.createElement("button");
    showDiffsToggle.classList.add("button-base", "toggle-button");
    showDiffsToggle.textContent = "Show Diffs Only";
    showDiffsToggle.style.marginBottom = "0.75rem";

    const showDiffsCheck = document.createElement("span");
    showDiffsCheck.classList.add("checkbox-icon");
    showDiffsCheck.innerHTML = "✖";

    showDiffsToggle.prepend("\n");
    showDiffsToggle.prepend(showDiffsCheck);

    body.prepend(showDiffsToggle);

    const monoSection = createUsageSection(
        'Mono Usages',
        method.MonoUsages,
        method.XrefUsages,
        'mono-only'
    );
    body.append(monoSection);

    const xrefSection = createUsageSection(
        'Xref Usages',
        method.XrefUsages,
        method.MonoUsages,
        'xref-only'
    );
    body.append(xrefSection);

    showDiffsToggle.addEventListener("click", () => {
        toggleButtonState(showDiffsToggle);
        const showDiffsOnly = showDiffsToggle.classList.contains("toggled");

        let monoCount = 0;
        let xrefCount = 0;

        windowEl.querySelectorAll(".usage-item").forEach(item => {
            if (item.classList.contains('mono-only')) {
                monoCount++;
            } else if (item.classList.contains('xref-only')) {
                xrefCount++;
            }
            item.style.display = showDiffsOnly ? (item.classList.contains('common') ? 'none' : '') : '';
        });
        if (showDiffsOnly) {
            monoSection.querySelector('.section-header h4').textContent = `Mono Usages (${monoCount} / ${method.MonoUsages.length})`;
            xrefSection.querySelector('.section-header h4').textContent = `Xref Usages (${xrefCount} / ${method.XrefUsages.length})`;
        } else {
            monoSection.querySelector('.section-header h4').textContent = `Mono Usages (${method.MonoUsages.length})`;
            xrefSection.querySelector('.section-header h4').textContent = `Xref Usages (${method.XrefUsages.length})`;
        }
    });


    windowEl.append(body);

    const backToTopBtn = document.createElement("button");
    backToTopBtn.classList.add("button-base", "blue-btn", "back-to-top-btn");
    backToTopBtn.textContent = "↑ Back to Top";
    backToTopBtn.style.opacity = "0";
    backToTopBtn.disabled = true;
    windowEl.appendChild(backToTopBtn);

    body.addEventListener("scroll", () => {
        backToTopBtn.disabled = body.scrollTop < 200;
        backToTopBtn.style.opacity = body.scrollTop > 200 ? "1" : "0";
    });

    backToTopBtn.addEventListener("click", () => {
        body.scrollTo({ top: 0, behavior: "smooth" });
    });

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    windowEl.appendChild(resizeHandle);

    function createUsageSection(title, items, compareItems, diffClass) {
        const section = document.createElement('div');
        section.className = 'usage-section';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.dataset.section = title.toLowerCase().replace(' ', '-');

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'header-btn';
        toggleBtn.textContent = '▼';

        const titleEl = document.createElement('h4');
        titleEl.textContent = `${title} (${items?.length || 0})`;

        header.append(toggleBtn, titleEl);
        section.append(header);

        const content = document.createElement('div');
        content.className = `section-content ${header.dataset.section}-section`;

        if (!items || items.length === 0) {
            const noItems = document.createElement('div');
            noItems.className = 'no-usages';
            noItems.textContent = `No ${title} found`;
            content.append(noItems);
        } else {
            items.forEach(usage => {
                const item = document.createElement('div');
                item.className = 'usage-item';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.title = 'Copy to clipboard';

                const linkBtn = document.createElement('button');
                linkBtn.className = 'link-btn';
                linkBtn.title = 'Open usage window';
                linkBtn.innerText = '🔗';

                const usageText = document.createElement('span');
                usageText.textContent = usage;
                usageText.style.flexGrow = '1';

                item.append(copyBtn, linkBtn, usageText);

                setupCopyButton(copyBtn, usage);
                linkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    createUsageWindow(usage);
                });

                if (compareItems && !compareItems.includes(usage)) {
                    item.classList.add(diffClass);
                } else {
                    item.classList.add('common');
                }

                content.append(item);
            });
        }

        section.append(content);
        return section;
    }

    windowEl.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.classList.contains('header-btn')) return;

            const btn = header.querySelector('.header-btn');
            const section = header.nextElementSibling;
            section.style.display = section.style.display === 'none' ? 'block' : 'none';
            btn.textContent = section.style.display === 'none' ? '▶' : '▼';
        });
    });

    windowEl.querySelectorAll('.header-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const header = e.target.closest('.section-header');
            const section = header.nextElementSibling;
            section.style.display = section.style.display === 'none' ? 'block' : 'none';
            btn.textContent = section.style.display === 'none' ? '▶' : '▼';
        });
    });


    document.body.appendChild(windowEl);
    openWindows.add(windowId);

    setupWindowDrag(windowEl);
    setupWindowResize(windowEl, resizeHandle);

    closeBtn.addEventListener('click', () => {
        document.body.removeChild(windowEl);
        openWindows.delete(windowId);
    });

    return windowEl;
}

// sets up dragging functionality for a window element.
function setupWindowDrag(windowEl) {
    const header = windowEl.querySelector('.window-header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        if (window.innerWidth < 768) {
            return;
        }

        if (e.target.classList.contains('window-close') ||
            e.target.classList.contains('resize-handle')) {
            return;
        }

        isDragging = true;
        offsetX = e.clientX - windowEl.getBoundingClientRect().left;
        offsetY = e.clientY - windowEl.getBoundingClientRect().top;
        windowEl.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (window.innerWidth < 768) {
            isDragging = false;
            windowEl.style.left = '';
            windowEl.style.top = '';
            windowEl.style.right = '';
            windowEl.style.cursor = '';
            return;
        }

        if (!isDragging) return;

        windowEl.style.left = `${e.clientX - offsetX}px`;
        windowEl.style.top = `${e.clientY - offsetY}px`;
        windowEl.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        windowEl.style.cursor = '';
    });
}

// sets up resizing functionality for a window element.
function setupWindowResize(element, handle) {
    let startX, startY, startWidth, startHeight;

    function initResize(e) {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    }

    function resize(e) {
        element.style.width = (startWidth + e.clientX - startX) + 'px';
        element.style.height = (startHeight + e.clientY - startY) + 'px';
    }

    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }

    handle.addEventListener('mousedown', initResize);
}

// toggles a toggle button
function toggleButtonState(button) {
    button.classList.toggle("toggled");
    const icon = button.querySelector(".checkbox-icon");
    if (icon) icon.textContent = button.classList.contains("toggled") ? "✔" : "✖";
}

// updates the count display with the current filtered and total counts.
function updateCountDisplay() {
    document.getElementById("countDisplay").textContent = `${filteredCount}/${totalCount}`;
}

// highlights matching text in a method name based on the filter input.
function highlightMatch(text, filter) {
    if (!filter) return escapeHTML(text);

    const lowerText = text.toLowerCase();
    const lowerFilter = filter.toLowerCase();
    const fragment = document.createDocumentFragment();

    let lastIndex = 0;
    let index = lowerText.indexOf(lowerFilter);

    while (index !== -1) {
        if (index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
        }

        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'highlight';
        highlightSpan.textContent = text.slice(index, index + filter.length);
        fragment.appendChild(highlightSpan);

        lastIndex = index + filter.length;
        index = lowerText.indexOf(lowerFilter, lastIndex);
    }

    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    const container = document.createElement('div');
    container.appendChild(fragment);
    return container.innerHTML;
}

// escapes HTML special characters in a string
function escapeHTML(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
}

// debounces a function to limit how often it can be called
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// loads a JSON object into the methodData variable and updates the dataset.
function loadJson(json) {
    try {
        methodData = json;
        updateDatasetFromJson();
    } catch (err) {
        alert("Invalid JSON format");
        console.error(err);
    }
}

// loads a file using FileReader and parses it as JSON.
function loadFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);
            loadJson(json);
        } catch (err) {
            alert("Invalid JSON file");
            console.error(err);
        }
    };

    reader.readAsText(file);
    document.getElementById("selectedFileName").textContent = file ? file.name : "";
}

function loadFileFromUrl(url) {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            loadJson(data);
            document.getElementById("selectedFileName").textContent = url;
        })
        .catch(err => {
            alert("Failed to load online JSON");
            console.error(err);
        });
}
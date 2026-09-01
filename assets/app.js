(function () {
  "use strict";

  // Filled in once the repo is detected/resolved (see bottom of file).
  var OWNER, REPO, BRANCH, REPO_URL, RAW_BASE, API_TREE_URL;

  var treeEl = document.getElementById("tree");
  var contentEl = document.getElementById("content");
  var sidebarEl = document.getElementById("sidebar");
  var fileFilterEl = document.getElementById("fileFilter");
  var appViewBtn = document.getElementById("appViewBtn");
  var folderViewBtn = document.getElementById("folderViewBtn");

  // The two sidebar panes, both built once the tree arrives.
  var appListEl = null;
  var folderTreeEl = null;

  document.getElementById("sidebarToggle").addEventListener("click", function () {
    sidebarEl.classList.toggle("collapsed");
  });

  // ---------- Figure out which repo/branch to show ----------
  //
  // The target repo comes solely from ?owner=&repo= query params
  // (e.g. index.html?owner=ciumsy&repo=heart-bioamp-arduino-firmware).
  // ?branch= is optional; without it the repo's default branch is used
  // (resolved via one API call to the repo itself).

  function detectRepo() {
    var qs = new URLSearchParams(location.search);
    return { owner: qs.get("owner"), repo: qs.get("repo"), branch: qs.get("branch") };
  }

  var ICONS = {
    folder: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
    folderOpen: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
    file: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
    chevron: '<svg class="chevron" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
    chip: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
    browser: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 6.5h.01M9 6.5h.01"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    github: '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
    expand: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
  };

  function formatTitle(str) {
    return str.replace(/[_-]+/g, " ").trim();
  }

  var LANG_MAP = {
    py: "python", ino: "cpp", pde: "cpp", cpp: "cpp", cc: "cpp", cxx: "cpp",
    c: "cpp", h: "cpp", hpp: "cpp", js: "javascript", mjs: "javascript",
    json: "json", html: "xml", htm: "xml", xml: "xml", css: "css",
    md: "markdown", markdown: "markdown", sh: "bash", bash: "bash",
    yml: "yaml", yaml: "yaml", ini: "ini", cfg: "ini", txt: "plaintext"
  };

  // Same buckets as LANG_MAP, but naming CodeMirror's mode/MIME strings for the edit view.
  var CM_MODE_MAP = {
    python: "python",
    cpp: "text/x-c++src",
    javascript: "javascript",
    json: "application/json",
    xml: "htmlmixed",
    css: "css",
    markdown: "markdown",
    bash: "shell",
    yaml: "yaml",
    ini: "properties",
    plaintext: null
  };

  var IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "bmp", "webp", "ico"];
  var BINARY_EXTS = ["pdf", "zip", "exe", "bin", "hex", "elf", "o", "a", "dll",
    "so", "class", "jar", "mp3", "mp4", "mov", "ttf", "woff", "woff2", "eot"];

  function ext(name) {
    var i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Build nested tree from flat path list ----------

  function buildTree(paths) {
    var root = { name: "", type: "folder", children: {}, path: "" };
    paths.forEach(function (item) {
      if (item.type !== "blob" && item.type !== "tree") return;
      var parts = item.path.split("/");
      var node = root;
      parts.forEach(function (part, idx) {
        var isLast = idx === parts.length - 1;
        if (!node.children[part]) {
          node.children[part] = {
            name: part,
            type: isLast && item.type === "blob" ? "file" : "folder",
            children: {},
            path: parts.slice(0, idx + 1).join("/")
          };
        }
        node = node.children[part];
      });
    });
    return root;
  }

  function sortEntries(children) {
    return Object.values(children).sort(function (a, b) {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  // ---------- Render tree ----------

  function renderNode(node, depth) {
    var wrap = document.createElement("div");
    wrap.className = "node";
    wrap.dataset.type = node.type;
    wrap.dataset.name = node.name.toLowerCase();

    var row = document.createElement("div");
    row.className = "node-row";

    if (node.type === "folder") {
      row.innerHTML =
        ICONS.chevron +
        '<span class="node-icon">' + ICONS.folder + "</span>" +
        '<span class="node-label">' + escapeHtml(node.name) + "</span>";

      var childWrap = document.createElement("div");
      childWrap.className = "children";
      sortEntries(node.children).forEach(function (child) {
        childWrap.appendChild(renderNode(child, depth + 1));
      });

      row.addEventListener("click", function () {
        wrap.classList.toggle("expanded");
        var icon = row.querySelector(".node-icon");
        icon.innerHTML = wrap.classList.contains("expanded") ? ICONS.folderOpen : ICONS.folder;
      });

      wrap.appendChild(row);
      wrap.appendChild(childWrap);
    } else {
      row.innerHTML =
        '<span class="chevron" style="visibility:hidden">' + "&#9656;" + "</span>" +
        '<span class="node-icon">' + ICONS.file + "</span>" +
        '<span class="node-label">' + escapeHtml(node.name) + "</span>";
      row.addEventListener("click", function () {
        document.querySelectorAll(".node-row.active").forEach(function (el) {
          el.classList.remove("active");
        });
        row.classList.add("active");
        openFile(node.path);
        if (window.innerWidth <= 720) sidebarEl.classList.add("collapsed");
      });
      wrap.appendChild(row);
    }

    return wrap;
  }

  function renderTree(root) {
    folderTreeEl.innerHTML = "";
    var frag = document.createDocumentFragment();
    sortEntries(root.children).forEach(function (child) {
      frag.appendChild(renderNode(child, 0));
    });
    folderTreeEl.appendChild(frag);
  }

  // ---------- App view ----------
  //
  // Folder view lists the repository verbatim. App view is a curated read of
  // the same tree: every folder holding an Arduino sketch becomes a project
  // block, and the web app and README belonging to that project are grouped
  // underneath it — sketch, then web app, then README.

  var SKETCH_EXTS = ["ino", "pde"];

  function baseName(path) {
    return path.split("/").pop();
  }

  function isSketchPath(path) {
    return SKETCH_EXTS.indexOf(ext(baseName(path))) !== -1;
  }

  function isReadmePath(path) {
    return /^readme\.(md|markdown)$/i.test(baseName(path));
  }

  function isWebAppPath(path) {
    return /^index\.html?$/i.test(baseName(path));
  }

  // Walks up from a directory to the closest folder already known to be a
  // project, so a web app nested in its own subfolder still lands in the
  // block for the sketch it belongs to.
  function nearestProjectDir(projects, startDir) {
    var dir = startDir;
    for (;;) {
      if (Object.prototype.hasOwnProperty.call(projects, dir)) return dir;
      if (dir === "") return null;
      dir = dirOf(dir);
    }
  }

  function buildProjects(paths) {
    var projects = Object.create(null);
    function project(dir) {
      if (!Object.prototype.hasOwnProperty.call(projects, dir)) {
        projects[dir] = { dir: dir, sketches: [], webApps: [], readme: null };
      }
      return projects[dir];
    }

    // Sketches define the projects; sorting first keeps assignment deterministic.
    paths.filter(isSketchPath).sort().forEach(function (p) {
      project(dirOf(p)).sketches.push(p);
    });

    // A web app joins the nearest enclosing project. With none — a repo that is
    // only a web app, say — its own folder becomes the project.
    paths.filter(isWebAppPath).sort().forEach(function (p) {
      var dir = dirOf(p);
      var owner = nearestProjectDir(projects, dir);
      project(owner === null ? dir : owner).webApps.push(p);
    });

    var repoReadme = null;
    paths.filter(isReadmePath).sort().forEach(function (p) {
      var dir = dirOf(p);
      if (dir === "") { repoReadme = p; return; } // the repository's own README
      var owner = nearestProjectDir(projects, dir);
      var target = project(owner === null ? dir : owner);
      if (!target.readme) target.readme = p;
    });

    return {
      repoReadme: repoReadme,
      projects: Object.keys(projects).sort().map(function (dir) { return projects[dir]; })
    };
  }

  // What each kind is called in the sidebar. `useFileName` means the file
  // header names the actual file instead of repeating the generic label —
  // which sketch does, since the .ino name is what identifies the code.
  var APP_ENTRY_KINDS = {
    sketch: { label: "Arduino Sketch", icon: ICONS.chip, useFileName: true },
    webapp: { label: "Web App", icon: ICONS.browser, lockEdit: true },
    readme: { label: "Readme", icon: ICONS.book, lockEdit: true }
  };

  function appEntryRow(kind, path, ownLabel) {
    var meta = APP_ENTRY_KINDS[kind];
    var text = ownLabel || meta.label;
    var headerLabel = meta.useFileName ? baseName(path) : meta.label;
    var row = document.createElement("div");
    row.className = "node-row app-entry";
    row.dataset.name = (text + " " + baseName(path)).toLowerCase();
    row.innerHTML =
      '<span class="node-icon">' + meta.icon + "</span>" +
      '<span class="node-label">' + escapeHtml(text) + "</span>";
    row.addEventListener("click", function () {
      document.querySelectorAll(".node-row.active").forEach(function (el) {
        el.classList.remove("active");
      });
      row.classList.add("active");
      openFile(path, { label: headerLabel, lockEdit: !!meta.lockEdit });
      if (window.innerWidth <= 720) sidebarEl.classList.add("collapsed");
    });
    return row;
  }

  // A falsy title omits the heading entirely — used for the repo README,
  // which has no project name to head it with and just reads "Readme".
  function appBlock(title, dataName) {
    var block = document.createElement("div");
    block.className = "app-block";
    block.dataset.name = (dataName || title || "").toLowerCase();
    if (title) block.innerHTML = '<div class="app-block-title">' + escapeHtml(title) + "</div>";
    return block;
  }

  function renderAppList(model) {
    appListEl.innerHTML = "";
    var frag = document.createDocumentFragment();

    model.projects.forEach(function (pr) {
      var block = appBlock(formatTitle(baseName(pr.dir) || pr.dir), pr.dir);
      // Firmware, then web app, then README.
      pr.sketches.forEach(function (p) {
        block.appendChild(appEntryRow("sketch", p, pr.sketches.length > 1 ? baseName(p) : null));
      });
      pr.webApps.forEach(function (p) {
        block.appendChild(appEntryRow("webapp", p, pr.webApps.length > 1 ? baseName(dirOf(p)) : null));
      });
      if (pr.readme) block.appendChild(appEntryRow("readme", pr.readme));
      frag.appendChild(block);
    });

    // The repository's own README opens the list, before the projects — just
    // "Readme", with no "Repository" heading above it.
    if (model.repoReadme) {
      var repoBlock = appBlock(null, "repository readme");
      repoBlock.appendChild(appEntryRow("readme", model.repoReadme));
      frag.insertBefore(repoBlock, frag.firstChild);
    }

    if (!frag.childNodes.length) {
      appListEl.innerHTML =
        '<div class="tree-loading">No Arduino sketches, web apps or READMEs found here. ' +
        "Switch to Folders to browse the whole repository.</div>";
      return false;
    }
    appListEl.appendChild(frag);
    return true;
  }

  // ---------- Sidebar view switching ----------

  var sidebarView = "app"; // "app" | "folders"

  function setSidebarView(next) {
    sidebarView = next;
    appViewBtn.classList.toggle("active", next === "app");
    folderViewBtn.classList.toggle("active", next === "folders");
    appViewBtn.setAttribute("aria-pressed", String(next === "app"));
    folderViewBtn.setAttribute("aria-pressed", String(next === "folders"));
    if (appListEl) appListEl.style.display = next === "app" ? "block" : "none";
    if (folderTreeEl) folderTreeEl.style.display = next === "folders" ? "block" : "none";
    applyFilter();
  }

  appViewBtn.addEventListener("click", function () {
    if (sidebarView !== "app") setSidebarView("app");
  });
  folderViewBtn.addEventListener("click", function () {
    if (sidebarView !== "folders") setSidebarView("folders");
  });

  function renderSidebar(root, paths) {
    treeEl.innerHTML = "";
    appListEl = document.createElement("div");
    appListEl.className = "app-list";
    folderTreeEl = document.createElement("div");
    folderTreeEl.className = "folder-tree";
    treeEl.appendChild(appListEl);
    treeEl.appendChild(folderTreeEl);

    renderTree(root);
    var hasApps = renderAppList(buildProjects(paths));
    // Nothing to curate (a repo with no sketches, apps or READMEs) — the
    // folder tree is the only useful view, so start there.
    setSidebarView(hasApps ? "app" : "folders");
  }

  // ---------- Filter ----------

  fileFilterEl.addEventListener("input", applyFilter);

  function applyFilter() {
    var q = fileFilterEl.value.trim().toLowerCase();
    if (sidebarView === "app") filterAppList(q);
    else filterFolderTree(q);
  }

  // A block stays if its own name matches (keeping all its entries) or if any
  // entry inside it does.
  function filterAppList(q) {
    if (!appListEl) return;
    var blocks = appListEl.querySelectorAll(".app-block");
    Array.prototype.forEach.call(blocks, function (block) {
      var titleMatch = !q || block.dataset.name.indexOf(q) !== -1;
      var anyEntry = false;
      Array.prototype.forEach.call(block.querySelectorAll(".app-entry"), function (row) {
        var match = titleMatch || row.dataset.name.indexOf(q) !== -1;
        row.classList.toggle("hidden", !match);
        if (match) anyEntry = true;
      });
      block.classList.toggle("hidden", !anyEntry);
    });
  }

  function filterFolderTree(q) {
    if (!folderTreeEl) return;
    var allNodes = folderTreeEl.querySelectorAll(".node");
    if (!q) {
      allNodes.forEach(function (n) { n.classList.remove("hidden"); });
      return;
    }
    allNodes.forEach(function (n) {
      if (n.dataset.type === "file") {
        var match = n.dataset.name.indexOf(q) !== -1;
        n.classList.toggle("hidden", !match);
        if (match) {
          var p = n.parentElement;
          while (p && p !== folderTreeEl) {
            if (p.classList && p.classList.contains("node")) {
              p.classList.remove("hidden");
              p.classList.add("expanded");
            }
            p = p.parentElement;
          }
        }
      }
    });
    // Process deepest folders first so a parent's visibility check sees
    // its children's *final* hidden state, not their pre-update state.
    Array.prototype.slice.call(allNodes).reverse().forEach(function (n) {
      if (n.dataset.type === "folder") {
        var anyVisible = n.querySelector(".node:not(.hidden)");
        n.classList.toggle("hidden", !anyVisible);
      }
    });
  }

  // ---------- File content cache + background prefetch ----------
  //
  // Every text file's raw content gets fetched in the background (limited
  // concurrency) right after the tree loads, so most clicks resolve from
  // cache instantly. Clicking a file that hasn't been reached by the
  // background queue yet just starts its fetch immediately, in parallel
  // with the queue — it never waits for its turn.

  var fileCache = {}; // path -> { promise, text, loaded, total, listeners }

  function notifyProgress(record) {
    record.listeners.forEach(function (fn) { fn(record.loaded, record.total); });
  }

  function fetchFileContent(path) {
    var entry = fileCache[path];
    if (entry) return entry.promise;

    var rawUrl = RAW_BASE + path.split("/").map(encodeURIComponent).join("/");
    var record = { loaded: 0, total: null, listeners: [] };
    record.promise = fetch(rawUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        // Stream the body so an in-flight download can report progress to
        // whoever is watching (the loading bar). Content-Length may be the
        // compressed size, so consumers should clamp the ratio at 99%.
        record.total = parseInt(res.headers.get("Content-Length"), 10) || null;
        if (!res.body || !res.body.getReader) return res.text();

        var reader = res.body.getReader();
        var chunks = [];
        function pump() {
          return reader.read().then(function (step) {
            if (step.done) {
              var size = 0;
              chunks.forEach(function (c) { size += c.length; });
              var all = new Uint8Array(size);
              var offset = 0;
              chunks.forEach(function (c) { all.set(c, offset); offset += c.length; });
              return new TextDecoder("utf-8").decode(all);
            }
            chunks.push(step.value);
            record.loaded += step.value.length;
            notifyProgress(record);
            return pump();
          });
        }
        return pump();
      })
      .then(function (text) {
        record.text = text;
        return text;
      })
      .catch(function (err) {
        delete fileCache[path]; // don't poison the cache; allow retry
        throw err;
      });
    fileCache[path] = record;
    return record.promise;
  }

  function prefetchAll(paths) {
    var CONCURRENCY = 6;
    var i = 0;
    function pump() {
      if (i >= paths.length) return;
      var path = paths[i++];
      fetchFileContent(path).catch(function () { /* surfaced on click instead */ }).then(pump);
    }
    for (var k = 0; k < CONCURRENCY && k < paths.length; k++) pump();
  }

  // ---------- File viewer ----------

  function repoBlobUrl(path) {
    return REPO_URL + "/blob/" + BRANCH + "/" + path.split("/").map(encodeURIComponent).join("/");
  }

  // App view names most entries by what they are ("Web App", "Readme") rather
  // than by path; a sketch is named by its actual filename instead, since
  // that's what identifies the code. Folder view always passes the path
  // itself. Either way the full path stays available on hover.
  function pathHeaderHtml(label, path, actionsHtml) {
    return (
      '<div class="file-panel-header">' +
      '<div class="file-title-group">' +
      '<span class="file-path" title="' + escapeHtml(path) + '">' + escapeHtml(label) + "</span>" +
      '<a class="header-github-link" href="' + escapeHtml(repoBlobUrl(path)) + '" target="_blank" rel="noopener" ' +
      'title="Open ' + escapeHtml(path) + ' on GitHub" aria-label="Open on GitHub">' + ICONS.github + "</a>" +
      "</div>" +
      (actionsHtml ? '<div class="file-panel-actions">' + actionsHtml + "</div>" : "") +
      "</div>"
    );
  }

  // Header row + a scrolling body beneath it. Keeping the body a separate
  // element is what puts the scrollbar below the header instead of alongside
  // it, matching the sidebar.
  function filePanelHtml(label, path, actionsHtml, bodyHtml, panelId) {
    return (
      '<div class="file-panel"' + (panelId ? ' id="' + panelId + '"' : "") + ">" +
      pathHeaderHtml(label, path, actionsHtml) +
      '<div class="file-panel-body">' + bodyHtml + "</div>" +
      "</div>"
    );
  }

  function openFile(path, opts) {
    opts = opts || {};
    var label = opts.label || path;
    var name = path.split("/").pop();
    var e = ext(name);
    var rawUrl = RAW_BASE + path.split("/").map(encodeURIComponent).join("/");

    if (IMAGE_EXTS.indexOf(e) !== -1) {
      contentEl.innerHTML = filePanelHtml(label, path, "",
        '<div class="image-preview"><img src="' + escapeHtml(rawUrl) + '" alt="' + escapeHtml(name) + '"/></div>');
      return;
    }

    if (BINARY_EXTS.indexOf(e) !== -1) {
      var blobUrl = repoBlobUrl(path);
      contentEl.innerHTML = filePanelHtml(label, path, "",
        '<div class="binary-notice">This is a binary file and can\'t be previewed here.<br/><a href="' +
        escapeHtml(blobUrl) + '" target="_blank" rel="noopener">Open on GitHub</a></div>');
      return;
    }

    var cached = fileCache[path];
    if (cached && cached.text !== undefined) {
      renderFile(name, path, cached.text, opts);
      return;
    }

    contentEl.innerHTML = filePanelHtml(label, path, "",
      '<div class="loading-track"><div class="loading-fill indeterminate" id="loadingFill"></div></div>' +
      '<div class="loading-msg">Loading ' + escapeHtml(name) + '&hellip; <span id="loadingPct"></span></div>');

    var fillEl = document.getElementById("loadingFill");
    var pctEl = document.getElementById("loadingPct");
    var onProgress = function (loaded, total) {
      if (!fillEl.isConnected) return;
      if (total) {
        // Content-Length can be the compressed size, so cap below 100%
        // until the download actually finishes.
        var pct = Math.min(99, Math.round((loaded / total) * 100));
        fillEl.classList.remove("indeterminate");
        fillEl.style.width = pct + "%";
        pctEl.textContent = pct + "%";
      } else {
        pctEl.textContent = (loaded / 1024).toFixed(0) + " KB";
      }
    };

    var promise = fetchFileContent(path);
    var record = fileCache[path];
    if (record && record.listeners) {
      record.listeners.push(onProgress);
      if (record.loaded > 0) onProgress(record.loaded, record.total);
    }

    promise
      .then(function (text) {
        renderFile(name, path, text, opts);
      })
      .catch(function (err) {
        contentEl.innerHTML =
          '<div class="error-msg">Could not load ' + escapeHtml(path) + " (" + escapeHtml(err.message) + ").</div>";
      })
      .then(function () {
        if (record && record.listeners) {
          var i = record.listeners.indexOf(onProgress);
          if (i !== -1) record.listeners.splice(i, 1);
        }
      });
  }

  // Absolute URLs, protocol-relative URLs, data: URIs and bare fragments all
  // work as written; only repo-relative ones need re-pointing.
  function isRelativeUrl(url) {
    return !!url && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);
  }

  function dirOf(path) {
    return path.indexOf("/") === -1 ? "" : path.slice(0, path.lastIndexOf("/"));
  }

  function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  // Turns a path written relative to `fromDir` into one relative to the repo
  // root, collapsing "." and ".." along the way. A leading "/" is read as
  // repo-root-relative, which is how GitHub treats it in a README. The result
  // is a literal path, matching how the git tree lists it.
  function resolveRepoPath(fromDir, target) {
    var segments = target.charAt(0) === "/" ? [] : fromDir.split("/").filter(Boolean);
    target.split("/").forEach(function (seg) {
      if (!seg || seg === ".") return;
      if (seg === "..") segments.pop();
      else segments.push(seg);
    });
    return segments.map(function (seg) {
      // Authors write these either encoded ("my%20photo.png") or raw
      // ("my photo.png"); decoding normalizes both to the literal name.
      try { return decodeURIComponent(seg); } catch (e) { return seg; }
    }).join("/");
  }

  function rawUrlFor(fromDir, target) {
    return RAW_BASE + encodePath(resolveRepoPath(fromDir, target));
  }

  // Markdown images are written relative to the file holding them, so on their
  // own they'd resolve against this page's origin instead of the repo.
  function rewriteRelativeImages(root, mdPath) {
    var dir = dirOf(mdPath);
    var imgs = root.querySelectorAll("img[src]");
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute("src") || "";
      if (!isRelativeUrl(src)) continue;
      var bare = src.split(/[?#]/)[0]; // "logo.png?raw=true" -> "logo.png"
      if (!bare) continue;
      imgs[i].setAttribute("src", rawUrlFor(dir, bare));
    }
  }

  function renderMarkdownInto(el, text, mdPath) {
    el.textContent = "";
    if (!(window.marked && window.DOMPurify)) {
      // Without both libraries, never inject unsanitized HTML — plain text only.
      var pre = document.createElement("pre");
      pre.textContent = text;
      el.appendChild(pre);
      return;
    }
    // Sanitize to a fragment rather than a string so the image sources can be
    // corrected before the nodes enter the page — no request ever goes out
    // for the unresolved path.
    var frag = window.DOMPurify.sanitize(window.marked.parse(text), { RETURN_DOM_FRAGMENT: true });
    rewriteRelativeImages(frag, mdPath);
    el.appendChild(frag);
  }

  // ---------- Live web-app preview ----------
  //
  // raw.githubusercontent.com serves every file as "text/plain" with
  // X-Content-Type-Options: nosniff, so an iframe can't simply point at a
  // repo's index.html — the browser refuses to treat it as HTML, and refuses
  // to apply the stylesheets or run the scripts it links. The document is
  // therefore reassembled here: a <base> tag re-points everything that raw
  // *can* still serve (images, media, fetch/XHR), and the CSS and JS that MIME
  // enforcement would reject get inlined out of the same cache the file
  // viewer already fills by prefetching the repo.
  //
  // The result runs in a sandboxed frame with no allow-same-origin, so the
  // repo's code gets an opaque origin: it cannot touch this page, its storage,
  // or its DOM. That isolation is the point — never add allow-same-origin,
  // which would hand arbitrary repo JS full control of the explorer.

  var APP_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock";
  // Hardware permissions these firmware apps tend to reach for. The frame stays
  // cross-origin, so a browser may refuse them anyway; the app's own capability
  // check is then what the visitor sees.
  var APP_ALLOW = "serial; usb; hid; bluetooth; midi; accelerometer; gyroscope; camera; microphone";

  function isHtmlFile(name) {
    var e = ext(name);
    return e === "html" || e === "htm";
  }

  // The opaque origin that makes the frame safe also makes touching
  // localStorage throw a SecurityError — enough to kill an app on its first
  // line. This stand-in keeps those apps running; whatever they store lasts
  // only as long as the preview. It reaches the frame via toString(), so it
  // has to stay self-contained ES5.
  function installStorageShim() {
    function memoryStorage() {
      var data = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        clear: function () { data = {}; },
        key: function (i) { return Object.keys(data)[i] || null; },
        get length() { return Object.keys(data).length; }
      };
    }
    ["localStorage", "sessionStorage"].forEach(function (name) {
      try {
        window[name].getItem("probe");
      } catch (blocked) {
        try {
          Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
        } catch (ignored) {}
      }
    });
  }

  // Opening a device chooser (navigator.serial.requestPort() and the USB/HID
  // equivalents) while this frame is *itself* the fullscreen element is what
  // never shows the picker at all — Chromium apparently can't cleanly
  // interleave "exit fullscreen" and "show a native chooser" as simultaneous
  // side-effects of the same call when the fullscreen element is an iframe;
  // the call just stalls. So rather than let the browser attempt that, this
  // wrapper asks the parent explorer to fully exit fullscreen FIRST and wait
  // for that to finish, and only then invokes the real API — by which point
  // the frame is definitely not fullscreen, and there's nothing left to
  // interleave. The round trip is a couple of postMessages, not a network
  // call, so it doesn't run long enough to expire the click's user
  // activation (which requestPort() itself still requires).
  //
  // Deliberately does NOT try to return to fullscreen afterward — an earlier
  // version did, and it made things worse: the auto-return felt like an
  // unwanted glitch, and worse, it fired even when the app hadn't been
  // fullscreen to begin with. Once the chooser is done, this just leaves the
  // page exactly where a normal, non-fullscreen page would.
  //
  // A safety-net timeout calls through on its own if nothing answers — e.g.
  // this file opened standalone, outside the explorer. Reaches the frame via
  // toString(), so it has to stay self-contained ES5.
  function installChooserNotifier() {
    function wrap(obj, method, api) {
      if (!obj || typeof obj[method] !== "function") return;
      var original = obj[method];
      obj[method] = function () {
        var args = arguments, self = this, called = false;
        function callOriginal() {
          if (called) return null;
          called = true;
          return original.apply(self, args);
        }
        return new Promise(function (resolve, reject) {
          function proceed() {
            window.removeEventListener("message", onReady);
            var result = callOriginal();
            if (result) result.then(resolve, reject);
          }
          function onReady(ev) {
            if (!ev.data || ev.data.bioampExplorerChooserReady !== api) return;
            proceed();
          }
          window.addEventListener("message", onReady);
          try { window.parent.postMessage({ bioampExplorerChooser: api }, "*"); } catch (ignored) {}
          setTimeout(proceed, 400);
        });
      };
    }
    wrap(window.navigator.serial, "requestPort", "serial");
    wrap(window.navigator.usb, "requestDevice", "usb");
    wrap(window.navigator.hid, "requestDevice", "hid");
  }

  // An inlined stylesheet's url() references were written relative to the CSS
  // file, not to the page, so they have to be resolved before the <base> gets
  // a chance to resolve them against the wrong directory.
  function rewriteCssUrls(css, cssDir) {
    return css.replace(/url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi, function (whole, quote, target) {
      if (!isRelativeUrl(target)) return whole;
      var bare = target.split(/[?#]/)[0];
      return bare ? "url(" + quote + rawUrlFor(cssDir, bare) + quote + ")" : whole;
    });
  }

  function inlineAssets(doc, dir, selector, urlAttr, replaceWith) {
    var tags = doc.querySelectorAll(selector);
    var jobs = [];
    Array.prototype.forEach.call(tags, function (tag) {
      var url = tag.getAttribute(urlAttr);
      if (!isRelativeUrl(url)) return;
      var assetPath = resolveRepoPath(dir, url.split(/[?#]/)[0]);
      jobs.push(
        fetchFileContent(assetPath).then(function (content) {
          tag.parentNode.replaceChild(replaceWith(doc, tag, content, assetPath), tag);
        }, function () {
          // Leave the original tag in place; the frame just loses that asset.
        })
      );
    });
    return jobs;
  }

  function buildAppDocument(htmlText, htmlPath) {
    var dir = dirOf(htmlPath);
    // A DOMParser document is inert: nothing loads and no script runs until
    // the serialized result is handed to the frame.
    var doc = new DOMParser().parseFromString(htmlText, "text/html");

    Array.prototype.forEach.call(doc.querySelectorAll("base"), function (tag) {
      tag.parentNode.removeChild(tag);
    });
    var base = doc.createElement("base");
    base.setAttribute("href", RAW_BASE + (dir ? encodePath(dir) + "/" : ""));
    doc.head.insertBefore(base, doc.head.firstChild);

    var shim = doc.createElement("script");
    shim.textContent = "(" + installStorageShim + ")();(" + installChooserNotifier + ")();";
    doc.head.insertBefore(shim, base.nextSibling);

    var jobs = inlineAssets(doc, dir, 'link[rel~="stylesheet"][href]', "href", function (d, tag, css, p) {
      var style = d.createElement("style");
      style.textContent = rewriteCssUrls(css, dirOf(p));
      return style;
    }).concat(
      inlineAssets(doc, dir, "script[src]", "src", function (d, tag, js) {
        var inline = d.createElement("script");
        if (tag.getAttribute("type")) inline.setAttribute("type", tag.getAttribute("type"));
        // A literal </script> inside a string would close the tag early once
        // this document is serialized back to text.
        inline.textContent = js.replace(/<\/script/gi, "<\\/script");
        return inline;
      })
    );

    return Promise.all(jobs).then(function () {
      return "<!doctype html>\n" + doc.documentElement.outerHTML;
    });
  }

  function renderFile(name, path, text, opts) {
    opts = opts || {};
    var label = opts.label || path;
    // App view presents a web app as an app, not as source, so editing is
    // locked there; the same file is still editable from folder view.
    var lockEdit = !!opts.lockEdit;
    var lang = LANG_MAP[ext(name)] || "plaintext";
    var isMarkdown = lang === "markdown";
    var isHtml = isHtmlFile(name);
    var lines = text.split("\n").length;
    var sizeKb = (new Blob([text]).size / 1024).toFixed(1);

    var actionsHtml =
      '<span class="file-meta">' + lines + " lines &middot; " + sizeKb + " KB</span>" +
      '<div class="mode-toggle" id="modeToggle" role="group" aria-label="View or edit mode">' +
      '<button type="button" class="mode-btn active" id="viewModeBtn">' + ICONS.eye + "<span>View</span></button>" +
      '<button type="button" class="mode-btn" id="editModeBtn"' +
      (lockEdit ? ' disabled title="Editing is locked in Apps view — open it from Folders to edit the source."' : "") +
      ">" + ICONS.pencil + "<span>Edit</span></button>" +
      "</div>" +
      (isHtml
        ? '<button type="button" class="fullscreen-btn" id="fullscreenBtn">' +
          ICONS.expand + "<span>Fullscreen</span></button>"
        : "") +
      '<button class="copy-btn" id="copyBtn">' + ICONS.copy + "<span>Copy</span></button>";

    contentEl.innerHTML = filePanelHtml(label, path, actionsHtml,
      '<textarea id="editBlock" class="code-edit" spellcheck="false"></textarea>' +
      (isMarkdown ? '<div class="md-preview" id="mdPreview"></div>' : "") +
      (isHtml
        ? '<div class="loading-msg" id="appStatus"></div>' +
          // Fullscreen targets this wrapper rather than the iframe itself.
          // The iframe alone, once promoted to the browser's top layer, would
          // cover the header button that opened it — there'd be no way back
          // except Esc. The exit button lives inside the wrapper instead, so
          // it enters the top layer too and stays reachable.
          '<div class="app-frame-wrap" id="appFrameWrap">' +
          '<iframe id="appFrame" class="app-frame" title="' + escapeHtml(name) + ' preview"' +
          ' sandbox="' + APP_SANDBOX + '" allow="' + APP_ALLOW + '" referrerpolicy="no-referrer"></iframe>' +
          '<button type="button" class="app-exit-fullscreen" id="exitFullscreenBtn" title="Exit fullscreen">' +
          ICONS.collapse + "</button>" +
          "</div>"
        : ""),
      "filePanel");

    var filePanelEl = document.getElementById("filePanel");
    var editEl = document.getElementById("editBlock");
    var viewBtn = document.getElementById("viewModeBtn");
    var editBtn = document.getElementById("editModeBtn");
    var previewEl = document.getElementById("mdPreview");
    var appFrameEl = document.getElementById("appFrame");
    var appFrameWrapEl = document.getElementById("appFrameWrap");
    var appStatusEl = document.getElementById("appStatus");
    var fullscreenBtn = document.getElementById("fullscreenBtn");
    var exitFullscreenBtn = document.getElementById("exitFullscreenBtn");
    var copyBtn = document.getElementById("copyBtn");
    var mode = "view"; // "view" | "edit"
    var cm = null;

    editEl.value = text;

    // A single persistent editor backs View and Edit (toggling readOnly), so
    // there is no second element to swap to/from and nothing can shift.
    //
    // The editor fills the panel body and scrolls itself, which lets it render
    // only the lines around the viewport. Sizing it to its content instead
    // would force every line to be laid out during the click — on a 650-line
    // sketch that alone cost ~400ms of blocked UI.
    var LARGE_FILE_CHARS = 1500000;
    if (window.CodeMirror && text.length < LARGE_FILE_CHARS) {
      cm = window.CodeMirror.fromTextArea(editEl, {
        mode: CM_MODE_MAP[lang] || null,
        theme: "onedark",
        lineNumbers: true,
        matchBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        readOnly: "nocursor",
        // A little beyond the viewport, so ordinary scrolling stays ahead of
        // the renderer without paying for the whole document.
        viewportMargin: 30
      });
      cm.setSize("100%", "100%");
    } else {
      editEl.readOnly = true; // fallback viewer starts in View mode
    }

    function getCurrentText() {
      return cm ? cm.getValue() : editEl.value;
    }

    // Rebuilt only when the source actually differs, so flipping to Edit and
    // back leaves a running app alone rather than restarting it.
    var runningSource = null;

    function startApp() {
      var source = getCurrentText();
      if (runningSource === source) return;
      runningSource = source;
      appFrameEl.removeAttribute("srcdoc");
      appStatusEl.textContent = "Starting app…";
      appStatusEl.style.display = "block";
      buildAppDocument(source, path).then(
        function (html) {
          if (!appFrameEl.isConnected || runningSource !== source) return;
          appFrameEl.setAttribute("srcdoc", html);
          appStatusEl.style.display = "none";
        },
        function (err) {
          if (!appFrameEl.isConnected || runningSource !== source) return;
          runningSource = null; // let a later switch retry
          appStatusEl.textContent = "Could not start the app (" + err.message + ").";
        }
      );
    }

    function setMode(next) {
      mode = next;
      viewBtn.classList.toggle("active", mode === "view");
      editBtn.classList.toggle("active", mode === "edit");
      filePanelEl.classList.toggle("editing", mode === "edit");

      // Markdown reads as a rendered document in View and HTML runs as a live
      // app; both show their source in Edit. Every other type keeps the same
      // editor in both modes.
      var showRendered = isMarkdown && mode === "view";
      var showApp = isHtml && mode === "view";
      var showEditor = !showRendered && !showApp;

      filePanelEl.classList.toggle("running-app", showApp);

      if (previewEl) {
        if (showRendered) renderMarkdownInto(previewEl, getCurrentText(), path);
        previewEl.style.display = showRendered ? "block" : "none";
      }

      if (appFrameWrapEl) {
        appFrameWrapEl.style.display = showApp ? "flex" : "none";
        if (showApp) startApp();
        else appStatusEl.style.display = "none";
      }

      // Fullscreen only makes sense while the app is actually running, not
      // while its source is on screen.
      if (fullscreenBtn) {
        fullscreenBtn.style.display = showApp ? "flex" : "none";
        if (!showApp && document.fullscreenElement === appFrameWrapEl) document.exitFullscreen();
      }

      if (cm) {
        cm.getWrapperElement().style.display = showEditor ? "block" : "none";
        if (showEditor) cm.refresh(); // remeasure after being hidden
        // Only flip editability. No focus()/setCursor() call here — either
        // one plants a caret and can scroll the view to it. The cursor
        // should not exist anywhere until the user actually clicks in.
        cm.setOption("readOnly", mode === "edit" ? false : "nocursor");
      } else {
        editEl.style.display = showEditor ? "block" : "none";
        editEl.readOnly = mode !== "edit";
      }
    }

    setMode("view");

    viewBtn.addEventListener("click", function () { if (mode !== "view") setMode("view"); });
    if (!lockEdit) {
      editBtn.addEventListener("click", function () { if (mode !== "edit") setMode("edit"); });
    }

    if (fullscreenBtn) {
      var enterFullscreen = function () {
        appFrameWrapEl.requestFullscreen().catch(function () { /* denied or unsupported; button just stays put */ });
      };
      fullscreenBtn.addEventListener("click", function () {
        if (document.fullscreenElement === appFrameWrapEl) document.exitFullscreen();
        else enterFullscreen();
      });
      // The header button becomes unreachable once fullscreen starts — it's
      // outside the wrapper, so the browser's top-layer promotion covers it.
      // This is the button that stays reachable, drawn as an overlay inside
      // the wrapper so it's promoted along with the app.
      exitFullscreenBtn.addEventListener("click", function () { document.exitFullscreen(); });

      // Opening a device chooser (Web Serial/USB/HID) forces the browser out
      // of fullscreen — that's the browser protecting the permission dialog
      // from being drawn over by page content, and no page can prevent it.
      // (Not even pressing F11 instead of a page button avoids this: F11 is
      // OS/browser-chrome fullscreen, entirely separate from the Fullscreen
      // API a page's own button has to use — it never touches
      // document.fullscreenElement, so the browser never needs to fire an
      // exit for it. Any *page-triggered* fullscreen goes through the same
      // API this does, so this exit is unavoidable here regardless of how
      // the button is built.)
      //
      // Deliberately does NOT try to return to fullscreen once the chooser is
      // done — a stayed there, silently, exactly like leaving fullscreen on
      // any other site. Set only when we ourselves triggered the exit for a
      // chooser (below), so a plain Escape press never shows it, and it's
      // reset on every use so it can only ever fire for the exit that caused
      // it — not some unrelated one that happens to follow it.
      var chooserRequestedWhileFullscreen = false;

      function showReentryToast() {
        var old = document.getElementById("fsReentryToast");
        if (old) old.remove();
        var toast = document.createElement("div");
        toast.id = "fsReentryToast";
        toast.className = "fs-reentry-toast";
        toast.innerHTML =
          "<span>Exited fullscreen to show the device picker.</span>" +
          '<button type="button">' + ICONS.expand + "<span>Back to Fullscreen</span></button>";
        toast.querySelector("button").addEventListener("click", function () {
          toast.remove();
          enterFullscreen(); // a fresh click, so it carries real user activation
        });
        filePanelEl.appendChild(toast);
        setTimeout(function () { if (toast.isConnected) toast.remove(); }, 8000);
      }

      window.addEventListener("message", function onAppMessage(ev) {
        if (!appFrameEl.isConnected) {
          window.removeEventListener("message", onAppMessage);
          return;
        }
        if (ev.source !== appFrameEl.contentWindow || !ev.data) return;

        var api = ev.data.bioampExplorerChooser;
        if (!api) return;

        function ack() {
          try { appFrameEl.contentWindow.postMessage({ bioampExplorerChooserReady: api }, "*"); } catch (ignored) {}
        }
        // Exit first and wait for it to actually finish before telling the
        // app it can call the real API — that ordering is the fix (see
        // installChooserNotifier above). Nothing to do if it's already not
        // fullscreen, which is the common case — no exit, no toast, no
        // change in behavior at all versus a plain, non-fullscreen page.
        if (document.fullscreenElement === appFrameWrapEl) {
          chooserRequestedWhileFullscreen = true;
          document.exitFullscreen().then(ack, ack);
        } else {
          ack();
        }
      });

      // Fires for both directions — either button's click, and Escape/browser
      // chrome — so the header label is kept in sync from here rather than
      // its own click handler. Self-unsubscribes once this panel is torn
      // down, since a fresh renderFile() never reuses this listener.
      document.addEventListener("fullscreenchange", function onFullscreenChange() {
        if (!fullscreenBtn.isConnected) {
          document.removeEventListener("fullscreenchange", onFullscreenChange);
          return;
        }
        var isFs = document.fullscreenElement === appFrameWrapEl;
        fullscreenBtn.classList.toggle("active", isFs);
        fullscreenBtn.innerHTML = (isFs ? ICONS.collapse : ICONS.expand) +
          "<span>" + (isFs ? "Exit Fullscreen" : "Fullscreen") + "</span>";
        if (!isFs && chooserRequestedWhileFullscreen) {
          chooserRequestedWhileFullscreen = false;
          showReentryToast();
        }
      });
    }

    copyBtn.addEventListener("click", function (ev) {
      var btn = ev.currentTarget;
      navigator.clipboard.writeText(getCurrentText()).then(function () {
        btn.classList.add("copied");
        btn.innerHTML = ICONS.check + "<span>Copied</span>";
        setTimeout(function () {
          btn.classList.remove("copied");
          btn.innerHTML = ICONS.copy + "<span>Copy</span>";
        }, 1500);
      });
    });
  }

  // ---------- Load repo metadata, then the tree ----------

  function showTreeError(message) {
    treeEl.innerHTML = '<div class="tree-error">' + escapeHtml(message) + "</div>";
  }

  function friendlyFetchError(err) {
    if (err.message === "RATE_LIMIT") {
      return "GitHub's public API rate limit was reached for your connection. Please wait a while and refresh, or browse the repository directly on GitHub.";
    }
    if (err.message === "FORBIDDEN") {
      return "GitHub denied access to this repository (it may be private, or restricted by an organization's SSO policy). Browse it directly on GitHub instead.";
    }
    return "Could not reach GitHub (" + err.message + ").";
  }

  function checkedJson(res) {
    if (res.status === 403) {
      // A 403 alone doesn't mean the rate limit was hit — GitHub also
      // returns it for abuse-detection triggers and SSO-protected orgs.
      // X-RateLimit-Remaining: 0 is what actually confirms exhaustion.
      throw new Error(res.headers.get("X-RateLimit-Remaining") === "0" ? "RATE_LIMIT" : "FORBIDDEN");
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  var detected = detectRepo();

  if (!detected.owner || !detected.repo) {
    showTreeError(
      "No repository specified. Append ?owner=<user>&repo=<name> to the URL " +
      "(optionally &branch=<branch>)."
    );
  } else {
    OWNER = detected.owner;
    REPO = detected.repo;
    REPO_URL = "https://github.com/" + OWNER + "/" + REPO;
    document.getElementById("githubLink").href = REPO_URL;

    fetch("https://api.github.com/repos/" + OWNER + "/" + REPO)
      .then(checkedJson)
      .then(function (info) {
        BRANCH = detected.branch || info.default_branch || "main";
        RAW_BASE = "https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/" + BRANCH + "/";
        API_TREE_URL = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/git/trees/" + BRANCH + "?recursive=1";

        var title = formatTitle(info.name || REPO);
        document.getElementById("repoTitle").textContent = title;
        document.getElementById("repoDescription").textContent = info.description || "";
        document.title = title;

        return fetch(API_TREE_URL).then(checkedJson);
      })
      .then(function (data) {
        if (data.truncated) {
          console.warn("Repository tree was truncated by the GitHub API; some files may be missing.");
        }
        var tree = data.tree || [];
        var filePaths = tree
          .filter(function (item) { return item.type === "blob"; })
          .map(function (item) { return item.path; });

        renderSidebar(buildTree(tree), filePaths);

        var textPaths = filePaths
          .filter(function (path) {
            var e = ext(path.split("/").pop());
            return IMAGE_EXTS.indexOf(e) === -1 && BINARY_EXTS.indexOf(e) === -1;
          });
        prefetchAll(textPaths);
      })
      .catch(function (err) {
        showTreeError(friendlyFetchError(err));
      });
  }
})();

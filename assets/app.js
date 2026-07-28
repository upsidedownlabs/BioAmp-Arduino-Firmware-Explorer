(function () {
  "use strict";

  // Filled in once the repo is detected/resolved (see bottom of file).
  var OWNER, REPO, BRANCH, REPO_URL, RAW_BASE, API_TREE_URL;

  var treeEl = document.getElementById("tree");
  var contentEl = document.getElementById("content");
  var sidebarEl = document.getElementById("sidebar");
  var fileFilterEl = document.getElementById("fileFilter");

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
    pencil: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>'
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
    treeEl.innerHTML = "";
    var frag = document.createDocumentFragment();
    sortEntries(root.children).forEach(function (child) {
      frag.appendChild(renderNode(child, 0));
    });
    treeEl.appendChild(frag);
  }

  // ---------- Filter ----------

  fileFilterEl.addEventListener("input", function () {
    var q = fileFilterEl.value.trim().toLowerCase();
    var allNodes = treeEl.querySelectorAll(".node");
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
          while (p && p !== treeEl) {
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
  });

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

  function pathHeaderHtml(path, actionsHtml) {
    return (
      '<div class="file-panel-header">' +
      '<div class="file-title-group">' +
      '<span class="file-path" title="' + escapeHtml(path) + '">' + escapeHtml(path) + "</span>" +
      "</div>" +
      (actionsHtml ? '<div class="file-panel-actions">' + actionsHtml + "</div>" : "") +
      "</div>"
    );
  }

  function openFile(path) {
    var name = path.split("/").pop();
    var e = ext(name);
    var rawUrl = RAW_BASE + path.split("/").map(encodeURIComponent).join("/");

    if (IMAGE_EXTS.indexOf(e) !== -1) {
      contentEl.innerHTML =
        '<div class="file-panel">' +
        pathHeaderHtml(path) +
        '<div class="image-preview"><img src="' + rawUrl + '" alt="' + escapeHtml(name) + '"/></div>' +
        "</div>";
      return;
    }

    if (BINARY_EXTS.indexOf(e) !== -1) {
      var blobUrl = REPO_URL + "/blob/" + BRANCH + "/" + path.split("/").map(encodeURIComponent).join("/");
      contentEl.innerHTML =
        '<div class="file-panel">' +
        pathHeaderHtml(path) +
        '<div class="binary-notice">This is a binary file and can\'t be previewed here.<br/><a href="' +
        blobUrl + '" target="_blank" rel="noopener">Open on GitHub</a></div>' +
        "</div>";
      return;
    }

    var cached = fileCache[path];
    if (cached && cached.text !== undefined) {
      renderFile(name, path, cached.text);
      return;
    }

    contentEl.innerHTML =
      '<div class="file-panel">' +
      pathHeaderHtml(path) +
      '<div class="loading-track"><div class="loading-fill indeterminate" id="loadingFill"></div></div>' +
      '<div class="loading-msg">Loading ' + escapeHtml(name) + '&hellip; <span id="loadingPct"></span></div>' +
      "</div>";

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
        renderFile(name, path, text);
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

  // Turns a path written relative to `fromDir` into one relative to the repo
  // root, collapsing "." and ".." along the way. A leading "/" is read as
  // repo-root-relative, which is how GitHub treats it in a README.
  function resolveRepoPath(fromDir, target) {
    var segments = target.charAt(0) === "/" ? [] : fromDir.split("/").filter(Boolean);
    target.split("/").forEach(function (seg) {
      if (!seg || seg === ".") return;
      if (seg === "..") segments.pop();
      else segments.push(seg);
    });
    return segments.map(function (seg) {
      // Authors write these either encoded ("my%20photo.png") or raw
      // ("my photo.png"); decoding first keeps the encode from doubling up.
      var decoded = seg;
      try { decoded = decodeURIComponent(seg); } catch (e) {}
      return encodeURIComponent(decoded);
    }).join("/");
  }

  // Markdown images are written relative to the file holding them, so on their
  // own they'd resolve against this page's origin instead of the repo.
  function rewriteRelativeImages(root, mdPath) {
    var dir = mdPath.indexOf("/") === -1 ? "" : mdPath.slice(0, mdPath.lastIndexOf("/"));
    var imgs = root.querySelectorAll("img[src]");
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute("src") || "";
      // Absolute URLs, protocol-relative URLs and data: URIs already work.
      if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)) continue;
      var bare = src.split(/[?#]/)[0]; // "logo.png?raw=true" -> "logo.png"
      if (!bare) continue;
      imgs[i].setAttribute("src", RAW_BASE + resolveRepoPath(dir, bare));
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

  function renderFile(name, path, text) {
    var lang = LANG_MAP[ext(name)] || "plaintext";
    var isMarkdown = lang === "markdown";
    var lines = text.split("\n").length;
    var sizeKb = (new Blob([text]).size / 1024).toFixed(1);

    var actionsHtml =
      '<span class="file-meta">' + lines + " lines &middot; " + sizeKb + " KB</span>" +
      '<div class="mode-toggle" id="modeToggle" role="group" aria-label="View or edit mode">' +
      '<button type="button" class="mode-btn active" id="viewModeBtn">' + ICONS.eye + "<span>View</span></button>" +
      '<button type="button" class="mode-btn" id="editModeBtn">' + ICONS.pencil + "<span>Edit</span></button>" +
      "</div>" +
      '<button class="copy-btn" id="copyBtn">' + ICONS.copy + "<span>Copy</span></button>";

    contentEl.innerHTML =
      '<div class="file-panel" id="filePanel">' +
      pathHeaderHtml(path, actionsHtml) +
      '<textarea id="editBlock" class="code-edit" spellcheck="false"></textarea>' +
      (isMarkdown ? '<div class="md-preview" id="mdPreview"></div>' : "") +
      "</div>";

    var filePanelEl = document.getElementById("filePanel");
    var editEl = document.getElementById("editBlock");
    var viewBtn = document.getElementById("viewModeBtn");
    var editBtn = document.getElementById("editModeBtn");
    var previewEl = document.getElementById("mdPreview");
    var copyBtn = document.getElementById("copyBtn");
    var mode = "view"; // "view" | "edit"
    var cm = null;

    editEl.value = text;

    // A single persistent editor backs View and Edit (toggling readOnly), so
    // there is no second element to swap to/from and nothing can shift.
    // Very large files (big .stl meshes etc.) skip CodeMirror: with
    // viewportMargin: Infinity it renders every line up front, which can
    // hang the tab — the plain readonly textarea shows them instantly.
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
        viewportMargin: Infinity
      });
      cm.setSize("100%", "auto");
    } else {
      editEl.readOnly = true; // fallback viewer starts in View mode
    }

    function getCurrentText() {
      return cm ? cm.getValue() : editEl.value;
    }

    function setMode(next) {
      mode = next;
      viewBtn.classList.toggle("active", mode === "view");
      editBtn.classList.toggle("active", mode === "edit");
      filePanelEl.classList.toggle("editing", mode === "edit");

      // Markdown reads as a rendered document in View and as source in Edit.
      // Every other type keeps the same editor in both modes.
      var showRendered = isMarkdown && mode === "view";

      if (previewEl) {
        if (showRendered) renderMarkdownInto(previewEl, getCurrentText(), path);
        previewEl.style.display = showRendered ? "block" : "none";
      }

      if (cm) {
        cm.getWrapperElement().style.display = showRendered ? "none" : "block";
        if (!showRendered) cm.refresh(); // remeasure after being hidden
        // Only flip editability. No focus()/setCursor() call here — either
        // one plants a caret and can scroll the view to it. The cursor
        // should not exist anywhere until the user actually clicks in.
        cm.setOption("readOnly", mode === "edit" ? false : "nocursor");
      } else {
        editEl.style.display = showRendered ? "none" : "block";
        editEl.readOnly = mode !== "edit";
      }
    }

    setMode("view");

    viewBtn.addEventListener("click", function () { if (mode !== "view") setMode("view"); });
    editBtn.addEventListener("click", function () { if (mode !== "edit") setMode("edit"); });

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
    return err.message === "RATE_LIMIT"
      ? "GitHub's public API rate limit was reached for your connection. Please wait a while and refresh, or browse the repository directly on GitHub."
      : "Could not reach GitHub (" + err.message + ").";
  }

  function checkedJson(res) {
    if (res.status === 403) throw new Error("RATE_LIMIT");
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
        var root = buildTree(tree);
        renderTree(root);

        var textPaths = tree
          .filter(function (item) { return item.type === "blob"; })
          .map(function (item) { return item.path; })
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

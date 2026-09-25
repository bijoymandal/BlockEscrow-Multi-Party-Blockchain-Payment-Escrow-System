#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const PORT = process.env.PORT || 3333;

const docFiles = [
  { id: "architecture.md", title: "Architecture", icon: "🏛️" },
  { id: "theme.md", title: "Theme & UI", icon: "🎨" },
  { id: "prod.md", title: "Production", icon: "🚀" },
  { id: "tasks.md", title: "Tasks & Roadmap", icon: "📋" },
  { id: "test.md", title: "Testing Matrix", icon: "🧪" },
  { id: "README.md", title: "Overview", icon: "📑" },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API endpoint to run tests
  if (url.pathname === "/api/test") {
    try {
      const output = execSync("npx hardhat test", {
        cwd: path.join(ROOT_DIR, "contracts"),
        encoding: "utf-8",
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, output }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, output: err.stdout || err.message }));
    }
    return;
  }

  // API endpoint to compile contracts
  if (url.pathname === "/api/compile") {
    try {
      const output = execSync("npx hardhat compile", {
        cwd: path.join(ROOT_DIR, "contracts"),
        encoding: "utf-8",
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, output }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, output: err.stdout || err.message }));
    }
    return;
  }

  // Document view
  let selectedDoc = url.searchParams.get("doc") || "README.md";
  const validDoc = docFiles.find((d) => d.id === selectedDoc) ? selectedDoc : "README.md";
  const docPath = path.join(DOCS_DIR, validDoc);
  const content = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf-8") : "# Not Found";

  const navLinks = docFiles
    .map(
      (d) =>
        `<a href="/?doc=${d.id}" class="nav-btn ${d.id === validDoc ? "active" : ""}">
          <span>${d.icon}</span> <span>${d.title}</span>
        </a>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BlockEscrow – Production Docs Portal</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    :root {
      --bg: #080B11;
      --card: #0D131F;
      --border: #1A2333;
      --text: #F1F5F9;
      --text-muted: #8B9BB4;
      --brand: #2563EB;
      --brand-hover: #1D4ED8;
      --brand-accent: #38BDF8;
      --success: #10B981;
      --warning: #F59E0B;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    aside {
      width: 300px;
      background: var(--card);
      border-right: 1px solid var(--border);
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      user-select: none;
    }
    .brand-header {
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-phase {
      display: inline-block;
      margin-top: 6px;
      font-size: 0.75rem;
      padding: 2px 8px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 9999px;
      font-weight: 600;
    }
    .nav-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 12px 8px 4px;
      font-weight: 600;
    }
    .nav-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.15s ease-in-out;
    }
    .nav-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
    }
    .nav-btn.active {
      background: var(--brand);
      color: #fff;
    }
    .action-panel {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn-action {
      background: #141c2c;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-action:hover {
      background: var(--brand);
      border-color: var(--brand);
      color: #fff;
    }
    main {
      flex: 1;
      padding: 40px 64px;
      overflow-y: auto;
      max-width: 980px;
      margin: 0 auto;
    }
    #content h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #fff;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
      margin-top: 0;
    }
    #content h2 {
      font-size: 1.4rem;
      font-weight: 600;
      color: #fff;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
      margin-top: 36px;
    }
    #content h3 {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--brand-accent);
      margin-top: 24px;
    }
    #content p, #content li {
      font-size: 0.95rem;
      line-height: 1.7;
      color: #CBD5E1;
    }
    #content pre {
      background: #030712 !important;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      overflow-x: auto;
    }
    #content code {
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 0.88rem;
    }
    #content table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 0.9rem;
    }
    #content th, #content td {
      border: 1px solid var(--border);
      padding: 12px 16px;
      text-align: left;
    }
    #content th {
      background: #111827;
      color: var(--brand-accent);
      font-weight: 600;
    }
    #content tr:nth-child(even) {
      background: rgba(255, 255, 255, 0.015);
    }
    #content blockquote {
      border-left: 4px solid var(--brand);
      margin: 20px 0;
      padding: 10px 20px;
      background: rgba(37, 99, 235, 0.08);
      border-radius: 0 8px 8px 0;
    }
    .output-modal {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 520px;
      max-height: 380px;
      background: #020408;
      border: 1px solid var(--brand);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
      padding: 16px;
      display: none;
      flex-direction: column;
      z-index: 999;
    }
    .output-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
      font-weight: 600;
      font-size: 0.9rem;
    }
    .output-modal-body {
      overflow-y: auto;
      font-family: monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      color: #94A3B8;
      margin-top: 10px;
      max-height: 280px;
    }
  </style>
</head>
<body>
  <aside>
    <div class="brand-header">
      <div class="brand-title">🛡️ BlockEscrow</div>
      <div class="badge-phase">● Phase 1: Smart Contracts Verified</div>
    </div>

    <div class="nav-label">Documentation</div>
    ${navLinks}

    <div class="action-panel">
      <div class="nav-label">Operations</div>
      <button class="btn-action" onclick="runAction('test')">
        <span>🧪</span> <span>Run Contract Tests</span>
      </button>
      <button class="btn-action" onclick="runAction('compile')">
        <span>🔨</span> <span>Compile Solidity</span>
      </button>
    </div>
  </aside>

  <main id="content">
    <div style="color: var(--text-muted);">Loading documentation...</div>
  </main>

  <div id="outputModal" class="output-modal">
    <div class="output-modal-header">
      <span id="outputTitle">Console Output</span>
      <button onclick="closeModal()" style="background: none; border: none; color: #fff; cursor: pointer;">✕</button>
    </div>
    <div id="outputBody" class="output-modal-body"></div>
  </div>

  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });

    const rawMarkdown = ${JSON.stringify(content)};
    document.getElementById("content").innerHTML = marked.parse(rawMarkdown);
    hljs.highlightAll();

    // Render Mermaid diagrams if present
    document.querySelectorAll(".language-mermaid").forEach((el) => {
      const code = el.innerText;
      const container = document.createElement("div");
      container.className = "mermaid";
      container.innerText = code;
      el.parentElement.replaceWith(container);
    });
    mermaid.run();

    async function runAction(action) {
      const modal = document.getElementById("outputModal");
      const title = document.getElementById("outputTitle");
      const body = document.getElementById("outputBody");
      
      modal.style.display = "flex";
      title.innerText = action === "test" ? "🧪 Running Phase 1 Tests..." : "🔨 Compiling Contracts...";
      body.innerText = "Executing in contracts directory...";

      try {
        const res = await fetch("/api/" + action);
        const data = await res.json();
        title.innerText = data.success ? "✔ Completed Successfully" : "✖ Execution Failed";
        body.innerText = data.output;
      } catch (err) {
        title.innerText = "✖ Network Error";
        body.innerText = err.message;
      }
    }

    function closeModal() {
      document.getElementById("outputModal").style.display = "none";
    }
  </script>
</body>
</html>`;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🛡️  BlockEscrow Documentation & Operations Portal`);
  console.log(`======================================================`);
  console.log(`URL:      http://localhost:${PORT}`);
  console.log(`Status:   Active & Serving`);
  console.log(`API:      Live Contract Test & Compilation Trigger`);
  console.log(`======================================================\n`);
});

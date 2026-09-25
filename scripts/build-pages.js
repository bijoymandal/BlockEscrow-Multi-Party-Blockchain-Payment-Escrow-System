#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const PUBLIC_DIR = path.join(ROOT_DIR, "frontend", "public");
const OUTPUT_DIR = path.join(ROOT_DIR, "_site");

console.log("==================================================");
console.log("📦 Building Static GitHub Pages Distribution");
console.log("==================================================");

// 1. Ensure output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 2. Copy DApp index.html
const dAppIndexSrc = path.join(PUBLIC_DIR, "index.html");
const dAppIndexDest = path.join(OUTPUT_DIR, "index.html");

if (fs.existsSync(dAppIndexSrc)) {
  let content = fs.readFileSync(dAppIndexSrc, "utf8");
  // Ensure header has a link to Docs
  if (!content.includes("href=\"docs.html\"")) {
    content = content.replace(
      '<span class="text-xs px-2 py-0.5 rounded-full bg-[#1A2333] border border-[#2D3A4F] text-[#38BDF8] font-medium">v1.0-UUPS</span>',
      '<span class="text-xs px-2 py-0.5 rounded-full bg-[#1A2333] border border-[#2D3A4F] text-[#38BDF8] font-medium">v1.0-UUPS</span> <a href="docs.html" class="text-xs px-2.5 py-1 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#080B11] font-semibold transition-all">📖 Docs Viewer ➔</a>'
    );
  }
  fs.writeFileSync(dAppIndexDest, content);
  fs.writeFileSync(path.join(OUTPUT_DIR, "404.html"), content); // SPA 404 fallback
  console.log("✔ Copied DApp & Admin Console -> _site/index.html & _site/404.html");
}

// 3. Copy Docs files
const docsOutDir = path.join(OUTPUT_DIR, "docs");
if (!fs.existsSync(docsOutDir)) {
  fs.mkdirSync(docsOutDir, { recursive: true });
}

const docFiles = fs.readdirSync(DOCS_DIR);
docFiles.forEach((file) => {
  const src = path.join(DOCS_DIR, file);
  const dest = path.join(docsOutDir, file);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, dest);
  }
});
console.log(`✔ Copied ${docFiles.length} documentation files -> _site/docs/`);

// 4. Generate Static Documentation Viewer (_site/docs.html)
const docSpecs = [
  { id: "architecture.md", title: "Architecture", icon: "🏛️" },
  { id: "theme.md", title: "Theme & UI", icon: "🎨" },
  { id: "prod.md", title: "Production", icon: "🚀" },
  { id: "tasks.md", title: "Tasks & Roadmap", icon: "📋" },
  { id: "test.md", title: "Testing Matrix", icon: "🧪" },
  { id: "README.md", title: "Overview", icon: "📑" },
];

const docsData = {};
docSpecs.forEach((spec) => {
  const filePath = path.join(DOCS_DIR, spec.id);
  if (fs.existsSync(filePath)) {
    docsData[spec.id] = fs.readFileSync(filePath, "utf8");
  }
});

const docsHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BlockEscrow Protocol Documentation Hub</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    body { background-color: #080B11; color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .card { background-color: #0D131F; border: 1px solid #2D3A4F; }
    .active-nav { background-color: rgba(56, 189, 248, 0.15); border-left: 3px solid #38BDF8; color: #38BDF8; font-weight: 600; }
    pre { background-color: #1A2333; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; border: 1px solid #2D3A4F; }
    code { font-family: ui-monospace, Menlo, Monaco, monospace; color: #38BDF8; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #2D3A4F; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #1A2333; color: #38BDF8; }
  </style>
</head>
<body class="min-h-screen flex flex-col md:flex-row">
  <!-- Sidebar -->
  <aside class="w-full md:w-64 card border-r border-[#2D3A4F] p-4 flex flex-col justify-between">
    <div>
      <div class="flex items-center gap-2 mb-6 pb-4 border-b border-[#2D3A4F]">
        <div class="w-8 h-8 rounded bg-[#38BDF8] text-[#080B11] font-black flex items-center justify-center">BE</div>
        <div>
          <div class="font-bold text-sm text-white">BlockEscrow</div>
          <div class="text-[11px] text-[#8B9BB4]">Documentation Hub</div>
        </div>
      </div>

      <nav class="space-y-1">
        ${docSpecs.map((s, idx) => `
          <button onclick="loadDoc('${s.id}')" id="nav-${s.id.replace('.', '-')}" class="w-full text-left px-3 py-2 rounded text-xs text-[#8B9BB4] hover:bg-[#1A2333] hover:text-white flex items-center gap-2 ${idx === 0 ? 'active-nav' : ''}">
            <span>${s.icon}</span>
            <span>${s.title}</span>
          </button>
        `).join("")}
      </nav>
    </div>

    <div class="pt-4 border-t border-[#2D3A4F] space-y-2">
      <a href="index.html" class="block w-full text-center px-3 py-2 rounded-lg bg-[#38BDF8] text-[#080B11] text-xs font-bold hover:opacity-90">
        🚀 Open Live DApp ➔
      </a>
      <a href="https://github.com/bijoymandal/BlockEscrow-Multi-Party-Blockchain-Payment-Escrow-System" target="_blank" class="block text-center text-[11px] text-[#8B9BB4] hover:text-white">
        GitHub Repository ↗
      </a>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 p-6 md:p-10 overflow-y-auto max-w-5xl">
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-[#2D3A4F]">
      <h1 id="docTitle" class="text-2xl font-bold text-white">Architecture</h1>
      <span class="text-xs mono px-2.5 py-1 rounded bg-[#1A2333] text-[#38BDF8] border border-[#2D3A4F]">docs/<span id="docFilename">architecture.md</span></span>
    </div>
    <div id="docBody" class="prose prose-invert max-w-none text-sm leading-relaxed text-[#F1F5F9]"></div>
  </main>

  <script>
    const docs = ${JSON.stringify(docsData)};
    const specs = ${JSON.stringify(docSpecs)};

    function simpleMarkdown(md) {
      if (!md) return "";
      let html = md
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-white mt-6 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-[#38BDF8] mt-8 mb-3 pb-2 border-b border-[#2D3A4F]">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-extrabold text-white mt-4 mb-4">$1</h1>')
        .replace(/\\*\\*(.*?)\\*\\*/gim, '<strong class="text-white font-semibold">$1</strong>')
        .replace(/\\*(.*?)\\*/gim, '<em class="text-[#8B9BB4]">$1</em>')
        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/gim, '<pre><code>$1</code></pre>')
        .replace(/\`([^\\\`]+)\`/gim, '<code class="mono px-1 py-0.5 rounded bg-[#1A2333] text-[#38BDF8] text-xs">$1</code>')
        .replace(/^\\> (.*$)/gim, '<blockquote class="border-l-4 border-[#38BDF8] pl-4 py-1 my-3 bg-[#1A2333]/50 text-slate-300 italic text-xs">$1</blockquote>')
        .replace(/^\\- (.*$)/gim, '<li class="ml-4 list-disc text-slate-300 my-1">$1</li>')
        .replace(/\\n\\n/gim, '<p class="my-3 text-slate-300 leading-relaxed"></p>');
      return html;
    }

    function loadDoc(docId) {
      const spec = specs.find(s => s.id === docId);
      document.getElementById("docTitle").innerText = spec ? spec.title : docId;
      document.getElementById("docFilename").innerText = docId;
      document.getElementById("docBody").innerHTML = simpleMarkdown(docs[docId] || "Document not found.");

      specs.forEach(s => {
        const el = document.getElementById("nav-" + s.id.replace('.', '-'));
        if (el) {
          if (s.id === docId) {
            el.className = "w-full text-left px-3 py-2 rounded text-xs text-[#38BDF8] font-semibold flex items-center gap-2 active-nav";
          } else {
            el.className = "w-full text-left px-3 py-2 rounded text-xs text-[#8B9BB4] hover:bg-[#1A2333] hover:text-white flex items-center gap-2";
          }
        }
      });
      window.scrollTo(0, 0);
    }

    // Default load architecture
    loadDoc("architecture.md");
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(OUTPUT_DIR, "docs.html"), docsHtmlContent);
console.log("✔ Generated Static Documentation Web Viewer -> _site/docs.html");

// 5. Add .nojekyll for GitHub Pages
fs.writeFileSync(path.join(OUTPUT_DIR, ".nojekyll"), "");
console.log("✔ Added _site/.nojekyll");

console.log("==================================================");
console.log("✨ Distribution ready in _site/ for GitHub Pages!");
console.log("==================================================");

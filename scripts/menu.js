#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync, spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bgBlue: "\x1b[44m",
  white: "\x1b[37m",
};

function printBanner() {
  console.clear();
  console.log(`
${ANSI.cyan}${ANSI.bold}╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ██████╗ ██╗      ██████╗  ██████╗██╗  ██╗███████╗███████╗ ██████╗   ║
║   ██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔════╝██╔════╝   ║
║   ██████╔╝██║     ██║   ██║██║     █████╔╝ █████╗  ███████╗██║        ║
║   ██╔══██╗██║     ██║   ██║██║     ██╔═██╗ ██╔══╝  ╚════██║██║        ║
║   ██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗███████╗███████║╚██████╗   ║
║   ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝   ║
║                                                                       ║
║            MULTI-PARTY BLOCKCHAIN PAYMENT & ESCROW SYSTEM             ║
╚═══════════════════════════════════════════════════════════════════════╝${ANSI.reset}
  `);
}

function showMainMenu() {
  printBanner();
  console.log(`${ANSI.bold}📚 DOCUMENTATION & SPECIFICATIONS MENU${ANSI.reset}`);
  console.log(`${ANSI.dim}───────────────────────────────────────────────────────────────────────${ANSI.reset}`);
  console.log(`  ${ANSI.cyan}[1]${ANSI.reset} 📖 System Architecture            ${ANSI.dim}(docs/architecture.md)${ANSI.reset}`);
  console.log(`  ${ANSI.cyan}[2]${ANSI.reset} 🎨 Theme & UI Design System       ${ANSI.dim}(docs/theme.md)${ANSI.reset}`);
  console.log(`  ${ANSI.cyan}[3]${ANSI.reset} 🚀 Production & Cloud Setup       ${ANSI.dim}(docs/prod.md)${ANSI.reset}`);
  console.log(`  ${ANSI.cyan}[4]${ANSI.reset} 📋 Tasks & Implementation Roadmap ${ANSI.dim}(docs/tasks.md)${ANSI.reset}`);
  console.log(`  ${ANSI.cyan}[5]${ANSI.reset} 🧪 Testing & Verification Matrix   ${ANSI.dim}(docs/test.md)${ANSI.reset}`);
  console.log(`  ${ANSI.cyan}[6]${ANSI.reset} 📑 Documentation Hub Index        ${ANSI.dim}(docs/README.md)${ANSI.reset}`);
  console.log(`  ${ANSI.cyan}[7]${ANSI.reset} 🌐 Launch Web Documentation Portal ${ANSI.green}[Browser UI]${ANSI.reset}`);
  console.log(`${ANSI.dim}───────────────────────────────────────────────────────────────────────${ANSI.reset}`);
  console.log(`${ANSI.bold}⚡ SMART CONTRACT OPERATIONS${ANSI.reset}`);
  console.log(`  ${ANSI.yellow}[8]${ANSI.reset} 🔨 Compile Smart Contracts        ${ANSI.dim}(Hardhat solc 0.8.24)${ANSI.reset}`);
  console.log(`  ${ANSI.yellow}[9]${ANSI.reset} 🧪 Run Phase 1 Contract Tests    ${ANSI.dim}(16 Automated Tests)${ANSI.reset}`);
  console.log(`${ANSI.dim}───────────────────────────────────────────────────────────────────────${ANSI.reset}`);
  console.log(`${ANSI.bold}🌐 APPLICATION & FULL-STACK RUNNERS${ANSI.reset}`);
  console.log(`  ${ANSI.green}[w]${ANSI.reset} 🚀 Launch Interactive Web3 DApp & Admin  ${ANSI.cyan}(http://localhost:3000)${ANSI.reset}`);
  console.log(`  ${ANSI.green}[a]${ANSI.reset} ⚡ Start Full-Stack Services              ${ANSI.dim}(Backend 4000 + DApp 3000)${ANSI.reset}`);
  console.log(`  ${ANSI.green}[t]${ANSI.reset} 🧪 Run All 90 Automated Tests           ${ANSI.dim}(All 6 Phases)${ANSI.reset}`);
  console.log(`  ${ANSI.green}[p]${ANSI.reset} 📦 Build GitHub Pages Static Dist        ${ANSI.dim}(_site/)${ANSI.reset}`);
  console.log(`${ANSI.dim}───────────────────────────────────────────────────────────────────────${ANSI.reset}`);
  console.log(`  ${ANSI.red}[0]${ANSI.reset} 🚪 Exit`);
  console.log("");
}

function renderDocPreview(filename) {
  const filePath = path.join(DOCS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`${ANSI.red}File not found: ${filePath}${ANSI.reset}`);
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  console.clear();
  console.log(`${ANSI.bgBlue}${ANSI.white}${ANSI.bold}  Viewing: docs/${filename}  ${ANSI.reset}\n`);

  // Format markdown with basic color syntax highlighting
  const lines = content.split("\n");
  for (let i = 0; i < Math.min(lines.length, 120); i++) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      console.log(`${ANSI.cyan}${ANSI.bold}${line}${ANSI.reset}`);
    } else if (line.startsWith("## ")) {
      console.log(`${ANSI.blue}${ANSI.bold}${line}${ANSI.reset}`);
    } else if (line.startsWith("### ")) {
      console.log(`${ANSI.yellow}${line}${ANSI.reset}`);
    } else if (line.startsWith("```")) {
      console.log(`${ANSI.dim}${line}${ANSI.reset}`);
    } else if (line.startsWith("|")) {
      console.log(`${ANSI.green}${line}${ANSI.reset}`);
    } else {
      console.log(line);
    }
  }

  if (lines.length > 120) {
    console.log(`\n${ANSI.dim}... [Preview truncated at 120 lines. View full file at file://${filePath}] ...${ANSI.reset}`);
  }
}

function startWebDocsServer() {
  const PORT = 3333;
  const docFiles = ["architecture.md", "theme.md", "prod.md", "tasks.md", "test.md", "README.md"];
  
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let selectedDoc = url.searchParams.get("doc") || "architecture.md";
    if (!docFiles.includes(selectedDoc)) selectedDoc = "architecture.md";

    const docPath = path.join(DOCS_DIR, selectedDoc);
    const content = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf-8") : "File not found.";

    // Simple HTML wrapper with dark theme and markdown styling
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BlockEscrow – Documentation Hub</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>
    :root {
      --bg: #080B11;
      --card: #0D131F;
      --border: #1A2333;
      --text: #F1F5F9;
      --text-muted: #8B9BB4;
      --brand: #2563EB;
      --brand-accent: #38BDF8;
    }
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
      width: 280px;
      background: var(--card);
      border-right: 1px solid var(--border);
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .brand-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--brand-accent);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-btn {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      border-radius: 8px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    .nav-btn:hover, .nav-btn.active {
      background: var(--brand);
      color: #fff;
    }
    main {
      flex: 1;
      padding: 40px 60px;
      overflow-y: auto;
      max-width: 900px;
      margin: 0 auto;
    }
    pre {
      background: #020408 !important;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
    }
    code {
      font-family: "JetBrains Mono", monospace;
      font-size: 0.85rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background: #141c2c;
      color: var(--brand-accent);
    }
    h1, h2, h3 { color: #fff; }
    h2 { border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 32px; }
    blockquote {
      border-left: 4px solid var(--brand);
      margin: 16px 0;
      padding: 8px 16px;
      background: rgba(37, 99, 235, 0.1);
      border-radius: 0 8px 8px 0;
    }
  </style>
</head>
<body>
  <aside>
    <div class="brand-title">🛡️ BlockEscrow Docs</div>
    <a href="/?doc=architecture.md" class="nav-btn ${selectedDoc === 'architecture.md' ? 'active' : ''}">📖 Architecture</a>
    <a href="/?doc=theme.md" class="nav-btn ${selectedDoc === 'theme.md' ? 'active' : ''}">🎨 Theme & Design</a>
    <a href="/?doc=prod.md" class="nav-btn ${selectedDoc === 'prod.md' ? 'active' : ''}">🚀 Production Setup</a>
    <a href="/?doc=tasks.md" class="nav-btn ${selectedDoc === 'tasks.md' ? 'active' : ''}">📋 Tasks & Roadmap</a>
    <a href="/?doc=test.md" class="nav-btn ${selectedDoc === 'test.md' ? 'active' : ''}">🧪 Testing Matrix</a>
    <a href="/?doc=README.md" class="nav-btn ${selectedDoc === 'README.md' ? 'active' : ''}">📑 Documentation Index</a>
  </aside>
  <main id="content"></main>
  <script>
    const rawMarkdown = ${JSON.stringify(content)};
    document.getElementById("content").innerHTML = marked.parse(rawMarkdown);
    hljs.highlightAll();
  </script>
</body>
</html>`;

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });

  server.listen(PORT, () => {
    console.log(`\n${ANSI.green}${ANSI.bold}✔ Web Documentation Server started at: http://localhost:${PORT}${ANSI.reset}`);
    console.log(`${ANSI.dim}Press Ctrl+C or return to terminal menu to stop.${ANSI.reset}`);
    
    // Auto-open browser on macOS if available
    try {
      execSync(`open http://localhost:${PORT}`);
    } catch (e) {}
  });

  return server;
}

function promptMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  showMainMenu();

  rl.question(`${ANSI.bold}Select an option [0-9, d]: ${ANSI.reset}`, (choice) => {
    rl.close();
    handleSelection(choice.trim());
  });
}

function handleSelection(choice) {
  const waitAndReturn = () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`\n${ANSI.dim}Press [Enter] to return to the menu...${ANSI.reset}`, () => {
      rl.close();
      promptMenu();
    });
  };

  switch (choice) {
    case "1":
      renderDocPreview("architecture.md");
      waitAndReturn();
      break;
    case "2":
      renderDocPreview("theme.md");
      waitAndReturn();
      break;
    case "3":
      renderDocPreview("prod.md");
      waitAndReturn();
      break;
    case "4":
      renderDocPreview("tasks.md");
      waitAndReturn();
      break;
    case "5":
      renderDocPreview("test.md");
      waitAndReturn();
      break;
    case "6":
      renderDocPreview("README.md");
      waitAndReturn();
      break;
    case "7":
      const server = startWebDocsServer();
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`\n${ANSI.yellow}Web Documentation is running. Press [Enter] to return to main menu...${ANSI.reset}`, () => {
        server.close();
        rl.close();
        promptMenu();
      });
      break;
    case "8":
      console.log(`\n${ANSI.cyan}🔨 Compiling Smart Contracts...${ANSI.reset}`);
      try {
        execSync("npx hardhat compile", { cwd: path.join(ROOT_DIR, "contracts"), stdio: "inherit" });
      } catch (err) {
        console.error(`${ANSI.red}Compilation failed.${ANSI.reset}`);
      }
      waitAndReturn();
      break;
    case "9":
      console.log(`\n${ANSI.cyan}🧪 Running Phase 1 Test Suite...${ANSI.reset}`);
      try {
        execSync("npx hardhat test", { cwd: path.join(ROOT_DIR, "contracts"), stdio: "inherit" });
      } catch (err) {
        console.error(`${ANSI.red}Tests exited with error.${ANSI.reset}`);
      }
      waitAndReturn();
      break;
    case "d":
    case "D":
      console.log(`\n${ANSI.cyan}🚀 Testing Deployment Script on Hardhat Network...${ANSI.reset}`);
      try {
        execSync("npx hardhat run scripts/deploy.js", { cwd: path.join(ROOT_DIR, "contracts"), stdio: "inherit" });
      } catch (err) {
        console.error(`${ANSI.red}Deployment script failed.${ANSI.reset}`);
      }
      waitAndReturn();
      break;
    case "w":
    case "W":
      console.log(`\n${ANSI.cyan}🚀 Launching Interactive DApp & Admin Console...${ANSI.reset}`);
      const dAppProcess = spawn("node", [path.join(ROOT_DIR, "frontend", "server.js")], {
        stdio: "inherit",
        env: { ...process.env, PORT: "3000" },
      });
      const rlW = readline.createInterface({ input: process.stdin, output: process.stdout });
      rlW.question(`\n${ANSI.yellow}DApp is running on http://localhost:3000. Press [Enter] to stop and return to menu...${ANSI.reset}`, () => {
        dAppProcess.kill();
        rlW.close();
        promptMenu();
      });
      break;
    case "a":
    case "A":
      console.log(`\n${ANSI.cyan}⚡ Launching Full-Stack Environment (Backend + DApp)...${ANSI.reset}`);
      const allProcess = spawn("node", [path.join(ROOT_DIR, "scripts", "serve-all.js")], {
        stdio: "inherit",
      });
      const rlA = readline.createInterface({ input: process.stdin, output: process.stdout });
      rlA.question(`\n${ANSI.yellow}Services are running. Press [Enter] to stop and return to menu...${ANSI.reset}`, () => {
        allProcess.kill();
        rlA.close();
        promptMenu();
      });
      break;
    case "t":
    case "T":
      console.log(`\n${ANSI.cyan}🧪 Executing Full Multi-Phase Test Suite (90 Tests)...${ANSI.reset}`);
      try {
        execSync("npm test", { cwd: ROOT_DIR, stdio: "inherit" });
      } catch (err) {
        console.error(`${ANSI.red}Tests completed with errors.${ANSI.reset}`);
      }
      waitAndReturn();
      break;
    case "p":
    case "P":
      console.log(`\n${ANSI.cyan}📦 Building Static GitHub Pages Distribution...${ANSI.reset}`);
      try {
        execSync("node scripts/build-pages.js", { cwd: ROOT_DIR, stdio: "inherit" });
      } catch (err) {
        console.error(`${ANSI.red}Build failed.${ANSI.reset}`);
      }
      waitAndReturn();
      break;
    case "0":
      console.log(`\n${ANSI.green}👋 Exiting BlockEscrow CLI. Happy building!${ANSI.reset}\n`);
      process.exit(0);
      break;
    default:
      console.log(`\n${ANSI.red}Invalid option: "${choice}". Please choose a number from 0 to 9.${ANSI.reset}`);
      setTimeout(promptMenu, 1000);
      break;
  }
}

// Start menu
promptMenu();

# Contributing to RepoStart 🚀

Thank you for your interest in contributing to RepoStart.

RepoStart is a VS Code extension focused on reducing repository onboarding friction and helping developers get projects running faster.

Whether you're fixing bugs, improving the UI, adding framework support, or proposing new onboarding workflows, contributions are welcome.

---

## Getting Started

### 1. Fork the Repository

Create a fork of RepoStart and clone it locally.

```bash
git clone https://github.com/YOUR_USERNAME/RepoStart.git
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Compile the Extension

```bash
npm run compile
```

---

### 4. Run the Extension

Open the project in VS Code and press:

```text
F5
```

This launches a new Extension Development Host where RepoStart can be tested.

---

## Project Structure

```text
src/
├── analyzers/
├── runners/
├── services/
├── ui/
├── utils/
└── extension.ts
```

### Key Areas

#### analyzers/

Repository detection and architecture analysis.

Examples:

- Framework detection
- Package manager detection
- Repository structure analysis

#### runners/

Core onboarding workflow logic.

Examples:

- Dependency installation
- Environment generation
- Project startup

#### services/

Supporting services.

Examples:

- Timeline tracking
- Log streaming
- Settings management

#### ui/

VS Code dashboard and webview components.

Examples:

- Timeline
- Logs
- Service status cards
- Dashboard views

---

## Good First Issues

New contributors may want to start with:

- UI improvements
- Timeline enhancements
- Log formatting
- Report generation improvements
- Additional framework detection
- Error handling improvements
- Documentation updates

---

## Contribution Areas

### Phase 2

- README setup parsing
- Multi-language support (Python, Java, etc.)
- Service validation checks
- Smarter repository analysis

### Phase 3

- AI-assisted error explanations
- Setup recommendations
- Troubleshooting guidance

### Future Exploration

- Agent-assisted onboarding workflows
- Docker support
- Dev Containers
- GitHub Codespaces support
- Intelligent setup recovery

---

## Pull Request Guidelines

Before submitting a pull request:

- Ensure the extension compiles successfully
- Test changes locally
- Keep pull requests focused and scoped
- Update documentation when necessary
- Include screenshots for UI changes

---

## Reporting Issues

When reporting bugs, include:

- Operating System
- VS Code version
- Repository type being tested
- Steps to reproduce
- Screenshots or logs if available

---

## Code Style

- Use TypeScript
- Prefer small and focused changes
- Follow existing project structure
- Keep code readable and well documented

---

## Questions

Feel free to open an issue for discussion before starting larger changes.

Thank you for helping improve RepoStart and making developer onboarding easier for everyone.
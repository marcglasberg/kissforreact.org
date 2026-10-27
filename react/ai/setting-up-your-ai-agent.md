---
sidebar_position: 3
---

# Setting up your AI agent

In an existing Kiss codebase, the code itself teaches the agent how things are done. In a
new project, two things do that job: the docs, and the linter. Set up both before you ask
the agent to write code.

## 1. Give it the docs {#docs}

All the Kiss documentation is available as a single file, made for AI agents:

**`https://kissforreact.org/kiss-state-management-docs.md`**

Tell your agent to read it. For example:

> *"Read https://kissforreact.org/kiss-state-management-docs.md and help me build a todo app
> with Kiss."*

The agent then has the complete API, the tutorial, the examples, and the recommended
structure, and can give specific and accurate answers instead of generic React.

## 2. Install the linter {#linter}

The [eslint-plugin-kiss-for-react](https://www.npmjs.com/package/eslint-plugin-kiss-for-react)
package is an ESLint plugin for Kiss. It checks for style issues, and also for mistakes that
compile fine but fail at runtime. It's useful both for people and for AI coding agents.

* Meant primarily for **AI agents**, like **Claude Code** and **Codex**. The agent runs
  `npx eslint`, reads the errors, and fixes them, without spending tokens on guessing.
* Shows lint errors as you type in the IDE: VS Code, WebStorm, and any editor with ESLint support
* Lots of quick fixes (for example, the lightbulb in VS Code, or Alt+Enter in WebStorm)

To install it, ask your agent:

> *"Install the eslint-plugin-kiss-for-react package from npm,
> following all the steps in its README."*

The [package's page on npm](https://www.npmjs.com/package/eslint-plugin-kiss-for-react)
explains how to install it yourself, and has the full list of rules.

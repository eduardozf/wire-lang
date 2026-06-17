# ESM-Only Node 20 Target

Wire Lang's MVP packages will be ESM-only and target Node.js 20 or newer, with no CommonJS build. We chose this over dual ESM/CommonJS output because the first release is a modern TypeScript library plus CLI, and avoiding dual-package behavior keeps package exports, builds, tests, and dependency handling simpler while the core language and renderer are still stabilizing.

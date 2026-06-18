# Wire Lang Brand Assets

Reusable Wire Lang brand files live here. The original bundled source guide is
kept as [`wire-lang-brand-identity.html`](./wire-lang-brand-identity.html), and
the extracted SVG assets are in [`assets/`](./assets/).

## Quick Picks

- Use [`assets/wire-lang-lockup-horizontal.svg`](./assets/wire-lang-lockup-horizontal.svg)
  for project headers, README previews, and docs mastheads.
- Use [`assets/wire-lang-mark.svg`](./assets/wire-lang-mark.svg) for the
  standalone WL monogram.
- Use [`assets/wire-lang-favicon-32.png`](./assets/wire-lang-favicon-32.png)
  for favicon placements that need raster output.
- Use [`assets/wire-lang-app-icon-512.png`](./assets/wire-lang-app-icon-512.png)
  for square app, package, or social preview placements.

## SVG Files

SVG files are canonical vector assets. They are named by use case, not pixel
size.

| Asset                                      | Intended use                                            |
| ------------------------------------------ | ------------------------------------------------------- |
| `wire-lang-lockup-horizontal.svg`          | Default horizontal lockup with tagline                  |
| `wire-lang-lockup-horizontal-reversed.svg` | Horizontal lockup for dark backgrounds                  |
| `wire-lang-lockup-compact.svg`             | Compact stacked lockup                                  |
| `wire-lang-mark.svg`                       | Canonical standalone mark                               |
| `wire-lang-mark-reversed.svg`              | Standalone mark for dark backgrounds                    |
| `wire-lang-mark-signal.svg`                | Standalone mark with the signal accent on the open node |
| `wire-lang-favicon.svg`                    | Simplified favicon cut for small sizes                  |
| `wire-lang-app-icon.svg`                   | Square light app icon                                   |
| `wire-lang-app-icon-signal.svg`            | Dark square app icon with signal accent                 |
| `wire-lang-avatar.svg`                     | Circular avatar                                         |

## PNG Files

PNG files are generated exports. They carry pixel sizes in their filenames.

| Asset family                        | Sizes                           |
| ----------------------------------- | ------------------------------- |
| `wire-lang-lockup-horizontal-*.png` | `520`, `1040`                   |
| `wire-lang-lockup-compact-*.png`    | `240`, `480`                    |
| `wire-lang-mark-*.png`              | `32`, `64`, `128`, `256`, `512` |
| `wire-lang-mark-reversed-*.png`     | `128`, `256`, `512`             |
| `wire-lang-mark-signal-*.png`       | `128`, `256`, `512`             |
| `wire-lang-favicon-*.png`           | `16`, `32`, `48`                |
| `wire-lang-app-icon-*.png`          | `128`, `256`, `512`, `1024`     |
| `wire-lang-app-icon-signal-*.png`   | `256`, `512`, `1024`            |
| `wire-lang-avatar-*.png`            | `256`, `512`                    |

## Colors

| Token    | Value                              | Use                                 |
| -------- | ---------------------------------- | ----------------------------------- |
| Ink      | `#16181d`                          | Primary mark and text               |
| Paper    | `#faf9f7`                          | Reversed mark and light backgrounds |
| Signal   | `oklch(0.66 0.15 215)` / `#00a7cb` | Optional accent node only           |
| Graphite | `#6f6c64`                          | Secondary text                      |

Keep the mark monochrome by default. Use Signal only as a small accent, usually
on the open node, and do not redraw, stretch, rotate, or gradient the wire path.

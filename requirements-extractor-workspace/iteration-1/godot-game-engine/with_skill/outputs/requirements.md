# Godot Engine — MGPC Requirements Specification

**Extracted from:** GitHub repo README, CONTRIBUTING.md, godot-docs `about/introduction.rst`, `about/faq.rst`, `about/list_of_features.rst`, `about/system_requirements.rst`
**Method:** requirements-extractor v2.0 (Phase 0 CoK saturation → Phase 1 MGPC intent inference)
**Date:** 2026-04-08

---

## Phase 0 — Bottom-Up CoK Saturation

### L5 — Topics (explicit + implied)

Explicit from README / docs:
- 2D game creation
- 3D game creation
- Unified editor interface
- Cross-platform export (one-click)
- Free/open-source licensing (MIT)
- Community-driven development
- Scene/node architecture
- GDScript scripting language
- C# scripting support
- GDExtension (C/C++ native bindings)
- Multiple renderers (Forward+, Mobile, Compatibility)
- Physics simulation (2D + 3D)
- Audio system
- Navigation / pathfinding
- Networking (TCP/UDP/WebSocket/WebRTC/ENet high-level multiplayer)
- Internationalization / localization
- XR (AR + VR, OpenXR)
- GUI system (custom, hardware-accelerated)
- Asset import pipeline
- Animation system
- Shader system (text + visual)
- Small binary / low bandwidth distribution
- Headless / server mode
- Non-game application support

Implied expansions:
- (scene-node-system, implies, composable-game-object-model)
- (community-driven, implies, transparent-governance)
- (MIT-license, implies, zero-royalty-commercial-use)
- (cross-platform-export, implies, abstracted-platform-layer)
- (small-binary, implies, modular-feature-flags)
- (GDScript, requires, custom-scripting-VM)
- (no-exceptions, implies, graceful-error-recovery)
- (no-STL, implies, custom-container-types-with-memory-tracking)
- (no-ECS, implies, inheritance-based-object-model)
- (open-source, implies, reproducible-build-system)

---

### L4 — Areas (topics grouped into solution areas + patterns)

| Area | Topics grouped | Patterns |
|------|---------------|---------|
| **Game authoring environment** | unified editor, scene tree editor, live reload, visual profiler, built-in debugger | IDE-in-a-box, dogfood (editor uses engine GUI) |
| **Multi-target delivery** | cross-platform export, one-click deploy, headless server, web editor | Write-once-run-anywhere |
| **Scripting ecosystem** | GDScript, C#, GDExtension, cross-language scripting | Tiered language stack (scripting → native) |
| **Rendering pipeline** | Forward+, Mobile, Compatibility renderers, PBR, 2D dedicated pipeline | Multi-renderer scalability |
| **Creator economics** | MIT license, no royalties, Godot Foundation non-profit | Free-as-in-freedom platform |
| **Community governance** | proposals repo, contributors chat, community-driven decisions | Open governance |
| **Engine extensibility** | modules, GDExtension, editor plugins, asset library | Plugin-first architecture |
| **Performance scalability** | renderer tiers, LOD, resolution scaling, C++ GDExtension escape hatch | Quality/performance slider |
| **Lean distribution** | small binary, opt-in features, compile-time exclusions | Pay-for-what-you-use |

---

### L3 — Fields (areas mapped to delivery mechanisms)

| Area | Implements via | Mechanism |
|------|---------------|-----------|
| Game authoring environment | Desktop application (native + web) | Qt-free custom GUI; SCons build |
| Multi-target delivery | Platform abstraction layer + export templates | OS abstraction; static linking on Linux |
| Scripting ecosystem | Integrated scripting VM + FFI | Custom GDScript VM; .NET runtime; GDExtension ABI |
| Rendering pipeline | Graphics API abstraction (RenderingDevice) | Vulkan/D3D12/Metal/OpenGL backend |
| Creator economics | Open-source distribution | MIT; Godot Foundation 501(c) analog |
| Engine extensibility | Module system + plugin API | Compile-time modules; runtime GDExtension |
| Performance scalability | C++17 core with tiered scripting | GDScript → C# → C++ performance ladder |
| Lean distribution | Feature flags + compilation profiles | SCons conditional compilation |

---

### L2 — Disciplines (cross-cutting concerns + mandates)

| Field | Grounded in | Mandates |
|-------|------------|---------|
| Rendering / graphics API | Computer graphics, GPU architecture | Hardware-accelerated rendering; no software fallback |
| Scripting VM | Programming language theory, compiler design | Thread safety; no GC stalls; native vector types |
| Build system | Software engineering | Reproducible builds; no downloads at build time |
| Open-source governance | Software licensing, community management | MIT license; no proprietary core SDKs |
| Stability / reliability | Systems engineering | No crashes — graceful recovery over exceptions |
| Accessibility | UX / internationalization | Full Unicode, bidirectional text, i18n from day one |
| Security | Networked systems | HTTPS bundled certs; optional encryption for project files |

---

### L1 — Domains

| Discipline | Domain | Disjoint from |
|-----------|--------|---------------|
| Computer graphics, GPU architecture | Interactive media technology | Enterprise business software |
| Programming language / VM | Computer science | Scientific computing |
| Software licensing / governance | Open-source ecosystem | Proprietary game engine market |
| Systems engineering | Platform software | Web application frameworks |

Domain: **Interactive media technology + open-source platform software** ✓

---

### Saturation Output

```
L5→{2D/3D game creation, unified editor, cross-platform export, MIT license,
    community governance, scene-node architecture, GDScript/C#/GDExtension,
    multi-renderer, physics, audio, networking, XR, GUI, i18n, small binary}
L4→[game-authoring]+{IDE-in-a-box, dogfood} | [multi-target]+{write-once-run-anywhere}
   [scripting-ecosystem]+{tiered language stack} | [rendering-pipeline]+{multi-renderer scalability}
   [creator-economics]+{free-as-in-freedom} | [extensibility]+{plugin-first}
L3→[desktop/web application]+{SCons, custom GUI} | [platform-abstraction]+{export templates}
   [scripting-VM]+{GDScript VM, .NET, GDExtension ABI}
   [graphics-API-abstraction]+{Vulkan/D3D12/Metal/OpenGL}
L2→[systems-engineering]+{no-crash, graceful recovery, no-exceptions}
   [open-source-governance]+{MIT, no proprietary SDKs}
   [build-engineering]+{reproducible builds, no network at build time}
   [accessibility]+{Unicode, BiDi, i18n}
L1→[interactive-media-technology + open-source-platform]✓
   (disjoint: enterprise SaaS, scientific computing, proprietary engine market)

Requirements from saturation:
  L4: modular extensibility, tiered renderer, zero-cost scripting entry
  L3: hardware-accelerated GUI (no GTK/Qt), graphics API abstraction layer,
      custom containers (no STL), reproducible static Linux binaries
  L2: MIT license on all core code, no proprietary SDKs in core,
      no C++ exceptions (binary size + crash avoidance), full Unicode/i18n

Solution Space:
  {node/scene + inheritance OOP} vs {ECS} vs {DOD-forced}
  {custom GDScript VM} vs {embedded Lua/Python/JS}
  {multi-renderer (Forward+/Mobile/Compat)} vs {single-renderer}
  {custom GUI toolkit} vs {GTK/Qt}
  {SCons build} vs {CMake/Meson}
  {GDExtension ABI} vs {in-tree C++ module only}
```

---

## Phase 1 — Top-Down Intent Inference

### "Why?" Recursion (W-functor chain)

```
"Build a 2D/3D game engine"
  → why? "to let developers make games"
  → why? "to lower the barrier to game creation"
  → why? "so that more people can create interactive experiences"
  → why? "to democratize creative expression through games"
  → why? "creative expression and making things is intrinsically valuable"
  → TAUTOLOGY → Mission found
```

---

## MGPC Specification

---

### M — Mission

> **Democratize interactive media creation** by giving every developer — regardless of resources, geography, or commercial backing — the means to build, distribute, and own professional-quality 2D and 3D games without restriction.

*(W-functor fixed point: "creative expression and building things is intrinsically valuable; removing barriers to that creation serves human flourishing.")*

---

### G — Goals

The concrete objectives whose achievement realizes the Mission. Changing any of these would change the type of solution required.

| # | Goal | Evidence |
|---|------|---------|
| G1 | Provide a **feature-complete, unified 2D and 3D game engine** in a single editor interface | README: "create 2D and 3D games from a unified interface" |
| G2 | Enable **one-click cross-platform export** to all major desktop, mobile, web, and console targets | README: "exported with one click to a number of platforms" |
| G3 | Remain **completely free and MIT-licensed** with zero royalties and full source ownership | README: "No strings attached, no royalties, nothing. Users' games are theirs, down to the last line of engine code." |
| G4 | Be **community-driven and independently governed** through the Godot Foundation (non-profit) | README: "fully independent and community-driven" |
| G5 | Keep the engine **accessible by minimizing distribution size and hardware requirements** | FAQ: "Keeping the binary size small… makes Godot more accessible to developers in all countries" |
| G6 | Provide a **tiered scripting stack** (GDScript → C# → C/C++ GDExtension) so developers at all skill levels can participate | FAQ: GDScript for beginners; C++ for performance-critical paths |
| G7 | **Eat its own dog food**: the editor itself is built using Godot's own GUI and scene system | FAQ: "the editor itself is one of the most complex users of Godot's UI system" |
| G8 | Support **extensibility without forking**: modules, GDExtension, editor plugins, asset library | FAQ / features list |

---

### P — Premises

Assumptions that must hold for the Goals to be achievable. If any is false, the goal in question becomes impossible.

| # | Premise | Goal it supports | Falsifying condition |
|---|---------|-----------------|---------------------|
| P1 | Target devices have a GPU capable of at least OpenGL 3.3 / OpenGL ES 3.0 (Compatibility renderer) | G1, G2, G5 | CPU-only / extremely low-end targets cannot be served |
| P2 | The open-source community can sustain quality maintenance of a complex C++ codebase | G3, G4 | Governance collapse or contributor exodus |
| P3 | MIT licensing is compatible with all major platform distribution channels (Steam, App Store, Google Play, consoles via partners) | G2, G3 | A platform mandating incompatible license terms |
| P4 | Developers are willing to accept GDScript as the primary rapid-development language | G6 | Developers reject the language ecosystem outright |
| P5 | Platform hardware and OS ABIs remain stable enough for export templates to target them | G2 | Radical platform fragmentation or SDK churn |
| P6 | A not-for-profit foundation model is legally and financially sustainable long-term | G4 | Foundation insolvency or loss of donor support |
| P7 | The scene/node inheritance model is expressive enough for the majority of game genres | G1, G7 | Genres that fundamentally require ECS at scale (extreme entity counts >100k with frame-by-frame updates) |
| P8 | Compilation profiles and GDExtension provide sufficient escape hatches for performance-critical workloads | G5, G6 | Workloads that fundamentally require direct engine modification |

---

### C — Constraints

**Hard constraints** (violation = rejection of contribution / design choice):

| # | Constraint | Source |
|---|-----------|--------|
| C-H1 | **No proprietary or closed-source SDKs in the core engine.** FMOD, GameWorks, etc. are explicitly excluded. | FAQ: "There are no plans for the core engine development community to support any third-party, closed-source/proprietary SDKs" |
| C-H2 | **All core code must be MIT-licensed.** Third-party libraries must be compatible; incompatible licenses require isolation. | LICENSE.txt, FAQ |
| C-H3 | **No C++ exceptions** in the engine codebase. Error handling must use return codes and graceful recovery. | FAQ: "exceptions significantly increase the binary size… games should not crash, no matter what" |
| C-H4 | **No STL** (Standard Template Library) in engine internals. Custom containers must be used instead. | FAQ: STL symbols inflate debug binaries; custom containers have memory tracking |
| C-H5 | **No ECS architecture** in the core design. The engine uses an inheritance-based node/scene model. | FAQ: "Godot does not use an ECS and relies on inheritance instead" |
| C-H6 | **The editor must be usable without administrator privileges** and without a system-level installation. | FAQ: portable execution |
| C-H7 | **The build system must never download dependencies at build time.** System libraries may be substituted; builds must be fully reproducible. | FAQ: "The build system doesn't download anything. Builds can be fully reproducible." |
| C-H8 | **New API surface exposed to scripting must be documented** (class reference updated) as part of the PR. | CONTRIBUTING.md |
| C-H9 | **Features accepted into core must be widely needed** (not niche). Niche functionality belongs in add-ons or GDExtension. | FAQ: "Godot intentionally does not include features that can be implemented by add-ons unless they are used very often" |

**Soft constraints** (violation = penalty / trade-off discussion required):

| # | Constraint | Source |
|---|-----------|--------|
| C-S1 | Export template binaries should be kept small to support low-bandwidth regions; features that bloat templates should be opt-in. | FAQ |
| C-S2 | The editor binary should download and launch in under 5 minutes on a modest connection. | FAQ |
| C-S3 | C# support is available but carries a separate binary dependency; C# is not recommended as the default for beginners. | FAQ |
| C-S4 | Hardware-accelerated rendering is required; no software fallback is built in (though external CPU emulation layers can be used). | FAQ: "There is no built-in software fallback" for the GUI toolkit |
| C-S5 | Data-oriented design (DOD) is not enforced on users; the engine internally uses cache-coherent structures where feasible. | FAQ |
| C-S6 | Console support is provided via third-party partners, not maintained in the main repo. | README / FAQ |
| C-S7 | GDScript should be the recommended on-ramp language; adding more first-class languages should not come at the cost of maintainability. | FAQ: GDScript motivation |

---

### Solution Space

Alternatives surfaced during Phase 0 that were evaluated and either adopted, rejected, or deferred:

| Decision point | Chosen approach | Rejected alternatives | Rationale |
|---------------|----------------|----------------------|-----------|
| Object model | Scene-node + inheritance OOP | ECS, forced DOD | Better usability for majority of use cases; ECS available via composition pattern |
| Scripting layer | Custom GDScript VM | Embedded Lua, Python, JS | Thread safety, class extension, native vector types, GC-free operation |
| GUI toolkit | Custom hardware-accelerated Control nodes | GTK, Qt | No LGPL caveats; consistent cross-platform appearance; dogfood integration |
| Build system | SCons (Python-based) | CMake, Meson | Multi-platform cross-compile; complex code generation; no reconfigure-rebuild cycle |
| Native extension ABI | GDExtension (stable ABI) | In-tree C++ modules only | Allows third-party native extensions without engine recompilation |
| Rendering | Three tiered renderers (Forward+/Mobile/Compat) | Single renderer | Scalability from low-end mobile / web to high-end desktop |
| Core containers | Custom (Vector, HashMap, RID, String) | STL | Memory tracking, copy-on-write, O(1) RID access, proper i18n strings |

---

## Traceability Summary

| MGPC component | Primary sources |
|---------------|----------------|
| Mission | README, FAQ ("democratize"), introduction.rst |
| G1–G2 | README, list_of_features.rst |
| G3–G4 | README, LICENSE.txt, FAQ |
| G5–G8 | FAQ, list_of_features.rst |
| P1 | system_requirements.rst |
| P2–P6 | FAQ, README, CONTRIBUTING.md |
| P7–P8 | FAQ (ECS, DOD sections) |
| C-H1–C-H5 | FAQ (proprietary SDKs, exceptions, STL, ECS sections) |
| C-H6–C-H9 | FAQ (portable), CONTRIBUTING.md (docs, feature scope) |
| C-S1–C-S7 | FAQ, list_of_features.rst |
| Solution Space | FAQ (design decision sections throughout) |

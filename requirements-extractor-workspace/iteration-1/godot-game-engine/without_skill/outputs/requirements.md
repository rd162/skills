# Godot Game Engine — Structured Requirements Spec (MGPC)

**Source:** GitHub repository `godotengine/godot`, official docs (`docs.godotengine.org`), Godot Foundation site, contributing docs, and architecture docs.
**Date extracted:** 2026-04-08
**Engine version context:** Godot 4.x (stable series at time of extraction)

---

## Mission

> The core invariant purpose — the reason this system exists, independent of any particular release or feature.

Godot exists to provide a **free, fully open-source, community-owned game engine** that enables any developer — regardless of financial resources, hardware level, or geography — to create 2D and 3D games and interactive applications for any platform, with no licensing encumbrances on the output.

The mission is explicitly democratic: the engine "belongs to everybody." It is not a commercial product with open-source marketing; it is governed and sustained by the Godot Foundation (a non-profit) and shaped by contributors who benefit equally from one another's work.

---

## Goals

> Measurable or observable outcomes the system pursues. These may evolve across versions but are the active targets the project steers toward.

### G1 — Universal cross-platform deployment
Export projects to all major desktop OS (Windows, macOS, Linux), mobile (Android, iOS), web (HTML5/WebAssembly), and consoles (via third-party exporters), from a single unified project and editor.

### G2 — Unified 2D and 3D in a single editor
Provide dedicated, first-class 2D and 3D pipelines — not 3D with a 2D workaround — under one editor interface with pixel-accurate 2D coordinates and a full 3D scene system.

### G3 — Accessible scripting for all skill levels
Offer GDScript (high-productivity Python-inspired language native to Godot) as the primary entry point, with C# (.NET) and C++ (via GDExtension) for developers who need performance or familiarity, plus community language bindings (Rust, Python, Nim, etc.).

### G4 — Minimal time-to-running-project
Reduce friction from download to running game to under 5 minutes on a typical connection. The editor is a self-contained binary; no installer, no admin rights, no package manager required.

### G5 — Lean, modular binary footprint
Keep both editor and export template sizes small to remain accessible on low-bandwidth connections and underpowered devices. Features not universally needed should live in add-ons or optional modules, not the core binary.

### G6 — Composable scene-and-node architecture
Let developers build any game structure through composition of reusable scene trees and nodes, rather than deep inheritance hierarchies. Every object is a Node; every scene is a reusable component.

### G7 — Community-driven extensibility
Allow anyone to extend the engine — new nodes, editor plugins, language bindings, renderers — via the Asset Library, GDExtension API, or custom modules, without forking the engine itself.

### G8 — Transparent, contributor-friendly codebase
Keep the source base compilable from scratch by a new contributor on commodity hardware in a reasonable time. Prefer simplicity and maintainability in engine code over micro-optimizations that increase complexity.

### G9 — Stable scripting API within stable branches
Within any `major.minor` stable branch, scripting API changes must be backwards-compatible. Compatibility shims (`_bind_compat_*`) are required for any breaking change; GDExtension API diffs must be validated before merge.

---

## Premises

> Assumptions the system operates under — beliefs about the environment, users, and constraints that the design takes as given.

### P1 — Developers own their output
Users' games and assets belong entirely to them. The MIT license on the engine imposes no royalties, revenue-share, or usage restrictions on games produced with Godot.

### P2 — The scripting language is the primary developer interface
Most game logic is written in GDScript or C#, not C++. The engine API is designed to be called from script; C++ is the implementation layer, not the primary user-facing layer.

### P3 — Hardware is heterogeneous and the low end matters
The target audience spans high-end desktops down to mid-range Android phones and web browsers. Architecture decisions (three renderer tiers, lean binaries, low system requirements) follow from this assumption.

### P4 — Console SDKs are closed-source by manufacturer requirement
Console platform SDKs (PlayStation, Xbox, Nintendo) cannot be included in an open-source project. First-party console export is structurally impossible; third-party exporters fill the gap.

### P5 — Threads are essential, not optional
Game engines require real concurrency. The server/RID architecture (physics server, rendering server, audio server as singleton objects communicating via command buffers) is designed from the ground up to allow subsystems to run in parallel without sharing mutable state across threads.

### P6 — The community sustains the project
There is no corporate owner. Godot runs on donations funnelled through the Godot Foundation and volunteer contributions. Governance decisions reflect community consensus, not a product roadmap set by a single company.

### P7 — Features belong in add-ons unless universally needed
AI, networking, analytics, and other domain-specific functionality are out of scope for core unless demonstrated to be a common need across many game genres. This is an explicit policy to control maintenance surface, binary size, and contributor burden.

### P8 — The editor IS a Godot application
The Godot editor is itself built using the engine's own node and rendering systems. This means dogfooding is constant: the editor validates the GUI and rendering systems on every development build.

---

## Constraints

> Non-negotiable boundaries. Violating these would constitute a fundamental breach of what Godot is.

### C1 — MIT license, perpetually
The engine source code must remain licensed under the MIT license. Any dependency added to the core engine must be compatible with MIT distribution. Closed-source SDKs may not be integrated into the core repository.

### C2 — No royalties, no usage fees, no telemetry
The engine must never charge for use, impose revenue thresholds, collect user data, or phone home. The output (games) must be fully owned by the developer.

### C3 — Backwards API compatibility within a stable branch
Scripting API (GDScript bindings, C# bindings, GDExtension API) must not break silently within a `major.minor` series. All compatibility breakages require explicit compat shims and must be recorded in `extension_api.json` validation. Silent breakage is a bug, not a design choice.

### C4 — No built-in software rendering fallback for the GUI toolkit
Godot's UI system (Control nodes) is always hardware-accelerated. There is no CPU-based software renderer for the editor or runtime GUI. Platforms that cannot provide GPU acceleration are not supported targets.

### C5 — Separate 2D and 3D coordinate systems (no forced 3D for 2D)
2D uses pixel-based coordinates; 3D uses meter-based world units. These are implemented as separate subsystems. 2D must not be a degenerate case of 3D (as it was in some older engines); both must have first-class tooling and physics.

### C6 — Core feature set deliberately kept small
Features that can be implemented as add-ons must not be added to core. This constraint exists to protect: (a) compile times and contributor onboarding, (b) binary size, (c) long-term maintainability when original contributors leave.

### C7 — GDScript must remain tightly integrated
GDScript's design requirements are non-negotiable: native vector types (Vector2, Vector3, Transform3D), first-class thread support, class-extension for Godot's object model, and tight integration with the code editor (completion, live reload). These ruled out Lua, Python, and JavaScript as embedded scripting options and constrain any future scripting language replacements.

### C8 — Export templates must run without the editor
The game runtime (export template) must be separable from the editor. Shipped games must not bundle editor code. This separation is a hard architectural boundary in the build system.

### C9 — Community governance; no single-company control
No single corporation may own or unilaterally direct Godot. The Godot Foundation is constituted as a non-profit specifically to prevent acquisition or unilateral direction. This is a structural, not just cultural, constraint.

---

## Summary Table

| Category | Count | Key items |
|---|---|---|
| Mission | 1 | Free, open, community-owned engine; no licensing barriers |
| Goals | 9 | Cross-platform export, unified 2D/3D, accessible scripting, lean binaries, scene-node composition, extensibility, API stability |
| Premises | 8 | Developer owns output; threads are essential; consoles are closed; community sustains project; features default to add-ons |
| Constraints | 9 | MIT license forever; no fees/telemetry; API compat within stable branch; no software renderer; lean core; GDScript integration; runtime/editor separation; non-profit governance |

---

## Sources

| Document | URL |
|---|---|
| Godot README | `github.com/godotengine/godot/blob/master/README.md` |
| Docs: Introduction | `github.com/godotengine/godot-docs/blob/master/about/introduction.rst` |
| Docs: FAQ | `github.com/godotengine/godot-docs/blob/master/about/faq.rst` |
| Docs: List of Features | `github.com/godotengine/godot-docs/blob/master/about/list_of_features.rst` |
| Docs: Release Policy | `github.com/godotengine/godot-docs/blob/master/about/release_policy.rst` |
| Docs: System Requirements | `github.com/godotengine/godot-docs/blob/master/about/system_requirements.rst` |
| Docs: Architecture Diagram | `github.com/godotengine/godot-docs/blob/master/engine_details/architecture/godot_architecture_diagram.rst` |
| Docs: Internal Rendering Architecture | `github.com/godotengine/godot-docs/blob/master/engine_details/architecture/internal_rendering_architecture.rst` |
| Docs: Handling Compatibility Breakages | `github.com/godotengine/godot-docs/blob/master/engine_details/development/handling_compatibility_breakages.rst` |
| Article: Why Servers and RIDs | `godotengine.org/article/why-does-godot-use-servers-and-rids` |
| Article: Godot 4.0 Sets Sail | `godotengine.org/article/godot-4-0-sets-sail` |
| Godot Foundation | `godot.foundation` |
| Godot Features Page | `godotengine.org/features` |

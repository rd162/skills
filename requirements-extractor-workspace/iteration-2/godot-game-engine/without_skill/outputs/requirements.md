# Godot Engine -- Structured Requirements Specification

**Subject:** Godot Engine (https://github.com/godotengine/godot)
**Version basis:** Godot 4.x (current stable line as of 2026-04-08)
**Sources:** Repository README, design philosophy docs, FAQ, contributing guidelines, proposals evaluation criteria

---

## 1. Mission

**Provide a free, open-source, community-driven game engine that enables developers to create 2D and 3D games from a unified interface, so they can focus on making games without having to reinvent the wheel.**

The mission is threefold and indivisible:
- **Free and open:** The engine exists under the MIT license with zero royalties, zero strings, and zero proprietary dependencies in core. Users own everything they create.
- **All-in-one:** Godot ships a comprehensive set of common tools (editor, scripting, animation, physics, rendering, UI, audio, networking) so that the default path for any developer is self-sufficient.
- **Community-governed:** Development is driven by user needs and open discussion, not by a corporate roadmap. The engine is made by its community, for the community, and for all game creators.

---

## 2. Goals

| ID | Goal | Measurability |
|----|------|---------------|
| G1 | **Cross-platform export with minimal friction** | One-click export to desktop (Windows, macOS, Linux/*BSD), mobile (Android, iOS), and Web. Console support via third-party porting. |
| G2 | **First-class 2D and first-class 3D** | Separate dedicated rendering engines; 2D is pixel-native, not a flattened 3D projection. Both are production-quality. |
| G3 | **Rapid onboarding and high productivity** | A new developer can download, extract, and run the editor in under 5 minutes. GDScript provides Python-like simplicity with engine-native types. |
| G4 | **Small binary footprint** | Editor and export templates remain small enough for developers on slow connections and for deployment on mobile/web where size budgets are strict. |
| G5 | **Fast compilation from source** | The codebase stays small and tidy so that new contributors can build the engine without high-end hardware, lowering the barrier to contribution. |
| G6 | **Extensibility without forking** | GDExtension allows compiled-language plugins (C, C++, Rust, etc.) without recompiling the engine. Editor plugins use the same API and scene system as games. |
| G7 | **Continuous, stable user experience** | The integrated editor provides code editing, animation, tilemap editing, shader editing, debugging, profiling, and hot-reload in one coherent tool. |
| G8 | **Benefit the most users first** | Core development prioritizes features that serve the widest cross-section of game types, not niche genres or single studios. |

---

## 3. Premises (Assumptions)

| ID | Premise | Implication |
|----|---------|-------------|
| P1 | **Game developers should not need to reinvent common tools.** | The engine ships batteries-included: physics, UI, audio, animation, networking, scripting, etc. |
| P2 | **A tightly integrated custom scripting language outperforms bolting on general-purpose languages.** | GDScript exists because Lua, Python, and JavaScript all failed on threading, class extension, C++ binding quality, native vector types, GC pauses, and editor integration. |
| P3 | **The editor is itself a game built on the engine.** | Godot's editor runs on Godot's own UI system and rendering pipeline. This guarantees that the UI toolkit and runtime are battle-tested by the editor itself. `@tool` scripts run identically in-editor and in-game. |
| P4 | **Object-oriented design with composition and inheritance is the right paradigm for game structure.** | The scene/node tree is the fundamental abstraction. Scenes nest (composition), scenes inherit (extension). This replaces the Entity-Component-System pattern used by some other engines. |
| P5 | **2D and 3D are fundamentally different rendering problems.** | They get separate engines rather than 2D being a special case of 3D. The base unit for 2D is pixels. You can still mix 2D-in-3D and 3D-in-2D. |
| P6 | **Open source sustainability requires a small, maintainable core.** | Contributors come and go. Every line merged becomes a long-term maintenance burden. Features that can live as add-ons should live as add-ons. |
| P7 | **Performance bottlenecks are rarely in the scripting layer.** | GPU, physics, navigation, and algorithmic choices dominate. All supported scripting languages are "fast enough" for general-purpose game logic. |
| P8 | **Community feedback is the primary driver for prioritization.** | User pain points, proposal support levels, and open discussion determine what gets built, not top-down mandates. |

---

## 4. Constraints (Non-Negotiable Boundaries)

| ID | Constraint | Rationale |
|----|-----------|-----------|
| C1 | **MIT license for all code shipping in core.** | All technologies bundled with the engine must be legally compatible with the MIT license. No closed-source or copyleft-incompatible dependencies in the main binary. |
| C2 | **No proprietary/closed-source SDKs in core.** | FMOD, GameWorks, Google AdMob, and similar are explicitly excluded from the engine repository. They may exist as third-party plugins. |
| C3 | **No royalties, no usage fees, no strings.** | Users' games are entirely theirs. The license imposes no financial obligations or usage restrictions of any kind. |
| C4 | **Core feature set stays deliberately small.** | Features accepted into core must (a) solve common use cases benefiting most users, (b) not be feasibly implementable as an add-on, (c) be maintainable long-term, and (d) not bloat binary size. Advanced AI, genre-specific systems, and niche integrations are excluded. |
| C5 | **Backward-compatible contribution workflow.** | PRs must solve a common use case, maintain code quality, include documentation for new API surface, and preferably include unit tests. Commit history must be clean (no merge commits, stable intermediate states). |
| C6 | **No AI-generated proposal text.** | Proposal contributions must be written by humans in their own words. AI-written proposals are explicitly banned from the proposals process. |
| C7 | **Editor must remain portable and lightweight.** | No system installation required. No administrator privileges required. Semi-portable by default (executable runs from anywhere; config goes to user data directory). Full portable mode available. |
| C8 | **General-purpose over genre-specific.** | A feature useful only for 3D FPS games is less likely to be accepted than one useful for all 3D games. Proposals must demonstrate broad applicability. Inventory systems, advanced AI behaviors, and similar genre-specific features are rejected in favor of enabling users to build them. |
| C9 | **Enable over implement.** | The core developers prioritize changes that enable users to implement features themselves (APIs, extension points, primitives) over implementing those features directly in core. |
| C10 | **Complexity budget.** | Highly complex changes involving substantial modifications to core are held to a higher bar than changes containable within a single node or module. The codebase must remain approachable to new contributors. |

---

## 5. Derived Design Principles (from the above)

These are not separate requirements but emergent patterns that follow from the mission, goals, premises, and constraints:

1. **Scene-as-class:** The scene is the universal unit of composition -- a weapon, a character, a level, or any reusable game element. Scenes compose, inherit, and extend.
2. **Nodes are not components:** Nodes form an inheritance tree (Sprite2D -> Node2D -> CanvasItem -> Node), not a flat component bag. Each node type has a specific purpose.
3. **The editor dogfoods the engine:** Because the editor is built on the engine's own systems, any improvement to the UI toolkit or runtime benefits both the editor and user projects.
4. **GDExtension as the escape hatch:** When scripting performance is insufficient, GDExtension provides native-speed code without touching the engine source. This keeps the core small while allowing unlimited extension.
5. **Pay only for what you use:** The push toward add-ons and optional modules means projects carry only the code they need, especially important for mobile and web targets.

---

## 6. Supported Platforms

**Editor hosts:** Windows, macOS, Linux/*BSD, Android (experimental), Web (experimental)

**Export targets:** Windows, macOS, Linux/*BSD, Android, iOS, Web

**Architectures:** 32-bit and 64-bit where applicable; Apple Silicon native; ARM Linux (e.g., Raspberry Pi, community-supported)

**Console:** Not directly supported in the open-source repository. Available through third-party porting services listed on the Godot website.

---

## 7. Officially Supported Languages

| Language | Role | Notes |
|----------|------|-------|
| GDScript | Primary scripting | Custom language optimized for Godot; recommended for new users |
| C# | Secondary scripting | Broadly supported but missing on Web platform; newer integration |
| C++ | Engine-level / GDExtension | For performance-critical code or engine modification |
| Other (via GDExtension) | Third-party | Rust, D, Haxe, Swift, Python, Nim, etc. -- community-maintained |

---

*Extracted from: godotengine/godot README.md, design philosophy documentation, FAQ, CONTRIBUTING.md, and godotengine/godot-proposals evaluation criteria.*

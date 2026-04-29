# Godot Engine -- Requirements Specification

Extracted using the Requirements Extractor skill v3.0.
Input type: **Repository** (GitHub: godotengine/godot) + official documentation and foundation website.

---

## Phase 0: Bottom-Up Requirements Saturation

### CoK Expansion

**L5 -- Topics:**
- (README, states, cross-platform game engine)
- (README, states, 2D and 3D unified interface)
- (README, states, MIT license / free and open source)
- (README, states, community-driven development)
- (README, states, one-click export to multiple platforms)
- (design philosophy, states, node-based scene composition)
- (design philosophy, states, all-inclusive toolset)
- (design philosophy, states, editor-is-a-game architecture)
- (design philosophy, states, separate 2D and 3D engines)
- (design philosophy, states, GDScript as purpose-built language)
- (features page, states, Vulkan/D3D12/Metal/OpenGL rendering)
- (features page, states, GDExtension native API)
- (features page, states, OpenXR/WebXR support)
- (contributing, states, proposals process for new features)
- (contributing, states, features must benefit most users)
- (contributing, states, addons/GDExtension preferred over core bloat)
- (license page, states, no royalties or contracts)
- (console page, states, console ports via third-party only)
- (foundation, states, non-profit Dutch entity Stichting Godot)
- (foundation, states, donation-funded development)
- (version.py, states, Godot 4.7-dev / SCons build system)
- (platform dir, states, android/ios/linuxbsd/macos/visionos/web/windows targets)
- (modules dir, states, ~45 optional modules including mono/C#, physics, networking, XR)
- (proposals README, states, no AI-generated proposals accepted)

**L4 -- Areas:**
- (cross-platform game engine, belongs_to, game development tooling)
  - has_pattern: unified editor + export templates per platform
- (node-based scene composition, belongs_to, entity-component architecture alternatives)
  - has_pattern: inheritance-based node hierarchy, scene nesting/instancing
- (all-inclusive toolset, belongs_to, integrated development environments)
  - has_pattern: built-in scripting, animation, tilemap, shader, debugger, profiler
- (MIT licensing, belongs_to, open-source sustainability models)
  - has_pattern: permissive license + foundation donations + third-party ecosystem
- (multi-renderer support, belongs_to, graphics abstraction)
  - has_pattern: Vulkan/D3D12/Metal for modern GPUs, OpenGL/GLES3 for older/integrated

**L3 -- Fields:**
- (game development tooling, implements_via, native C++ engine + scripting layer)
  - requires: SCons build system, Python 3, C++17 compiler toolchain
- (graphics abstraction, implements_via, RenderingDevice abstraction + driver backends)
  - requires: Vulkan SDK or D3D12 or Metal framework depending on platform
- (cross-platform export, implements_via, platform-specific export templates)
  - requires: platform SDKs (Android SDK, Xcode, Emscripten for web)
- (integrated IDE, implements_via, editor built on engine's own UI system)
  - requires: engine dogfoods its own rendering and UI for the editor
- (extensibility, implements_via, GDExtension C API + module system)
  - requires: stable ABI boundary for third-party native extensions

**L2 -- Disciplines:**
- (native C++ engine, grounded_in, software engineering)
  - mandates: code style via clang-format, clang-tidy, pre-commit hooks, unit tests on CI
- (open-source governance, grounded_in, community management)
  - mandates: proposals process, CODEOWNERS review, contributor chat coordination
- (cross-platform deployment, grounded_in, platform engineering)
  - mandates: per-platform CI, export template builds, platform-specific driver code
- (permissive licensing, grounded_in, intellectual property law)
  - mandates: all bundled third-party libraries must be MIT-compatible
- (game engine design, grounded_in, real-time systems engineering)
  - mandates: deterministic frame loops, low-latency input, GPU-bound rendering pipelines

**L1 -- Domains:**
- [software engineering] part_of [technology] -- confirmed
- [game design] part_of [creative arts] -- disjoint from technology at domain level
- [intellectual property law] part_of [legal] -- disjoint from technology at domain level
- Disjointness verified: technology, creative arts, legal are separate top-level domains that intersect at the product level

### Saturation Summary

```
L5->{cross-platform, 2D+3D, MIT-license, community-driven, one-click-export,
     node-composition, all-inclusive-tools, editor-as-game, separate-2D-3D,
     GDScript, multi-renderer, GDExtension, XR, proposals-process,
     addon-over-core, no-royalties, console-via-third-party, foundation,
     donation-funded, SCons, 8-platforms, 45-modules}
L4->[game-dev-tooling]+{unified-editor, export-templates}
    [node-hierarchy]+{inheritance-composition, scene-instancing}
    [integrated-IDE]+{built-in-editors, hot-reload}
    [open-source-sustainability]+{MIT, donations, third-party-ecosystem}
    [graphics-abstraction]+{Vulkan, D3D12, Metal, OpenGL}
L3->[native-C++-engine]+{SCons, Python3, C++17}
    [rendering-device]+{Vulkan-SDK, platform-drivers}
    [cross-platform-export]+{platform-SDKs, Emscripten}
    [GDExtension]+{stable-ABI, native-plugins}
L2->[software-engineering]+{clang-format, CI, unit-tests, code-review}
    [community-governance]+{proposals, CODEOWNERS, contributor-chat}
    [platform-engineering]+{per-platform-CI, export-templates}
    [IP-law]+{MIT-compatible-dependencies}
    [real-time-systems]+{frame-loops, low-latency, GPU-pipelines}
L1->[technology, creative-arts, legal] -- verified disjoint

Requirements:
  L4[constraints]: features must benefit most users; prefer addon/GDExtension over core
  L3[constraints]: SCons+Python3+C++17 toolchain; platform SDKs per target; MIT-compatible deps
  L2[mandates]: code style enforcement; CI on all platforms; proposals governance;
                all third-party code MIT-compatible; deterministic real-time frame loop
```

---

## Phase 1: Top-Down Intent Inference

### Mission

Enable anyone to create games without barriers.

**W-functor chain:** provide a game engine --> let people make 2D/3D games --> remove cost and access barriers to game creation --> empower creative expression for everyone --> creative self-expression is intrinsically valuable <-- tautology

**Quality gate:**
1. Single sentence -- yes.
2. Invariant test -- change any Goal (e.g., drop 3D support, switch to proprietary license) and the Mission still holds: enabling barrier-free game creation does not depend on any specific goal.
3. Tautology test -- "Why enable anyone to create games without barriers?" --> "Because creative self-expression is intrinsically valuable" --> circular. Confirmed fixed point.

### Goals

1. **Provide a unified 2D and 3D game engine** -- users create both 2D and 3D games from a single editor and toolchain, without switching tools.
2. **Support cross-platform export from a single project** -- games export with one click to desktop (Linux, macOS, Windows), mobile (Android, iOS), web, and XR platforms; console export available via third-party partners.
3. **Remain completely free and open source under the MIT license** -- no royalties, no contracts, no vendor lock-in; users own everything they create.
4. **Deliver an all-inclusive development environment** -- ship built-in scripting (GDScript, C#), animation, tilemap, shader, debugger, and profiler editors so users can focus on making games without reinventing common tools.
5. **Maintain community-driven governance** -- development priorities reflect community needs via open proposals, contributor chat, and foundation oversight rather than corporate directives.
6. **Provide extensibility without engine modification** -- GDExtension API and addon/plugin system allow third-party functionality (including proprietary tools) without forking or recompiling the engine.

### Premises

| # | Premise | Source | Risk if false |
|---|---------|--------|---------------|
| P1 | Game developers need an integrated editor rather than assembling separate tools | Inferred from "all-inclusive" design philosophy (godot_design_philosophy.rst) | Engine's monolithic editor approach becomes a liability; users would prefer modular/headless workflows |
| P2 | A permissive (MIT) license is more valuable than a copyleft or source-available model for attracting both hobbyist and commercial users | Stated in README ("very permissive MIT license") and license page | Switching licenses would fracture community; but staying MIT means no license-based revenue |
| P3 | Community volunteers and donation-funded developers can sustain engine development at competitive quality | Inferred from foundation funding model (godot.foundation) and CONTRIBUTING.md | If volunteer pipeline dries up or donations decline, development velocity drops below competitive threshold -- **HIGH RISK** |
| P4 | GDScript (a purpose-built scripting language) provides enough value to justify the cost of maintaining a custom language | Stated in design philosophy ("designed for the needs of game developers") | Maintenance burden of a bespoke language with limited ecosystem outside Godot; users may prefer Python/Lua instead |
| P5 | Node-based inheritance is a viable alternative to entity-component-system (ECS) architecture for game objects | Stated in design philosophy (explicit contrast with component-based engines) | Performance-critical games (large entity counts) may hit scaling limits compared to ECS-based engines |
| P6 | Console manufacturers will continue allowing third-party porting of open-source engines | Inferred from console support page (godotengine.org/consoles) | If console OEMs restrict third-party ports, Godot games lose access to major commercial platforms -- **HIGH RISK** |
| P7 | The SCons build system can scale to the project's growing codebase and contributor base | Inferred from SConstruct (52KB build file) and build toolchain | Build times and contributor onboarding friction increase; migration to another build system would be extremely costly |
| P8 | Separate 2D and 3D rendering pipelines provide better results than a unified pipeline | Stated in design philosophy ("separate 2D and 3D engines") | Maintaining two pipelines doubles rendering maintenance burden; if unified pipelines catch up in quality, the split becomes pure overhead |

**HIGH RISK premises:** P3 (sustainability of volunteer + donation model) and P6 (third-party console access) -- falsification of either would threaten the Mission itself, not just individual Goals.

### Constraints

#### Hard (violation = rejection)

| # | Constraint | Source |
|---|-----------|--------|
| C1 | MIT license for all engine code -- no copyleft, no proprietary dependencies in core | Stated (README, LICENSE.txt, design philosophy) |
| C2 | All bundled third-party libraries must be MIT-compatible | Stated (design philosophy: "all bundled technologies must be MIT-compatible") |
| C3 | Engine must compile and run on Linux, macOS, and Windows at minimum | Stated (README: "major desktop platforms"); enforced via CI workflows |
| C4 | New core features must benefit most users, not niche use cases | Stated (proposals evaluation criterion #4: "Does this proposal benefit most users?") |
| C5 | Features implementable as addons/GDExtension should NOT be added to core | Stated (proposals evaluation criterion #3) |
| C6 | C++ codebase must conform to clang-format style and pass clang-tidy checks | Inferred from .clang-format, .clang-tidy, .pre-commit-config.yaml in repo root |
| C7 | No official first-party console ports (NDA-bound SDKs conflict with open-source model) | Stated (console page: "Console development requires the opposite: legal contracts and closed access") |
| C8 | SCons + Python 3 as the build system | Inferred from SConstruct (52KB), methods.py, platform_methods.py at repo root |
| C9 | All new scripting API additions must include class reference documentation | Stated (CONTRIBUTING.md: "you must update the class reference to document those") |
| C10 | The Godot Foundation does not own the Godot Project | Stated (godot.foundation: "legally independent organization and does not own the Godot Project") |

#### Soft (violation = penalty)

| # | Constraint | Source |
|---|-----------|--------|
| S1 | Prefer composition over complexity -- simple PRs addressing one topic each | Stated (CONTRIBUTING.md: "open 3 different PRs that each address a different issue") |
| S2 | Pull requests should include unit tests | Stated (CONTRIBUTING.md: "PRs that include tests are more likely to be merged") |
| S3 | Commit messages should follow imperative-verb-first style, under 72 chars | Stated (CONTRIBUTING.md commit message guidelines) |
| S4 | Features should overcome a limitation rather than merely being nice-to-have | Stated (proposals evaluation criterion #6) |
| S5 | Low-complexity changes preferred over highly complex core changes | Stated (proposals evaluation criterion #7) |
| S6 | Mobile-first is not a requirement, but Android and iOS must be supported export targets | Inferred from platform directory (android/, ios/) and README |
| S7 | GDScript should remain beginner-friendly with optional static typing | Inferred from features page ("easy to pick up even if you are a beginner") |
| S8 | Editor should dogfood the engine's own UI and rendering systems | Stated (design philosophy: "the editor itself runs on the game engine") |

---

## Mission Space

### Evaluated Alternatives

| Alternative | Fit Against Hard Constraints | Notes |
|---|---|---|
| ECS architecture instead of node hierarchy | Violates design philosophy (C4/C5 implications -- would require massive core rewrite) | Could be implemented as GDExtension addon; some community efforts exist |
| Switch from SCons to CMake or Meson | Does not violate any hard constraint but migration cost is enormous | Recurring community discussion; SCons deeply embedded in codebase |
| Replace GDScript with embedded Lua or Python | Does not violate hard constraints but conflicts with P4 premise | GDScript's tight editor integration would be hard to replicate |
| Copyleft (GPL/LGPL) license instead of MIT | Violates C1 -- hard rejection | Would prevent proprietary game distribution without engine source disclosure |
| First-party console support | Violates C7 -- requires closed NDAs incompatible with open-source model | Third-party porting houses (W4 Games, Lone Wolf Technology, etc.) fill this gap |
| Cloud-based editor (web IDE) | Does not violate hard constraints | Would be a separate product; S8 (editor dogfooding) makes this architecturally complex |

### Domain Context

- **Competitive landscape:** Godot competes with Unity, Unreal Engine, and open-source alternatives (Bevy, Stride, O3DE). Its differentiators are the MIT license (no royalties, no runtime fees) and community governance (no corporate owner who can change terms).
- **Unity pricing crisis (2023):** Unity's retroactive Runtime Fee announcement drove significant developer migration to Godot, accelerating community growth and donations. This validated Godot's "no strings attached" positioning but also created scaling pressure on infrastructure and governance.
- **Console access gap:** The inability to ship first-party console exports remains the most significant commercial limitation. Third-party partners mitigate this but add cost and dependency.
- **Rendering maturity:** Godot 4.x introduced Vulkan-based rendering, but the 3D renderer is still maturing compared to Unreal/Unity. The 2D pipeline is considered more mature and competitive.
- **Foundation independence:** The Godot Foundation (Stichting Godot, Netherlands) is legally separate from the project itself. This creates a governance buffer but also means the Foundation cannot unilaterally direct development.
- **GDExtension ecosystem:** The stable ABI boundary for native extensions is a strategic bet -- it allows the engine core to stay lean while enabling proprietary and community extensions without engine forks.

### Knowledge Gaps

1. **Performance benchmarks vs. competitors** -- No systematic public benchmarking data was found in the repository or official docs comparing Godot's rendering/physics performance to Unity or Unreal.
2. **Long-term funding sustainability** -- The Foundation publishes some financial information but detailed burn rate, runway, and growth projections are not publicly available in the repo.
3. **Backward compatibility policy** -- No explicit policy document was found defining how breaking changes between major versions (e.g., 3.x to 4.x) are managed or what stability guarantees exist within a major version.
4. **Accessibility (a11y) requirements** -- No stated requirements for engine or editor accessibility for developers with disabilities were found in the reviewed sources.
5. **Security model** -- No explicit security policy or threat model for the engine runtime, editor, or exported games was found in the repository (no SECURITY.md).
6. **Minimum hardware requirements** -- No formal minimum system requirements for running the editor or exported games are documented in the repo itself.

---

*Specification produced: 2026-04-08*
*Input sources: godotengine/godot README.md, CONTRIBUTING.md, LICENSE.txt, version.py, repository structure, .clang-format, .clang-tidy, .pre-commit-config.yaml, platform/ directory, modules/ directory, .github/ directory; godotengine/godot-proposals README.md; godotengine.org/features, godotengine.org/license, godotengine.org/consoles; godot.foundation; godot-docs/godot_design_philosophy.rst*

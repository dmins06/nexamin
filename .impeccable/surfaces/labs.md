# Phòng Lab

Primary target: src/features/labs/LabHubView.tsx
Mode: Operate. Ordinary extension of Nexamin; the user explicitly specifies a multidisciplinary hub wrapping the existing Anatomy module. Keep the existing visual system and simulation unchanged.

## Direction contract

THESIS: Discover a learning lab by field, then enter its independent workspace. The catalogue now contains two launchable labs: Giải phẫu người 3D (available) and CNTT Lab (beta).

OWN-WORLD: Existing Nexamin glass surfaces, semantic dark/light colors, Manrope/Space Grotesk, Lucide icons and visible keyboard focus. No new imagery or global visual system.

STORY: Open Phòng Lab, search or select a field, then launch Giải phẫu người 3D or CNTT Lab. Anatomy opens its existing viewer; CNTT opens a catalogue with Code Lab and Algorithm Lab. Return to Phòng Lab with the stored search and field preferences intact.

FIRST VIEWPORT: Plain title/subtitle, search, two launchable lab cards, and a compact field filter showing honest unreleased states. On narrow screens controls stack within the existing shell and five-item bottom bar.

FORM: User-pinned lightweight discovery hub; no concept tournament. Signature interaction: registry-based launch with breadcrumb/back navigation, loading the simulation only after an explicit launch.

## Shipped catalogue and navigation

- `/labs`: registry search and eight field filters; search is Vietnamese accent-insensitive. `nexamin.labs.v1` stores the versioned search and selected field.
- `/labs/anatomy`: available Giải phẫu người 3D, loaded through the existing Anatomy workspace and its back/breadcrumb controls.
- `/labs/it`: beta CNTT Lab, with scoped nested routes, its own breadcrumb and lazy-loaded child workspaces. The Lab navigation entry stays active on nested lab URLs.
- The CNTT catalogue has two beta workspaces and six explicitly unreleased roadmap pages. The roadmap pages describe future scope and offer a return to Code Lab; they do not provide simulations.

## Visual continuity

Existing Orbit to Surface backgrounds, semantic theme tokens, glass panels, Lucide icons, display/body font roles and visible focus remain the authority. This is a surface extension; no global tokens, imagery, shell layout or Anatomy design are redefined. The earlier one-lab catalogue description has been reconciled with `labRegistry.ts`, `labModules.ts` and `AppRoutes.tsx`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

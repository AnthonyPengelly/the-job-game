// The crew rail has moved to CrewRail (src/console/shell/CrewRail.tsx) in E13.2.
// This re-export preserves backward compatibility for tests and imports
// that reference the Hud by name.
export { CrewRail as Hud } from '@/console/shell/CrewRail';

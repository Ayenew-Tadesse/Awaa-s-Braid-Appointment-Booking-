// The demo salon in this browser: shared by both demo accounts, saved in
// localStorage, with the database's rules applied in code (visibility.ts).
// Clearly a demo: nothing leaves the browser; "Reset the demo" starts over.
import type { Dataset } from "../domain/types";
import { localDay } from "../domain/time";
import { buildWorld, type World } from "../demo/seed";
import { visibleTo } from "./visibility";
import type { Store } from "./store";

const KEY = "awaa_demo_world_v1";
const ACCOUNT = "awaa_demo_account";

/** The demo salon, rebuilt each new day so its diary stays around today. */
export function loadWorld(now = new Date()): World {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const w = JSON.parse(raw) as World;
      if (w.builtOn === localDay(now, w.salon.timezone)) return w;
    }
  } catch { /* fresh */ }
  const w = buildWorld(now);
  saveWorld(w);
  return w;
}
export function saveWorld(w: World) { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* storage full or blocked: this visit only */ } }
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* nothing to reset */ } }
export const demoAccount = () => { try { return localStorage.getItem(ACCOUNT); } catch { return null; } };
export const setDemoAccount = (profileId: string | null) => {
  try { if (profileId) localStorage.setItem(ACCOUNT, profileId); else localStorage.removeItem(ACCOUNT); } catch { /* this visit only */ }
};

export class DemoStore implements Store {
  mode = "demo" as const;
  constructor(private profileId: string) {}
  async load(): Promise<Dataset> { return visibleTo(loadWorld(), this.profileId); }
  async signOut() { setDemoAccount(null); }
}

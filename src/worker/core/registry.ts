// Capability Registry — every feature is a capability.
//
// A capability has:
//   - id, name, version
//   - manifest (metadata)
//   - enabled flag
//   - config (JSON)
//
// Capabilities NEVER touch the Core directly. They subscribe to events,
// register operations, and are exposed via the API.

import { newId, now } from "./id";
import { queryAll, run } from "./db";
import type { Env } from "./db";
import type { Capability } from "../../shared/types";

export interface CapabilityManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions?: string[];
  events_subscribed?: string[];
  events_published?: string[];
}

const registeredManifests = new Map<string, CapabilityManifest>();

export const registry = {
  register(manifest: CapabilityManifest): void {
    registeredManifests.set(manifest.id, manifest);
  },

  get(id: string): CapabilityManifest | undefined {
    return registeredManifests.get(id);
  },

  list(): CapabilityManifest[] {
    return Array.from(registeredManifests.values());
  },

  async syncToDb(env: Env): Promise<void> {
    for (const m of registeredManifests.values()) {
      const existing = await queryAll<Capability>(
        env.DB,
        `SELECT id FROM capabilities WHERE id = ? LIMIT 1`,
        m.id
      );
      if (existing.length) {
        await run(
          env.DB,
          `UPDATE capabilities 
           SET name = ?, version = ?, manifest = ?, updated_at = ?
           WHERE id = ?`,
          m.name,
          m.version,
          JSON.stringify(m),
          now(),
          m.id
        );
      } else {
        await run(
          env.DB,
          `INSERT INTO capabilities (id, name, version, enabled, config, manifest, created_at, updated_at)
           VALUES (?, ?, ?, 1, '{}', ?, ?, ?)`,
          m.id,
          m.name,
          m.version,
          JSON.stringify(m),
          now(),
          now()
        );
      }
    }
  },
};

// App Registry — capabilities can register UI apps.
//
// Each app has:
//   - id, name, icon (emoji or SVG)
//   - render(): the React component
//   - optional onOpen/onClose hooks
//
// This is how Raymond keeps UI modular: to add a new screen,
// you register a new app. Nothing else changes.

import type { ComponentType } from "react";

export interface AppRegistration {
  id: string;
  name: string;
  icon: string;
  description?: string;
  component: ComponentType<unknown>;
  order?: number;
}

const apps = new Map<string, AppRegistration>();

export const appRegistry = {
  register(app: AppRegistration): void {
    apps.set(app.id, app);
  },

  get(id: string): AppRegistration | undefined {
    return apps.get(id);
  },

  list(): AppRegistration[] {
    return Array.from(apps.values()).sort(
      (a, b) => (a.order ?? 100) - (b.order ?? 100)
    );
  },
};

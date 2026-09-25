// Shop API client.

const BASE = "/api/shop";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(res.status + ": " + text.slice(0, 200));
  }
  return (await res.json()) as T;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  quota_gb: number;
  speed_mbps: number;
  duration_days: number;
  price_toman: number;
  enabled: number;
  sort_order: number;
  created_at: number;
}

export interface Order {
  id: string;
  user_telegram_id: string;
  user_username: string | null;
  user_first_name: string | null;
  product_name: string;
  price_toman: number;
  status: string;
  xray_user_name: string | null;
  xray_sub_token: string | null;
  created_at: number;
  approved_at: number | null;
}

export interface Stats {
  total: number;
  pending: number;
  completed: number;
  rejected: number;
  revenue: number;
  revenueToday: number;
}

export interface ShopSettings {
  shop_name?: string;
  shop_description?: string;
  support_username?: string;
  payment_card?: string;
  payment_holder?: string;
  welcome_message?: string;
}

export interface BotButton {
  id: string;
  label: string;
  action_type: "text" | "url" | "callback";
  visible_to: "all" | "admins" | "users";
  action_value: string;
  sort_order: number;
  enabled: boolean;
  created_at: number;
}

export const shopApi = {
  getProducts: () => req<{ ok: boolean; products: Product[] }>("/products"),

  createProduct: (data: Partial<Product>) =>
    req<{ ok: boolean; id: string }>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProduct: (id: string, data: Partial<Product>) =>
    req<{ ok: boolean }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: string) =>
    req<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" }),

  getOrders: (status?: string) =>
    req<{ ok: boolean; orders: Order[] }>(
      "/orders" + (status ? `?status=${status}` : "")
    ),

  approveOrder: (id: string) =>
    req<{ ok: boolean; xrayUserName?: string; error?: string }>(
      `/orders/${id}/approve`,
      { method: "POST" }
    ),

  rejectOrder: (id: string, reason?: string) =>
    req<{ ok: boolean }>(`/orders/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  deleteOrder: (id: string) =>
    req<{ ok: boolean }>(`/orders/${id}`, { method: "DELETE" }),

  getStats: () => req<{ ok: boolean } & Stats>("/stats"),

  getSettings: () =>
    req<{ ok: boolean; settings: ShopSettings }>("/settings"),

  getBotButtons: () =>
    req<{ ok: boolean; buttons: BotButton[] }>("/bot-buttons"),
  createBotButton: (data: Partial<BotButton>) =>
    req<{ ok: boolean; id: string }>("/bot-buttons", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBotButton: (id: string, data: Partial<BotButton>) =>
    req<{ ok: boolean }>("/bot-buttons/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBotButton: (id: string) =>
    req<{ ok: boolean }>("/bot-buttons/" + id, {
      method: "DELETE",
    }),

  setSetting: (key: string, value: string) =>
    req<{ ok: boolean }>(`/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};

export function formatToman(n: number): string {
  return n.toLocaleString("fa-IR") + " تومان";
}

export function formatDate(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("fa-IR") + " " + d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

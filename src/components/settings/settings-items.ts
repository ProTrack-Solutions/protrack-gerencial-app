import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";

import type { User } from "@/interfaces/auth.interface";
import { canAccess } from "@/components/side-menu/menu-items";

export type SettingsItem = {
  label: string;
  description: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  /** Módulo exigido pela API (`RequireModule`). */
  module?: string;
  /** A API exige o perfil ADMIN. */
  adminOnly?: boolean;
};

export type SettingsSection = { title: string; items: SettingsItem[] };

// Mesmas regras de acesso do ProTrack web (moduleAccess.const.ts).
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: "Conta",
    items: [
      { label: "Meu perfil", description: "Nome, e-mail e usuário", href: "/perfil", icon: "person-circle-outline", color: "#3c87f7" },
      { label: "Segurança", description: "Senha e desbloqueio por biometria", href: "/seguranca", icon: "shield-checkmark-outline", color: "#2F855A" },
    ],
  },
];

export function visibleSettings(user: User | null): SettingsSection[] {
  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccess(user, item.module) && (!item.adminOnly || user?.role === "ADMIN")),
  })).filter((section) => section.items.length > 0);
}

/** "Maria da Silva" -> "MS" */
export function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

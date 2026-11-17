import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { initials, visibleSettings } from "@/components/settings/settings-items";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAuth } from "@/contexts/auth-context";
import { useSideMenu } from "@/contexts/side-menu-context";
import { haptics } from "@/utils/haptics";

/** Central de configurações: só aparece o que o perfil do usuário pode abrir. */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const sideMenu = useSideMenu();
  const { user } = useAuth();
  const sections = visibleSettings(user);

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Configurações" subtitle="Sua conta e os cadastros da empresa." leading={{ type: "menu", onPress: sideMenu.open }} />
      <ScrollView contentContainerClassName="w-full max-w-content self-center gap-four p-three" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push("/perfil");
          }}
          accessibilityRole="button"
          className="flex-row items-center gap-three rounded-three bg-paper p-three active:bg-surface"
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
            <ThemedText className="text-lg font-bold text-brand">{initials(user?.name)}</ThemedText>
          </View>
          <View className="flex-1 gap-half">
            <ThemedText className="font-bold" numberOfLines={1}>
              {user?.name ?? "Minha conta"}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={1}>
              {user?.email}
            </ThemedText>
            <ThemedText type="smallBold" className="text-xs text-brand">
              {user?.role === "ADMIN" ? "Administrador" : user?.department_name || "Colaborador"}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#8A94A6" />
        </Pressable>

        {sections.map((section) => (
          <View key={section.title} className="gap-two">
            <ThemedText type="smallBold" themeColor="textSecondary" className="px-one text-[11px] tracking-widest">
              {section.title.toUpperCase()}
            </ThemedText>
            <View className="overflow-hidden rounded-three bg-paper">
              {section.items.map((item, index) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    haptics.tap();
                    router.push(item.href);
                  }}
                  accessibilityRole="button"
                  className={`flex-row items-center gap-three p-three active:bg-surface ${index > 0 ? "border-t-hairline border-line" : ""}`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-two" style={{ backgroundColor: `${item.color}1A` }}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View className="flex-1 gap-half">
                    <ThemedText type="smallBold">{item.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      {item.description}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8A94A6" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <ThemedText type="small" themeColor="textSecondary" className="text-center text-xs">
          Assinatura e plano são gerenciados no ProTrack web.
        </ThemedText>
      </ScrollView>
    </View>
  );
}

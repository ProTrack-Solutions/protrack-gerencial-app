import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { REPORT_GROUPS } from "@/components/reports/catalog";
import { ThemedText } from "@/components/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useSideMenu } from "@/contexts/side-menu-context";
import { haptics } from "@/utils/haptics";

/** Catálogo de relatórios: toque em um para abrir com o período. */
export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const sideMenu = useSideMenu();

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Relatórios" subtitle="Vendas, estoque e financeiro em números." leading={{ type: "menu", onPress: sideMenu.open }} />
      <ScrollView contentContainerClassName="w-full max-w-content self-center gap-four p-three" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {REPORT_GROUPS.map((group) => (
          <View key={group.label} className="gap-two">
            <ThemedText type="smallBold" themeColor="textSecondary" className="px-one text-[11px] tracking-widest">
              {group.label.toUpperCase()}
            </ThemedText>
            <View className="overflow-hidden rounded-three bg-paper">
              {group.reports.map((report, index) => (
                <Pressable
                  key={report.type}
                  onPress={() => {
                    haptics.tap();
                    router.push({ pathname: "/relatorio", params: { type: report.type } });
                  }}
                  accessibilityRole="button"
                  className={`flex-row items-center gap-three p-three active:bg-surface ${index > 0 ? "border-t-hairline border-line" : ""}`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-two" style={{ backgroundColor: `${report.color}1A` }}>
                    <Ionicons name={report.icon} size={20} color={report.color} />
                  </View>
                  <View className="flex-1 gap-half">
                    <ThemedText type="smallBold">{report.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                      {report.description}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8A94A6" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { SectionCard } from "@/components/sale/section-card";
import { ThemedText } from "@/components/themed-text";
import type { Announcement } from "@/interfaces/announcement.interface";
import { getAnnouncementTimeHint, getAnnouncementType } from "@/utils/announcements";
import { haptics } from "@/utils/haptics";
import { OutlineButton } from "./outline-button";

type AlertsCardProps = {
  /** Avisos no ar hoje (GET /announcements/today). */
  announcements: Announcement[];
  /** Abre o quadro de avisos, já no aviso tocado quando houver. */
  onOpen: (announcement?: Announcement) => void;
};

export function AlertsCard({ announcements, onOpen }: AlertsCardProps) {
  const urgent = announcements.filter((a) => getAnnouncementType(a.type).urgent).length;

  return (
    <SectionCard
      title="Avisos do dia"
      icon="notifications-outline"
      right={
        urgent > 0 ? (
          <View className="rounded-full bg-rose-50 px-two py-half">
            <ThemedText type="smallBold" className="text-xs text-rose-700">
              {urgent} {urgent === 1 ? "importante" : "importantes"}
            </ThemedText>
          </View>
        ) : undefined
      }
    >
      {announcements.length === 0 ? (
        <View className="items-center rounded-two border border-dashed border-line py-four">
          <ThemedText type="small" themeColor="textSecondary" className="text-center">
            Tudo tranquilo por aqui.{"\n"}Nenhum aviso para hoje.
          </ThemedText>
        </View>
      ) : (
        <View className="gap-two">
          {announcements.map((a) => {
            const style = getAnnouncementType(a.type);
            const hint = getAnnouncementTimeHint(a);
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  haptics.tap();
                  onOpen(a);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${style.label}: ${a.title}`}
                className="flex-row items-center gap-three overflow-hidden rounded-two bg-surface p-three active:opacity-70"
              >
                <View className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: style.color }} />
                <View className="h-8 w-8 items-center justify-center rounded-two" style={{ backgroundColor: `${style.color}1A` }}>
                  <Ionicons name={style.icon} size={16} color={style.color} />
                </View>
                <View className="flex-1">
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {a.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={1}>
                    {style.label}
                    {hint ? ` · ${hint}` : ""}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#8A94A6" />
              </Pressable>
            );
          })}
        </View>
      )}
      <OutlineButton label="Ver quadro de avisos" onPress={() => onOpen()} />
    </SectionCard>
  );
}

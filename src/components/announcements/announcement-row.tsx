import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { StatusPill } from "@/components/ui/status-pill";
import type { Announcement } from "@/interfaces/announcement.interface";
import {
  ANNOUNCEMENT_STATUS,
  getAnnouncementStatus,
  getAnnouncementType,
  timeAgo,
} from "@/utils/announcements";
import { haptics } from "@/utils/haptics";

/** Linha do quadro de avisos: ícone do tipo, título, prévia e situação. */
export function AnnouncementRow({ announcement, onPress }: { announcement: Announcement; onPress: () => void }) {
  const style = getAnnouncementType(announcement.type);
  const status = getAnnouncementStatus(announcement);

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${style.label}: ${announcement.title}`}
      className={`flex-row gap-three overflow-hidden rounded-three border border-line bg-paper p-three active:bg-surface ${
        status === "expired" ? "opacity-60" : ""
      }`}
    >
      <View className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: style.color }} />
      <View className="h-10 w-10 items-center justify-center rounded-two" style={{ backgroundColor: `${style.color}1A` }}>
        <Ionicons name={style.icon} size={20} color={style.color} />
      </View>
      <View className="flex-1 gap-half">
        <View className="flex-row items-center gap-two">
          <ThemedText type="smallBold" className="flex-1" numberOfLines={1}>
            {announcement.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            {timeAgo(announcement.created_at)}
          </ThemedText>
        </View>
        {announcement.content ? (
          <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={2}>
            {announcement.content}
          </ThemedText>
        ) : null}
        <View className="mt-one flex-row items-center gap-two">
          <StatusPill label={ANNOUNCEMENT_STATUS[status].label} tone={ANNOUNCEMENT_STATUS[status].tone} dot />
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            {style.label}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

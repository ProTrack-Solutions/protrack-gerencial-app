import { Ionicons } from "@expo/vector-icons";
import { Pressable, Share, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { StatusPill } from "@/components/ui/status-pill";
import type { Announcement } from "@/interfaces/announcement.interface";
import {
  ANNOUNCEMENT_STATUS,
  getAnnouncementStatus,
  getAnnouncementTimeHint,
  getAnnouncementType,
  parseAnnouncementDate,
  timeAgo,
} from "@/utils/announcements";
import { formatDateTime } from "@/utils/dates";
import { haptics } from "@/utils/haptics";

function InfoBox({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-1 gap-half rounded-two bg-surface p-two">
      <View className="flex-row items-center gap-one">
        <Ionicons name={icon} size={12} color="#566176" />
        <ThemedText type="small" themeColor="textSecondary" className="text-xs">
          {label}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" className="text-xs">
        {value}
      </ThemedText>
    </View>
  );
}

type Props = {
  announcement: Announcement;
  onClose: () => void;
  /** Só para ADMIN. */
  onDelete?: (announcement: Announcement) => void;
};

/** Aviso completo: mensagem, período e situação; o admin pode remover. */
export function AnnouncementDetailSheet({ announcement, onClose, onDelete }: Props) {
  const style = getAnnouncementType(announcement.type);
  const status = ANNOUNCEMENT_STATUS[getAnnouncementStatus(announcement)];
  const starts = parseAnnouncementDate(announcement.starts_at);
  const expires = parseAnnouncementDate(announcement.expires_at);

  const share = () => {
    haptics.tap();
    Share.share({ title: announcement.title, message: `${announcement.title}\n\n${announcement.content}` });
  };

  return (
    <FormSheet
      visible
      title={announcement.title}
      subtitle={`${style.label} · publicado ${timeAgo(announcement.created_at)}`}
      icon={style.icon}
      colors={[style.color, style.color]}
      onClose={onClose}
    >
      <View className="flex-row flex-wrap items-center gap-two">
        <StatusPill label={status.label} tone={status.tone} dot />
        <View className="flex-1" />
        <Pressable onPress={share} hitSlop={8} accessibilityRole="button" accessibilityLabel="Compartilhar aviso" className="flex-row items-center gap-one active:opacity-70">
          <Ionicons name="share-social-outline" size={16} color="#566176" />
          <ThemedText type="smallBold" themeColor="textSecondary" className="text-xs">
            Compartilhar
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText className="text-base leading-6">
        {announcement.content || "Este aviso não tem mensagem."}
      </ThemedText>

      <View className="flex-row gap-two">
        <InfoBox icon="calendar-outline" label="Início" value={starts ? formatDateTime(starts.toISOString()) : "Imediato"} />
        <InfoBox icon="calendar-clear-outline" label="Fim" value={expires ? formatDateTime(expires.toISOString()) : "Sem data de fim"} />
      </View>
      <InfoBox icon="time-outline" label="Situação" value={getAnnouncementTimeHint(announcement) ?? "Encerrado"} />

      {onDelete && (
        <Pressable
          onPress={() => onDelete(announcement)}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-two rounded-two border border-rose-300 bg-rose-50 py-three active:opacity-70"
        >
          <Ionicons name="trash-outline" size={16} color="#BE123C" />
          <ThemedText type="smallBold" className="text-rose-700">
            Remover aviso
          </ThemedText>
        </Pressable>
      )}
    </FormSheet>
  );
}

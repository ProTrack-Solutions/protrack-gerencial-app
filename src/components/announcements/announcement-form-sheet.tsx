import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { ThemedText } from "@/components/themed-text";
import { DateField } from "@/components/ui/date-field";
import { FormSheet } from "@/components/ui/form-sheet";
import type { AnnouncementType } from "@/interfaces/announcement.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { CreateAnnouncement } from "@/service/announcement.service";
import { ANNOUNCEMENT_TYPES } from "@/utils/announcements";
import { fromIsoDate, isoDaysFromToday, toIsoDate } from "@/utils/dates";
import { haptics } from "@/utils/haptics";

const TITLE_MAX = 150;

/** Prazos rápidos para o fim; null = sem data de fim. */
const DURATIONS: { label: string; days: number | null }[] = [
  { label: "1 dia", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Sem fim", days: null },
];

const addDays = (iso: string, days: number) => {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

/** Começa agora quando é hoje; em outro dia, à meia-noite daquele dia. */
function startDate(iso: string) {
  return iso === toIsoDate(new Date()) ? new Date() : fromIsoDate(iso);
}

type Errors = { title?: string; content?: string; end?: string };

export function AnnouncementFormSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<AnnouncementType>("info");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [start, setStart] = useState(() => isoDaysFromToday(0));
  const [end, setEnd] = useState(() => isoDaysFromToday(7));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setType("info");
    setTitle("");
    setContent("");
    setStart(isoDaysFromToday(0));
    setEnd(isoDaysFromToday(7));
    setErrors({});
  }, [visible]);

  const selectedDuration = DURATIONS.find((d) => (d.days === null ? !end : end === addDays(start, d.days)));

  const save = async () => {
    const next: Errors = {};
    if (!title.trim()) next.title = "Informe o título do aviso.";
    if (!content.trim()) next.content = "Escreva a mensagem do aviso.";
    const startsAt = startDate(start);
    let expiresAt: Date | undefined;
    if (end) {
      // O fim mantém o horário do início: "7 dias" a partir de agora termina daqui a 7 dias, nesta hora.
      expiresAt = fromIsoDate(end);
      expiresAt.setHours(startsAt.getHours(), startsAt.getMinutes(), 0, 0);
      if (expiresAt <= startsAt) next.end = "O fim precisa ser depois do início.";
    }
    setErrors(next);
    if (Object.keys(next).length) return haptics.warning();

    setSaving(true);
    try {
      await CreateAnnouncement({
        title: title.trim(),
        content: content.trim(),
        type,
        starts_at: startsAt.toISOString(),
        ...(expiresAt && { expires_at: expiresAt.toISOString() }),
      });
      haptics.success();
      onCreated();
      onClose();
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao publicar", getApiErrorMessage(e, "Não foi possível publicar o aviso."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Novo aviso"
      subtitle="Aparece no dashboard de toda a empresa enquanto estiver no ar."
      icon="megaphone-outline"
      onClose={onClose}
      submit={{ label: saving ? "Publicando..." : "Publicar aviso", icon: "send-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Tipo do aviso" required />
        <View className="flex-row flex-wrap gap-two">
          {(Object.keys(ANNOUNCEMENT_TYPES) as AnnouncementType[]).map((key) => {
            const t = ANNOUNCEMENT_TYPES[key];
            const active = key === type;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  haptics.select();
                  setType(key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`min-w-[46%] flex-1 flex-row items-center gap-two rounded-two border-2 p-two ${
                  active ? "border-brand bg-brand-soft" : "border-line bg-paper"
                }`}
              >
                <View className="h-8 w-8 items-center justify-center rounded-two" style={{ backgroundColor: `${t.color}1A` }}>
                  <Ionicons name={t.icon} size={16} color={t.color} />
                </View>
                <ThemedText type="smallBold" className={active ? "text-ink" : "text-muted"}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-two">
        <View className="flex-row items-center justify-between">
          <FormLabel label="Título" required />
          <ThemedText type="small" themeColor="textSecondary" className="text-xs">
            {title.length}/{TITLE_MAX}
          </ThemedText>
        </View>
        <FormInput value={title} onChangeText={setTitle} maxLength={TITLE_MAX} placeholder="Ex.: Inventário no sábado" error={errors.title} />
        <FieldError message={errors.title} />
      </View>

      <View className="gap-two">
        <FormLabel label="Mensagem" required />
        <FormInput value={content} onChangeText={setContent} placeholder="Explique o que a equipe precisa saber..." multiline error={errors.content} />
        <FieldError message={errors.content} />
      </View>

      <View className="gap-two">
        <FormLabel label="Começa em" required />
        <DateField
          value={start}
          minimumDate={new Date()}
          onChange={(value) => {
            // Mantém o prazo escolhido ao mudar o início.
            if (selectedDuration?.days) setEnd(addDays(value, selectedDuration.days));
            setStart(value);
          }}
        />
      </View>

      <View className="gap-two">
        <FormLabel label="Termina em" />
        <View className="flex-row flex-wrap gap-two">
          {DURATIONS.map((d) => {
            const active = selectedDuration === d;
            return (
              <Pressable
                key={d.label}
                onPress={() => {
                  haptics.select();
                  setEnd(d.days === null ? "" : addDays(start, d.days));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`rounded-full border px-three py-one ${active ? "border-brand bg-brand" : "border-line bg-paper"}`}
              >
                <ThemedText type="smallBold" className={`text-xs ${active ? "text-white" : "text-muted"}`}>
                  {d.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <DateField value={end} onChange={setEnd} placeholder="Sem data de fim" minimumDate={fromIsoDate(start)} clearable error={errors.end} />
        <FieldError message={errors.end} />
      </View>
    </FormSheet>
  );
}

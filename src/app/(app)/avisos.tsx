import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnnouncementDetailSheet } from "@/components/announcements/announcement-detail-sheet";
import { AnnouncementFormSheet } from "@/components/announcements/announcement-form-sheet";
import { AnnouncementRow } from "@/components/announcements/announcement-row";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { RowListSkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import type { Announcement } from "@/interfaces/announcement.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { DeleteAnnouncement, ListAnnouncements } from "@/service/announcement.service";
import { haptics } from "@/utils/haptics";

const PER_PAGE = 15;

/** Lê o aviso tocado no dashboard (vem serializado nos parâmetros da rota). */
function parseInitial(raw?: string): Announcement | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Announcement;
  } catch {
    return null;
  }
}

/** Quadro de avisos: todos os comunicados da empresa; o ADMIN publica e remove. */
export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const params = useLocalSearchParams<{ aviso?: string }>();
  const [selected, setSelected] = useState<Announcement | null>(() => parseInitial(params.aviso));
  const [creating, setCreating] = useState(false);

  const list = usePaginatedList(
    (page, signal) => ListAnnouncements(page, PER_PAGE, signal),
    [],
    "Não foi possível carregar os avisos.",
  );

  const remove = (a: Announcement) => {
    haptics.warning();
    Alert.alert("Remover aviso?", `"${a.title}" deixará de aparecer para toda a empresa.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await DeleteAnnouncement(a.id);
            haptics.success();
            setSelected(null);
            list.setItems((items) => items.filter((it) => it.id !== a.id));
            list.reload();
          } catch (e) {
            haptics.error();
            Alert.alert("Não foi possível remover", getApiErrorMessage(e, "Tente novamente."));
          }
        },
      },
    ]);
  };

  const subtitle =
    list.total && list.total > 0
      ? `${list.total} ${list.total === 1 ? "aviso" : "avisos"} da empresa.`
      : "Comunicados da empresa para a equipe.";

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Quadro de avisos" subtitle={subtitle} leading={{ type: "back", onPress: router.back }} />

      <FlatList
        data={list.loading ? [] : list.items}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AnnouncementRow announcement={item} onPress={() => setSelected(item)} />}
        contentContainerClassName="w-full max-w-content self-center gap-two p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={BrandColor} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          list.loading ? (
            <RowListSkeleton count={6} />
          ) : list.error ? (
            <EmptyState icon="megaphone-outline" message={list.error} error onRetry={list.refresh} />
          ) : (
            <EmptyState
              icon="megaphone-outline"
              message={
                admin
                  ? "Nenhum aviso por aqui. Use os avisos para comunicar manutenções, metas e novidades para a equipe."
                  : "Nenhum aviso por aqui. Quando a administração publicar um comunicado, ele aparece aqui."
              }
            />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator color={BrandColor} className="py-three" /> : null}
      />

      {admin && (
        <Pressable
          onPress={() => {
            haptics.tap();
            setCreating(true);
          }}
          accessibilityRole="button"
          className="absolute right-four flex-row items-center gap-two rounded-full bg-brand px-four py-three active:opacity-85"
          style={{
            bottom: insets.bottom + 24,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <ThemedText type="smallBold" className="text-white">
            Novo aviso
          </ThemedText>
        </Pressable>
      )}

      {selected && (
        <AnnouncementDetailSheet
          announcement={selected}
          onClose={() => setSelected(null)}
          onDelete={admin ? remove : undefined}
        />
      )}
      <AnnouncementFormSheet visible={creating} onClose={() => setCreating(false)} onCreated={list.reload} />
    </View>
  );
}

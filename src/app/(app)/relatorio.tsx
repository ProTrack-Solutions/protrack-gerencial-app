import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  compareCells,
  findReport,
  formatCell,
  formatValue,
  isNumericColumn,
  MAX_PERIOD_DAYS,
  PERIOD_PRESETS,
  presetRange,
  type PeriodPreset,
} from "@/components/reports/catalog";
import { BottomSheet } from "@/components/sale/bottom-sheet";
import { SearchInput } from "@/components/sale/search-input";
import { ThemedText } from "@/components/themed-text";
import { DateField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { CardListSkeleton, SummarySkeleton } from "@/components/ui/list-skeletons";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BrandColor, Gradients } from "@/constants/theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResource } from "@/hooks/use-resource";
import type { ReportCell, ReportColumn, ReportResponse, ReportSummaryItem } from "@/interfaces/reports.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { GetReport, ShareReportFile } from "@/service/reports.service";
import { formatIsoDate } from "@/utils/dates";
import { formatNumber } from "@/utils/format";
import { haptics } from "@/utils/haptics";

/** Linhas visíveis no card antes de expandir. */
const COLLAPSED_FIELDS = 3;

function SummaryCards({ items }: { items: ReportSummaryItem[] }) {
  if (!items.length) return null;
  const [first, ...rest] = items;
  return (
    <View className="gap-two">
      <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="gap-half rounded-four p-four">
        <ThemedText type="small" className="text-white/85">
          {first.label}
        </ThemedText>
        <ThemedText className="text-[28px] font-bold leading-9 text-white" numberOfLines={1} adjustsFontSizeToFit>
          {formatValue(first.value, first.type)}
        </ThemedText>
      </LinearGradient>
      {rest.length > 0 && (
        <View className="flex-row flex-wrap gap-two">
          {rest.map((item) => (
            <View key={item.label} className="grow basis-[45%] gap-half rounded-three bg-paper p-three">
              <ThemedText type="small" themeColor="textSecondary" className="text-xs" numberOfLines={1}>
                {item.label}
              </ThemedText>
              <ThemedText
                className={`font-bold ${item.type === "money" && item.value < 0 ? "text-danger" : ""}`}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatValue(item.value, item.type)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Linha da tabela como card: a primeira coluna vira título, as demais pares rótulo/valor. */
function RowCard({ row, columns }: { row: ReportCell[]; columns: ReportColumn[] }) {
  const [expanded, setExpanded] = useState(false);
  const titleIndex = Math.max(
    columns.findIndex((c) => c.type === "text"),
    0,
  );
  const fields = columns.map((c, i) => ({ column: c, value: row[i], index: i })).filter((f) => f.index !== titleIndex && f.value !== null && f.value !== "");
  const visible = expanded ? fields : fields.slice(0, COLLAPSED_FIELDS);
  const canExpand = fields.length > COLLAPSED_FIELDS;

  return (
    <Pressable
      onPress={() => {
        if (!canExpand) return;
        haptics.select();
        setExpanded((v) => !v);
      }}
      disabled={!canExpand}
      className="gap-two rounded-three border border-line bg-paper p-three active:bg-surface"
    >
      <View className="flex-row items-start gap-two">
        <ThemedText type="smallBold" className="flex-1" numberOfLines={expanded ? undefined : 2}>
          {formatCell(row[titleIndex], columns[titleIndex].type) || "—"}
        </ThemedText>
        {canExpand && <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#8B8D98" />}
      </View>
      <View className="flex-row flex-wrap gap-y-two">
        {visible.map(({ column, value }) => (
          <View key={column.key} className="w-1/2 gap-half pr-two">
            <ThemedText type="small" themeColor="textSecondary" className="text-[11px]" numberOfLines={1}>
              {column.label}
            </ThemedText>
            <ThemedText
              type="small"
              className={`${isNumericColumn(column.type) ? "font-bold" : ""} ${typeof value === "number" && value < 0 && column.type === "money" ? "text-danger" : ""}`}
              numberOfLines={expanded ? undefined : 1}
            >
              {formatCell(value, column.type)}
            </ThemedText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function SortSheet({
  visible,
  columns,
  sort,
  onChange,
  onClose,
}: {
  visible: boolean;
  columns: ReportColumn[];
  sort: { index: number; desc: boolean } | null;
  onChange: (sort: { index: number; desc: boolean } | null) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="Ordenar por" onClose={onClose}>
      <ScrollView contentContainerClassName="gap-two pb-three">
        <Pressable
          onPress={() => {
            haptics.select();
            onChange(null);
            onClose();
          }}
          className={`rounded-two border p-three ${sort === null ? "border-brand bg-brand-soft" : "border-line"}`}
        >
          <ThemedText type="smallBold" className={sort === null ? "text-brand" : ""}>
            Ordem do relatório
          </ThemedText>
        </Pressable>
        {columns.map((c, index) =>
          [true, false].map((desc) => {
            const selected = sort?.index === index && sort.desc === desc;
            const numeric = isNumericColumn(c.type);
            return (
              <Pressable
                key={`${c.key}-${desc}`}
                onPress={() => {
                  haptics.select();
                  onChange({ index, desc });
                  onClose();
                }}
                className={`flex-row items-center gap-two rounded-two border p-three ${selected ? "border-brand bg-brand-soft" : "border-line"}`}
              >
                <Ionicons name={desc ? "arrow-down" : "arrow-up"} size={16} color={selected ? BrandColor : "#60646C"} />
                <ThemedText type="smallBold" className={`flex-1 ${selected ? "text-brand" : ""}`}>
                  {c.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" className="text-xs">
                  {numeric ? (desc ? "maior primeiro" : "menor primeiro") : desc ? "Z → A" : "A → Z"}
                </ThemedText>
              </Pressable>
            );
          }),
        )}
      </ScrollView>
    </BottomSheet>
  );
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type: string }>();
  const report = findReport(type);
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [custom, setCustom] = useState(() => presetRange("this_month"));
  const range = preset === "custom" ? custom : presetRange(preset);
  const days = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000 + 1;
  const rangeError =
    !range.start || !range.end
      ? "Escolha o início e o fim."
      : days < 1
        ? "O início precisa ser antes do fim."
        : days > MAX_PERIOD_DAYS
          ? "O período máximo é de 2 anos."
          : null;

  const [searchText, setSearchText] = useState("");
  const search = useDebouncedValue(searchText.trim().toLowerCase(), 250);
  const [sort, setSort] = useState<{ index: number; desc: boolean } | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const { data, loading, refreshing, error, refresh } = useResource<ReportResponse>(
    (signal) => GetReport({ type: report.type, start_date: range.start, end_date: range.end }, signal),
    [report.type, range.start, range.end],
    { errorMessage: "Não foi possível gerar o relatório.", enabled: !rangeError },
  );

  const rows = useMemo(() => {
    if (!data) return [];
    let list = data.rows;
    if (search) list = list.filter((row) => row.some((cell) => cell !== null && String(cell).toLowerCase().includes(search)));
    if (sort) {
      list = [...list].sort((a, b) => {
        const result = compareCells(a[sort.index], b[sort.index]);
        return sort.desc ? -result : result;
      });
    }
    return list.map((row, i) => ({ id: String(i), row }));
  }, [data, search, sort]);

  const share = async (format: "pdf" | "xlsx") => {
    if (rangeError) return;
    haptics.tap();
    setExporting(format);
    try {
      const period = report.usesPeriod ? ` ${formatIsoDate(range.start).replace(/\//g, "-")} a ${formatIsoDate(range.end).replace(/\//g, "-")}` : "";
      await ShareReportFile({ type: report.type, start_date: range.start, end_date: range.end }, format, `${report.title}${period}`);
    } catch (e) {
      haptics.error();
      Alert.alert("Não foi possível gerar o arquivo", getApiErrorMessage(e, "Tente novamente em instantes."));
    } finally {
      setExporting(null);
    }
  };

  const columns = data?.columns ?? [];
  const totals = data?.totals;

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title={report.title}
        subtitle={report.usesPeriod ? `${formatIsoDate(range.start)} a ${formatIsoDate(range.end)}` : "Posição atual"}
        leading={{ type: "back", onPress: router.back }}
        right={
          <View className="flex-row gap-two">
            {(["pdf", "xlsx"] as const).map((format) => (
              <Pressable
                key={format}
                onPress={() => share(format)}
                disabled={exporting !== null || loading}
                accessibilityRole="button"
                accessibilityLabel={format === "pdf" ? "Compartilhar PDF" : "Compartilhar Excel"}
                className="h-10 min-w-10 items-center justify-center rounded-two bg-white/[0.18] px-two active:opacity-70"
              >
                {exporting === format ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <ThemedText type="smallBold" className="text-xs text-white">
                    {format === "pdf" ? "PDF" : "XLS"}
                  </ThemedText>
                )}
              </Pressable>
            ))}
          </View>
        }
      />

      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(r) => r.id}
        initialNumToRender={15}
        contentContainerClassName="w-full max-w-content self-center gap-two p-three"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BrandColor} />}
        ListHeaderComponent={
          <View className="mb-one gap-three">
            {report.usesPeriod && (
              <View className="gap-two">
                <FilterChips options={PERIOD_PRESETS} value={preset} onChange={setPreset} />
                {preset === "custom" && (
                  <View className="flex-row gap-two">
                    <View className="flex-1">
                      <DateField value={custom.start} onChange={(start) => setCustom((c) => ({ ...c, start }))} maximumDate={new Date()} placeholder="De" />
                    </View>
                    <View className="flex-1">
                      <DateField value={custom.end} onChange={(end) => setCustom((c) => ({ ...c, end }))} maximumDate={new Date()} placeholder="Até" />
                    </View>
                  </View>
                )}
                {rangeError && (
                  <ThemedText type="small" className="text-xs text-danger">
                    {rangeError}
                  </ThemedText>
                )}
              </View>
            )}

            {loading && !rangeError ? <SummarySkeleton /> : data ? <SummaryCards items={data.summary ?? []} /> : null}

            {data && data.rows.length > 0 && (
              <View className="flex-row items-center gap-two">
                <View className="flex-1">
                  <SearchInput placeholder="Filtrar linhas" value={searchText} onChangeText={setSearchText} />
                </View>
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    setSortOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Ordenar"
                  className={`h-11 w-11 items-center justify-center rounded-two border ${sort ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}
                >
                  <Ionicons name="swap-vertical" size={20} color={sort ? BrandColor : "#000000"} />
                </Pressable>
              </View>
            )}

            {data && (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {formatNumber(rows.length)} {rows.length === 1 ? "linha" : "linhas"}
                {search ? ` de ${formatNumber(data.rows.length)}` : ""}
              </ThemedText>
            )}
          </View>
        }
        ListEmptyComponent={
          rangeError ? null : loading ? (
            <CardListSkeleton values={2} />
          ) : (
            <EmptyState
              icon="document-text-outline"
              message={error ?? (search ? "Nenhuma linha com esse filtro." : "Sem dados para o período.")}
              error={Boolean(error)}
              onRetry={error ? refresh : undefined}
            />
          )
        }
        renderItem={({ item }) => <RowCard row={item.row} columns={columns} />}
        ListFooterComponent={
          data && !loading ? (
            <View className="mt-two gap-two">
              {totals && totals.some((t) => t !== null) && !search && (
                <View className="gap-two rounded-three border border-brand-line bg-brand-soft p-three">
                  <ThemedText type="smallBold" className="text-brand">
                    Totais
                  </ThemedText>
                  <View className="flex-row flex-wrap gap-y-two">
                    {columns.map((c, i) =>
                      typeof totals[i] === "number" ? (
                        <View key={c.key} className="w-1/2 gap-half pr-two">
                          <ThemedText type="small" themeColor="textSecondary" className="text-[11px]" numberOfLines={1}>
                            {c.label}
                          </ThemedText>
                          <ThemedText type="smallBold">{formatCell(totals[i], c.type)}</ThemedText>
                        </View>
                      ) : null,
                    )}
                  </View>
                </View>
              )}
              {data.notes?.map((note) => (
                <ThemedText key={note} type="small" themeColor="textSecondary" className="text-xs">
                  • {note}
                </ThemedText>
              ))}
            </View>
          ) : null
        }
      />

      <SortSheet visible={sortOpen} columns={columns} sort={sort} onChange={setSort} onClose={() => setSortOpen(false)} />
    </View>
  );
}

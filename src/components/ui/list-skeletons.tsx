import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";

/** Card de lista genérico: título, linha secundária, etiqueta e três valores. */
function CardSkeleton({ values = 3 }: { values?: number }) {
  return (
    <View className="gap-three rounded-three border border-line bg-paper p-three">
      <View className="flex-row items-start justify-between gap-two">
        <View className="flex-1 gap-two">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-40" />
        </View>
        <Skeleton className="h-5 w-16 rounded-full" />
      </View>
      {values > 0 && (
        <View className="flex-row gap-two">
          {Array.from({ length: values }, (_, i) => (
            <View key={i} className="flex-1 gap-two">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-4 w-20" />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function CardListSkeleton({ count = 5, values = 3 }: { count?: number; values?: number }) {
  return (
    <View className="gap-two">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} values={values} />
      ))}
    </View>
  );
}

/** Mesmo formato dos cards de resumo em gradiente. */
export function SummarySkeleton() {
  return (
    <View className="gap-three rounded-four border border-line bg-paper p-four">
      <View className="flex-row items-start justify-between">
        <View className="gap-two">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-36" />
        </View>
        <Skeleton className="h-10 w-10" />
      </View>
      <View className="flex-row gap-two">
        <Skeleton className="h-14 flex-1 rounded-three" />
        <Skeleton className="h-14 flex-1 rounded-three" />
      </View>
    </View>
  );
}

/** Linhas simples de lista (cadastros: nome + descrição). */
export function RowListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View className="gap-two">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="flex-row items-center gap-three rounded-three border border-line bg-paper p-three">
          <Skeleton className="h-10 w-10" />
          <View className="flex-1 gap-two">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </View>
        </View>
      ))}
    </View>
  );
}

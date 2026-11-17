import { View } from "react-native";

import { SummarySkeleton } from "@/components/ui/list-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Mesmo formato do turno aberto: resumo, ações e um card de detalhes. */
export function CashRegisterSkeleton() {
  return (
    <View className="gap-three">
      <SummarySkeleton />
      <View className="gap-three rounded-three bg-paper p-three">
        <Skeleton className="h-4 w-32" />
        <View className="flex-row justify-between">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-1 items-center gap-two">
              <Skeleton className="h-14 w-14 rounded-three" />
              <Skeleton className="h-3 w-12" />
            </View>
          ))}
        </View>
        <Skeleton className="h-11 w-full" />
      </View>
      <View className="gap-two rounded-three bg-paper p-three">
        <Skeleton className="h-4 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="flex-row justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
          </View>
        ))}
      </View>
    </View>
  );
}

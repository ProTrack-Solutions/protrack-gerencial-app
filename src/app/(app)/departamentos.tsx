import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { RecordListScreen } from "@/components/settings/record-list-screen";
import { RecordRow } from "@/components/settings/record-row";
import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { useAuth } from "@/contexts/auth-context";
import { useRecordList } from "@/hooks/use-record-list";
import { useResource } from "@/hooks/use-resource";
import type { DepartmentRecord, ModuleRecord } from "@/interfaces/settings.interface";
import { getApiErrorMessage } from "@/service/api.service";
import {
  CreateDepartment,
  DeleteDepartment,
  ListDepartments,
  ListModules,
  SetDepartmentStatus,
  UpdateDepartment,
} from "@/service/settings.service";
import { haptics } from "@/utils/haptics";

const MODULE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  financial: "wallet-outline",
  sales: "cart-outline",
  customers: "people-outline",
  inventory: "cube-outline",
  purchases: "bag-handle-outline",
  reports: "bar-chart-outline",
  whatsapp: "logo-whatsapp",
};

function DepartmentSheet({
  department,
  visible,
  onClose,
  onSaved,
}: {
  department: DepartmentRecord | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const modules = useResource((signal) => ListModules(signal), [], { errorMessage: "Não foi possível carregar os módulos.", enabled: visible });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(department?.name ?? "");
    setDescription(department?.description ?? "");
    setSelected((department?.modules ?? []).map((m) => m.code));
    setError(undefined);
  }, [visible, department]);

  const toggleModule = (code: string) => {
    haptics.select();
    setSelected((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]));
  };

  const save = async () => {
    if (name.trim().length < 2) {
      setError("Informe o nome do departamento.");
      return haptics.warning();
    }
    const chosen: ModuleRecord[] = (modules.data ?? []).filter((m) => selected.includes(m.code));
    setSaving(true);
    try {
      const params = { name: name.trim(), description: description.trim(), modules: chosen };
      if (department) await UpdateDepartment(department.id, params);
      else await CreateDepartment(params);
      haptics.success();
      onSaved();
      onClose();
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(e, "Não foi possível salvar o departamento."));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!department) return;
    haptics.warning();
    Alert.alert("Excluir departamento?", `Os usuários de "${department.name}" ficam sem módulos liberados.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await DeleteDepartment(department.id);
            haptics.success();
            onSaved();
            onClose();
          } catch (e) {
            haptics.error();
            Alert.alert("Não foi possível excluir", getApiErrorMessage(e, "Tente desativar o departamento."));
          }
        },
      },
    ]);
  };

  return (
    <FormSheet
      visible={visible}
      title={department ? "Editar departamento" : "Novo departamento"}
      subtitle="Os módulos definem o que os usuários do departamento acessam."
      icon="git-branch-outline"
      onClose={onClose}
      submit={{ label: saving ? "Salvando..." : "Salvar", icon: "checkmark-circle-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Nome" required />
        <FormInput value={name} onChangeText={setName} placeholder="Ex.: Vendas" error={error} />
        <FieldError message={error} />
      </View>
      <View className="gap-two">
        <FormLabel label="Descrição" />
        <FormInput value={description} onChangeText={setDescription} placeholder="Opcional" multiline maxLength={300} />
      </View>
      <View className="gap-two">
        <FormLabel label="Módulos liberados" />
        {modules.loading ? (
          <ActivityIndicator />
        ) : modules.error ? (
          <FieldError message={modules.error} />
        ) : (
          (modules.data ?? []).map((m) => {
            const on = selected.includes(m.code);
            return (
              <Pressable
                key={m.code}
                onPress={() => toggleModule(m.code)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className={`flex-row items-center gap-three rounded-two border p-three active:opacity-70 ${on ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}
              >
                <Ionicons name={MODULE_ICONS[m.code] ?? "apps-outline"} size={18} color={on ? "#3c87f7" : "#60646C"} />
                <ThemedText type="smallBold" className={`flex-1 ${on ? "text-brand" : ""}`}>
                  {m.name}
                </ThemedText>
                <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? "#3c87f7" : "#8B8D98"} />
              </Pressable>
            );
          })
        )}
      </View>
      {department && (
        <Pressable onPress={remove} accessibilityRole="button" className="items-center py-two active:opacity-60">
          <ThemedText type="smallBold" className="text-danger">
            Excluir departamento
          </ThemedText>
        </Pressable>
      )}
    </FormSheet>
  );
}

export default function DepartmentsScreen() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const list = useRecordList(ListDepartments, {
    errorMessage: "Não foi possível carregar os departamentos.",
    searchText: (d) => `${d.name} ${d.description}`,
  });
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <RecordListScreen
      title="Departamentos"
      subtitle={admin ? "Equipes e o que cada uma acessa." : "Só o administrador pode alterar."}
      searchPlaceholder="Buscar departamento"
      emptyIcon="git-branch-outline"
      emptyMessage="Nenhum departamento cadastrado."
      noun={["departamento", "departamentos"]}
      list={list}
      keyExtractor={(d) => d.id}
      addLabel="Novo departamento"
      onAdd={
        admin
          ? () => {
              setEditing(null);
              setOpen(true);
            }
          : undefined
      }
      renderItem={(d) => (
        <RecordRow
          title={d.name}
          subtitle={d.description || undefined}
          icon="git-branch-outline"
          active={d.status === "ACTIVE"}
          toggling={list.togglingId === d.id}
          onPress={
            admin
              ? () => {
                  setEditing(d);
                  setOpen(true);
                }
              : undefined
          }
          onToggle={
            admin ? (value) => list.toggle(d, { status: value ? "ACTIVE" : "INACTIVE" }, () => SetDepartmentStatus(d.id, value ? "ACTIVE" : "INACTIVE")) : undefined
          }
        >
          {(d.modules?.length ?? 0) > 0 && (
            <View className="flex-row flex-wrap gap-one">
              {d.modules?.map((m) => (
                <View key={m.code} className="flex-row items-center gap-one rounded-full bg-surface px-two py-half">
                  <Ionicons name={MODULE_ICONS[m.code] ?? "apps-outline"} size={12} color="#60646C" />
                  <ThemedText type="small" className="text-[11px]">
                    {m.name}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </RecordRow>
      )}
    >
      {admin && <DepartmentSheet department={editing} visible={open} onClose={() => setOpen(false)} onSaved={list.reload} />}
    </RecordListScreen>
  );
}

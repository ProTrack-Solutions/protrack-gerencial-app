import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { FieldError, FormInput, FormLabel } from "@/components/product/form-field";
import { OptionChips } from "@/components/product/option-chips";
import { RecordListScreen } from "@/components/settings/record-list-screen";
import { RecordRow } from "@/components/settings/record-row";
import { ThemedText } from "@/components/themed-text";
import { FormSheet } from "@/components/ui/form-sheet";
import { useAuth } from "@/contexts/auth-context";
import { useRecordList } from "@/hooks/use-record-list";
import { useResource } from "@/hooks/use-resource";
import type { CompanyUser } from "@/interfaces/settings.interface";
import { getApiErrorMessage } from "@/service/api.service";
import { CreateCompanyUser, ListCompanyUsers, ListDepartments, SetUserStatus, UpdateCompanyUser } from "@/service/settings.service";
import { formatDateTime } from "@/utils/dates";
import { haptics } from "@/utils/haptics";
import { isValidEmail } from "@/utils/masks";

const ROLES = [
  { value: "USER", label: "Colaborador" },
  { value: "ADMIN", label: "Administrador" },
] as const;

const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

type Errors = Partial<Record<"name" | "email" | "username" | "password" | "department", string>>;

function UserSheet({ target, visible, onClose, onSaved }: { target: CompanyUser | null; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const departments = useResource((signal) => ListDepartments(signal), [], { errorMessage: "", enabled: visible });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<string>("USER");
  const [departmentId, setDepartmentId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(target?.name ?? "");
    setEmail(target?.email ?? "");
    setUsername(target?.username ?? "");
    setPassword("");
    setRole(target?.role ?? "USER");
    setDepartmentId(target?.department_id ?? "");
    setErrors({});
  }, [visible, target]);

  // E-mail digitado sugere o usuário (parte antes do @).
  const onEmail = (value: string) => {
    setEmail(value);
    if (!target && (!username || email.split("@")[0] === username)) setUsername(value.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, ""));
  };

  const save = async () => {
    const next: Errors = {};
    if (name.trim().length < 3) next.name = "Informe o nome completo.";
    if (!isValidEmail(email.trim())) next.email = "E-mail inválido.";
    if (username.trim().length < 3) next.username = "Mínimo de 3 caracteres.";
    if (!target && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)))
      next.password = "Mínimo 8 caracteres, com letra, número e caractere especial.";
    if (!departmentId && role !== "ADMIN") next.department = "Escolha o departamento.";
    setErrors(next);
    if (Object.keys(next).length > 0) return haptics.warning();

    setSaving(true);
    try {
      if (target) {
        await UpdateCompanyUser(target.id, { name: name.trim(), email: email.trim().toLowerCase(), username: username.trim(), role, department_id: departmentId });
      } else {
        await CreateCompanyUser({ name: name.trim(), email: email.trim().toLowerCase(), username: username.trim(), password, department_id: departmentId });
      }
      haptics.success();
      onSaved();
      onClose();
      if (!target) Alert.alert("Usuário criado", `Passe o e-mail ${email.trim().toLowerCase()} e a senha para ${name.trim().split(" ")[0]} entrar.`);
    } catch (e) {
      haptics.error();
      Alert.alert("Erro ao salvar", getApiErrorMessage(e, "Não foi possível salvar o usuário."));
    } finally {
      setSaving(false);
    }
  };

  const activeDepartments = (departments.data ?? []).filter((d) => d.status === "ACTIVE" || d.id === departmentId);

  return (
    <FormSheet
      visible={visible}
      title={target ? "Editar usuário" : "Novo usuário"}
      subtitle="O departamento define os módulos que a pessoa acessa."
      icon="person-add-outline"
      onClose={onClose}
      submit={{ label: saving ? "Salvando..." : "Salvar", icon: "checkmark-circle-outline", onPress: save, loading: saving }}
    >
      <View className="gap-two">
        <FormLabel label="Nome completo" required />
        <FormInput value={name} onChangeText={setName} autoCapitalize="words" error={errors.name} />
        <FieldError message={errors.name} />
      </View>
      <View className="gap-two">
        <FormLabel label="E-mail" required />
        <FormInput value={email} onChangeText={onEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <FieldError message={errors.email} />
      </View>
      <View className="gap-two">
        <FormLabel label="Usuário" required />
        <FormInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} error={errors.username} />
        <FieldError message={errors.username} />
      </View>
      {!target && (
        <View className="gap-two">
          <FormLabel label="Senha inicial" required />
          <FormInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.password}
            suffix={
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} accessibilityLabel={showPassword ? "Esconder senha" : "Mostrar senha"}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#60646C" />
              </Pressable>
            }
          />
          <FieldError message={errors.password} />
        </View>
      )}
      {target && (
        <View className="gap-two">
          <FormLabel label="Perfil" />
          <OptionChips options={ROLES} value={role} onChange={setRole} />
        </View>
      )}
      <View className="gap-two">
        <FormLabel label="Departamento" required={role !== "ADMIN"} />
        {activeDepartments.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {departments.loading ? "Carregando..." : "Cadastre um departamento antes."}
          </ThemedText>
        ) : (
          <OptionChips options={activeDepartments.map((d) => ({ value: d.id, label: d.name }))} value={departmentId} onChange={setDepartmentId} />
        )}
        <FieldError message={errors.department} />
      </View>
    </FormSheet>
  );
}

export default function UsersScreen() {
  const { user: me } = useAuth();
  const list = useRecordList(ListCompanyUsers, {
    errorMessage: "Não foi possível carregar os usuários.",
    searchText: (u) => `${u.name} ${u.email} ${u.username} ${u.department_name}`,
  });
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <RecordListScreen
      title="Usuários"
      subtitle="Quem acessa o ProTrack da empresa."
      searchPlaceholder="Nome, e-mail ou departamento"
      emptyIcon="people-outline"
      emptyMessage="Nenhum usuário cadastrado."
      noun={["usuário", "usuários"]}
      list={list}
      keyExtractor={(u) => u.id}
      addLabel="Novo usuário"
      onAdd={() => {
        setEditing(null);
        setOpen(true);
      }}
      renderItem={(u) => {
        const self = u.id === me?.id;
        return (
          <RecordRow
            title={`${u.name}${self ? " (você)" : ""}`}
            subtitle={[u.email, `${roleLabel(u.role)}${u.department_name ? ` · ${u.department_name}` : ""}`, u.last_login_at && `Último acesso ${formatDateTime(u.last_login_at)}`]
              .filter(Boolean)
              .join("\n")}
            icon={u.role === "ADMIN" ? "shield-checkmark-outline" : "person-outline"}
            color={u.role === "ADMIN" ? "#7C3AED" : "#3c87f7"}
            active={u.status === "ACTIVE"}
            toggling={list.togglingId === u.id}
            onPress={() => {
              setEditing(u);
              setOpen(true);
            }}
            // Não dá para desativar a si mesmo e perder o acesso.
            onToggle={
              self
                ? undefined
                : (value) => {
                    const status = value ? "ACTIVE" : "INACTIVE";
                    if (value) return list.toggle(u, { status }, () => SetUserStatus(u.id, status));
                    haptics.warning();
                    Alert.alert(`Desativar ${u.name.split(" ")[0]}?`, "A pessoa não consegue mais entrar até ser reativada.", [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Desativar", style: "destructive", onPress: () => list.toggle(u, { status }, () => SetUserStatus(u.id, status)) },
                    ]);
                  }
            }
          />
        );
      }}
    >
      <UserSheet target={editing} visible={open} onClose={() => setOpen(false)} onSaved={list.reload} />
    </RecordListScreen>
  );
}

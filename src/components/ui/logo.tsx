import { Image } from "@/components/ui/image";

// Mesmos arquivos de protrack-web/src/assets: logo-gerencial-dark.svg (texto
// branco, para fundos escuros/gradiente) e logo-gerencial.svg (texto escuro).
const LOGOS = {
  light: require("@/assets/images/logo-light.svg"),
  dark: require("@/assets/images/logo-dark.svg"),
};
const RATIO = 46 / 199.71;

type LogoProps = {
  width?: number;
  /** `light` sobre o gradiente da marca; `dark` sobre fundo claro. */
  variant?: keyof typeof LOGOS;
};

export function Logo({ width = 120, variant = "light" }: LogoProps) {
  return (
    <Image
      source={LOGOS[variant]}
      contentFit="contain"
      style={{ width, height: width * RATIO }}
      accessibilityLabel="ProTrack Gerencial"
    />
  );
}

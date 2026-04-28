import Image from "next/image"
import { brandAssets } from "@/lib/brand/assets"

type PersonaraLogoVariant = "horizontal" | "icon" | "stacked" | "dark"

type PersonaraLogoProps = {
  variant?: PersonaraLogoVariant
  className?: string
  priority?: boolean
  width?: number
  height?: number
  alt?: string
}

const logoConfig: Record<PersonaraLogoVariant, { src: string; width: number; height: number }> = {
  horizontal: { src: brandAssets.logoHorizontalLight, width: 420, height: 120 },
  icon: { src: brandAssets.logoIcon, width: 120, height: 120 },
  stacked: { src: brandAssets.logoStacked, width: 300, height: 260 },
  dark: { src: brandAssets.logoHorizontalDark, width: 420, height: 120 },
}

export function PersonaraLogo({
  variant = "horizontal",
  className = "",
  priority = false,
  width,
  height,
  alt = "Personara.ai",
}: PersonaraLogoProps) {
  const logo = logoConfig[variant]

  return (
    <Image
      src={logo.src}
      alt={alt}
      width={width ?? logo.width}
      height={height ?? logo.height}
      priority={priority}
      className={className}
    />
  )
}

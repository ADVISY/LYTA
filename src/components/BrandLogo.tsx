import { useState } from "react";
import { Building2 } from "lucide-react";

interface BrandLogoProps {
  src?: string | null;
  name: string;
  platform?: boolean;
  className?: string;
  imgClassName?: string;
}

// NOTE : on essaie d'abord d'afficher le SVG sur tous les navigateurs (Safari
// inclus). Si le rendu plante vraiment, onError natif déclenche le fallback.
// L'ancien guard "Safari + SVG → fallback systématique" cassait l'UX sur
// macOS/iOS pour rien (le filter du logo est une matrice identité = no-op).

function PlatformLogoFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex max-w-full items-center justify-center gap-4 ${className}`}>
      <div className="relative h-16 w-16 shrink-0 rounded-lg bg-[#1800AD] sm:h-20 sm:w-20">
        <div className="absolute bottom-3 left-1/2 top-3 w-3 -translate-x-1/2 rounded bg-[#FFDE59]" />
      </div>
      <span className="text-5xl font-black tracking-normal text-[#1800AD] sm:text-6xl">
        LYTA
      </span>
    </div>
  );
}

function TenantLogoFallback({ name, className = "" }: { name: string; className?: string }) {
  return (
    <div className={`inline-flex max-w-full items-center justify-center gap-3 ${className}`}>
      <Building2 className="h-14 w-14 shrink-0 text-primary sm:h-16 sm:w-16" />
      <span className="max-w-full break-words text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
        {name}
      </span>
    </div>
  );
}

export function BrandLogo({
  src,
  name,
  platform = false,
  className = "",
  imgClassName = "h-24 sm:h-32 mx-auto",
}: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name}
        className={`${imgClassName} max-w-full object-contain ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (platform) {
    return <PlatformLogoFallback className={className} />;
  }

  return <TenantLogoFallback name={name} className={className} />;
}

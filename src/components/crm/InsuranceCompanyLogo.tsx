import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

interface InsuranceCompanyLogoProps {
  name?: string | null;
  logoUrl?: string | null;
  size?: LogoSize;
  className?: string;
  imageClassName?: string;
}

const sizeClasses: Record<LogoSize, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-10 w-10 rounded-lg",
  lg: "h-12 w-12 rounded-xl",
};

const textClasses: Record<LogoSize, string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
};

const iconClasses: Record<LogoSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

function getCompanyInitials(name?: string | null) {
  if (!name) return "";

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function InsuranceCompanyLogo({
  name,
  logoUrl,
  size = "md",
  className,
  imageClassName,
}: InsuranceCompanyLogoProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [logoUrl]);

  const initials = getCompanyInitials(name);
  const showImage = !!logoUrl && !hasImageError;

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden border border-border bg-white/95 text-slate-700 shadow-sm",
        sizeClasses[size],
        className
      )}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={name || "Logo compagnie"}
          className={cn("h-full w-full object-contain p-1", imageClassName)}
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      ) : initials ? (
        <span className={cn("font-semibold tracking-tight", textClasses[size])}>
          {initials}
        </span>
      ) : (
        <Building2 className={cn("text-slate-500", iconClasses[size])} />
      )}
    </div>
  );
}

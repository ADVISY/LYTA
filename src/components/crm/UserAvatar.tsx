import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, UserRound, Baby } from "lucide-react";
import { cn } from "@/lib/utils";

type Gender = "homme" | "femme" | "enfant" | null | undefined;

interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  gender?: Gender;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

const textSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

// Color based on gender
const genderColors = {
  homme: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
  femme: "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300",
  enfant: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300",
  default: "bg-muted text-muted-foreground",
};

export function UserAvatar({
  firstName,
  lastName,
  photoUrl,
  gender,
  size = "md",
  className,
}: UserAvatarProps) {
  const getInitials = () => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
    return first + last || "?";
  };

  const getGenderIcon = () => {
    const iconClass = iconSizes[size];
    switch (gender) {
      case "homme":
        return <UserRound className={iconClass} />;
      case "femme":
        return <User className={iconClass} />;
      case "enfant":
        return <Baby className={iconClass} />;
      default:
        return <User className={iconClass} />;
    }
  };

  const colorClass = genderColors[gender || "default"];

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {photoUrl && (
        <AvatarImage src={photoUrl} alt={`${firstName} ${lastName}`} />
      )}
      <AvatarFallback className={cn(colorClass, textSizes[size], "font-medium")}>
        {photoUrl ? getInitials() : firstName || lastName ? getInitials() : getGenderIcon()}
      </AvatarFallback>
    </Avatar>
  );
}

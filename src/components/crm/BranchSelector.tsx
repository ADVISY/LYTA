import { useMemo } from 'react';
import {
  Heart,
  HeartPulse,
  Activity,
  ShieldAlert,
  Sparkles,
  Briefcase,
  Car,
  Home,
  Scale,
  Plane,
  Building2,
  Landmark,
  Shield,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenantBranches, type TenantBranch } from '@/hooks/useTenantBranches';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Heart,
  HeartPulse,
  Activity,
  ShieldAlert,
  Sparkles,
  Briefcase,
  Car,
  Home,
  Scale,
  Plane,
  Building2,
  Landmark,
  Shield,
};

export function getBranchIcon(iconName: string | null | undefined): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  if (!iconName) return Shield;
  return ICON_MAP[iconName] || Shield;
}

interface BranchChipProps {
  branch: Pick<TenantBranch, 'name' | 'icon' | 'color'> | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Display chip showing a branch with its icon + color.
 * Falls back to a neutral chip if branch is missing.
 */
export function BranchChip({ branch, size = 'sm', className = '' }: BranchChipProps) {
  if (!branch) {
    return (
      <Badge variant="outline" className={`text-xs gap-1 font-normal ${className}`}>
        <Shield className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        Non catégorisé
      </Badge>
    );
  }
  const Icon = getBranchIcon(branch.icon);
  const color = branch.color || '#64748b';
  return (
    <Badge
      variant="outline"
      className={`text-xs gap-1 font-normal ${className}`}
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}12`,
        color,
      }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {branch.name}
    </Badge>
  );
}

interface BranchSelectorProps {
  value: string | null | undefined;
  onChange: (branchId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  includeInactive?: boolean;
  className?: string;
}

/**
 * Single-select dropdown of the tenant's active branches.
 * Each option shows the branch icon + color + name.
 */
export function BranchSelector({
  value,
  onChange,
  placeholder = 'Sélectionner une branche',
  disabled = false,
  includeInactive = false,
  className,
}: BranchSelectorProps) {
  const { branches, loading } = useTenantBranches({ includeInactive });

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === value) || null,
    [branches, value],
  );

  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled || loading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={loading ? 'Chargement…' : placeholder}>
          {selectedBranch && (
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = getBranchIcon(selectedBranch.icon);
                return (
                  <Icon
                    className="h-4 w-4"
                    style={{ color: selectedBranch.color || undefined }}
                  />
                );
              })()}
              <span>{selectedBranch.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => {
          const Icon = getBranchIcon(branch.icon);
          return (
            <SelectItem key={branch.id} value={branch.id}>
              <div className="flex items-center gap-2">
                <Icon
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: branch.color || undefined }}
                />
                <span>{branch.name}</span>
                {!branch.is_active && (
                  <span className="text-xs text-muted-foreground ml-1">(désactivée)</span>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

import { useMemo, useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { BranchChip, BranchSelector } from '@/components/crm/BranchSelector';
import { useTenantBranches } from '@/hooks/useTenantBranches';

interface ProductBranchEditorProps {
  /** Currently assigned branch id (resolved by the server) — undefined if not resolved. */
  branchId?: string | null;
  /** Server-emitted branch_code (LAMAL / LCA / …). Used to look up the branch if branchId is missing. */
  branchCode?: string | null;
  /** Called when the user picks a new branch from the popover. */
  onChange: (branchId: string, branchCode: string) => void;
  /** Confidence indicator: low confidence → highlight to invite correction. */
  lowConfidence?: boolean;
  className?: string;
}

/**
 * Compact in-line branch editor for IA-scanned products.
 *
 * Displays the detected branch as a colored chip. Clicking the chip opens
 * a small popover with a BranchSelector. Picking another branch updates
 * the parent state synchronously — the broker corrects in 2 clicks.
 *
 * If the server did not resolve a branch (branchId missing), the chip shows
 * "À catégoriser" with a soft amber border to invite a correction.
 */
export function ProductBranchEditor({
  branchId,
  branchCode,
  onChange,
  lowConfidence = false,
  className = '',
}: ProductBranchEditorProps) {
  const [open, setOpen] = useState(false);
  const { branches, loading } = useTenantBranches({ includeInactive: false });

  // Resolve current branch object — by id first, then by code as fallback
  const currentBranch = useMemo(() => {
    if (branchId) return branches.find((b) => b.id === branchId) || null;
    if (branchCode) return branches.find((b) => b.code === branchCode) || null;
    return null;
  }, [branches, branchId, branchCode]);

  const hasBranch = !!currentBranch;
  const needsAttention = !hasBranch || lowConfidence;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group inline-flex items-center gap-1.5 rounded transition-all ${className}`}
          title="Cliquez pour changer la branche"
        >
          {hasBranch ? (
            <BranchChip branch={currentBranch} />
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-xs font-normal border rounded px-2 py-0.5 ${
                needsAttention
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                  : 'border-border bg-muted/40 text-muted-foreground'
              }`}
            >
              {needsAttention ? '⚠️' : null} À catégoriser
            </span>
          )}
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Corriger la branche</div>
          <BranchSelector
            value={currentBranch?.id ?? null}
            onChange={(newBranchId) => {
              const newBranch = branches.find((b) => b.id === newBranchId);
              if (newBranch) {
                onChange(newBranchId, newBranch.code);
                setOpen(false);
              }
            }}
            placeholder={loading ? 'Chargement…' : 'Choisir une branche'}
          />
          <p className="text-[11px] text-muted-foreground leading-snug">
            La branche définit la catégorie du produit (LAMal, LCA, Vie, Auto…). Astuce&nbsp;: si tu ne trouves pas, ajoute une branche custom dans <em>Partenaires → Mes branches</em>.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

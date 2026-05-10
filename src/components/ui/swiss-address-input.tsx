/**
 * Swiss street-address autocomplete via swisstopo.
 *
 * Behaviour
 * ─────────
 *   - User types in the address field
 *   - 300 ms after the last keystroke, if length ≥ 3, we hit the
 *     `swiss-address-lookup` Edge Function
 *   - Up to 8 suggestions appear in a dropdown below the input
 *   - Click → fills street + houseNumber + postalCode + city in the
 *     parent form via the supplied callbacks. The parent decides which
 *     of those fields it wants to listen to.
 *   - "Validated" mode: when the user picks from the dropdown, we
 *     remember the canonical address string so the field shows a small
 *     ✓ badge. Any subsequent edit clears the badge.
 *
 * Why a Swiss-only validator
 * ──────────────────────────
 *   LYTA is a Swiss broker CRM. swisstopo is the federal source-of-
 *   truth for every street + house number in CH. If we one day need
 *   non-CH support we can layer Google Places or Photon on top.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import { supabaseConfig } from "@/integrations/supabase/config";

interface AddressHit {
  label: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  canton: string | null;
}

export interface SwissAddressInputProps {
  /** Current full street value (e.g. "Rue de Bourg 12") */
  value: string;
  onChange: (value: string) => void;
  /**
   * Called when the user picks a suggestion. Lets the parent fill
   * postal_code + city + canton on its own form state.
   */
  onAddressResolved?: (resolved: {
    street: string | null;
    houseNumber: string | null;
    postalCode: string | null;
    city: string | null;
    canton: string | null;
    /** The full canonical label as returned by swisstopo */
    label: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  /**
   * If false, the dropdown is not shown — useful when the parent only
   * wants validation but no inline UI (rare).
   */
  showDropdown?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

export function SwissAddressInput({
  value,
  onChange,
  onAddressResolved,
  placeholder = "Rue de Bourg 12",
  disabled = false,
  id,
  name,
  className,
  showDropdown = true,
}: SwissAddressInputProps) {
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /** The label of the most recently picked suggestion. Drives the ✓ badge. */
  const [validatedLabel, setValidatedLabel] = useState<string | null>(null);

  // Stabilise the resolved callback so the lookup effect doesn't re-fire
  // every render of the parent form.
  const onResolvedRef = useRef(onAddressResolved);
  useEffect(() => {
    onResolvedRef.current = onAddressResolved;
  });

  // Lookup effect: debounced, fires whenever `value` changes.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    // If the user just picked a suggestion, the value already equals
    // the canonical label → don't re-search and don't reopen.
    if (trimmed === validatedLabel) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const url = `${supabaseConfig.url}/functions/v1/swiss-address-lookup?q=${encodeURIComponent(trimmed)}&v=1`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            apikey: supabaseConfig.publishableKey,
            Authorization: `Bearer ${supabaseConfig.publishableKey}`,
          },
        });
        if (!res.ok) {
          if (!cancelled) {
            setHits([]);
            setOpen(false);
          }
          return;
        }
        const data = (await res.json()) as AddressHit[];
        if (cancelled) return;
        setHits(Array.isArray(data) ? data : []);
        setOpen(Array.isArray(data) && data.length > 0);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[SwissAddressInput] lookup failed", err);
        if (!cancelled) {
          setHits([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, validatedLabel]);

  const handlePick = useCallback(
    (hit: AddressHit) => {
      // Build the visible street value the user will see in the input.
      // Prefer "<street> <number>" when both are present, otherwise the
      // full label (covers oddities the parser may have missed).
      const visible =
        hit.street && hit.houseNumber
          ? `${hit.street} ${hit.houseNumber}`
          : hit.street || hit.label;
      onChange(visible);
      setValidatedLabel(visible);
      onResolvedRef.current?.({
        street: hit.street,
        houseNumber: hit.houseNumber,
        postalCode: hit.postalCode,
        city: hit.city,
        canton: hit.canton,
        label: hit.label,
      });
      setHits([]);
      setOpen(false);
    },
    [onChange],
  );

  const isValidated = validatedLabel !== null && validatedLabel === value.trim();

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            // Any edit invalidates the previous pick
            if (validatedLabel && next !== validatedLabel) {
              setValidatedLabel(null);
            }
            onChange(next);
          }}
          onFocus={() => {
            if (hits.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay so a click on a suggestion has time to register
            window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          autoComplete="street-address"
        />
        {/* Loading spinner OR validated check — never both */}
        {loading ? (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : isValidated ? (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-emerald-700"
            title="Adresse validée par swisstopo"
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>

      {showDropdown && open && hits.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-72 overflow-y-auto">
          {hits.map((h, i) => (
            <button
              key={`${h.label}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(h)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {h.street}
                    {h.houseNumber ? ` ${h.houseNumber}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {h.postalCode} {h.city}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

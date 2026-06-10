/**
 * Street-address autocomplete — Suisse (swisstopo) + France (BAN).
 *
 * Historical note (juin 2026) : ce composant ne supportait QUE la Suisse.
 * Le nom est resté "SwissAddressInput" pour ne pas casser les imports
 * existants mais il gère maintenant AUSSI les clients français — switch
 * automatique selon le champ `country` passé en prop.
 *
 * Behaviour
 * ─────────
 *   - User types in the address field
 *   - 300 ms après la dernière touche, si length ≥ 3, on hit l'edge
 *     function correspondante :
 *       country=Suisse  → swiss-address-lookup (swisstopo)
 *       country=France  → french-address-lookup (Base Adresse Nationale)
 *       country=autre   → lookup désactivé, input texte simple
 *   - Up to 8 suggestions appear in a dropdown below the input
 *   - Click → fills street + houseNumber + postalCode + city in the
 *     parent form via the supplied callbacks
 *   - "Validated" mode: when the user picks from the dropdown, we
 *     remember the canonical address string so the field shows a small
 *     ✓ badge. Any subsequent edit clears the badge.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import { supabaseConfig } from "@/integrations/supabase/config";
import { detectCountryMode } from "./swiss-postal-code-fields";

interface AddressHit {
  label: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  // Canton (swisstopo) ou département (BAN français). On garde le même
  // champ "canton" dans le type pour rétro-compat des consommateurs.
  canton: string | null;
}

// Réponse brute french-address-lookup (department au lieu de canton)
interface FrenchAddressRaw {
  label: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  department: string | null;
}

export interface SwissAddressInputProps {
  /** Current full street value (e.g. "Rue de Bourg 12") */
  value: string;
  onChange: (value: string) => void;
  /**
   * Country du client (ex: "Suisse", "France"). Détermine sur quelle
   * API l'autocomplete tire. Si absent → Suisse par défaut (legacy).
   */
  country?: string;
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
    /** The full canonical label as returned by upstream */
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

// Endpoints d'edge functions par mode. Si on étend à d'autres pays
// (Allemagne, Italie, Belgique…), il suffit d'ajouter une entrée ici
// + un cas dans detectCountryMode et la regex CP correspondante.
const ADDRESS_ENDPOINT: Record<"swiss" | "french", string> = {
  swiss: "swiss-address-lookup",
  french: "french-address-lookup",
};

export function SwissAddressInput({
  value,
  onChange,
  country,
  onAddressResolved,
  placeholder,
  disabled = false,
  id,
  name,
  className,
  showDropdown = true,
}: SwissAddressInputProps) {
  // Détecte le pays — défaut Suisse si non précisé (legacy)
  const mode = detectCountryMode(country);
  const lookupEnabled = mode !== "none";

  // Placeholder pays-spécifique (override possible par prop)
  const effectivePlaceholder =
    placeholder ??
    (mode === "french"
      ? "8 Boulevard du Port"
      : mode === "swiss"
      ? "Rue de Bourg 12"
      : "Rue + numéro");

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

  // Lookup effect: debounced, fires whenever `value` ou le pays change.
  useEffect(() => {
    if (!lookupEnabled) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }
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
    // À ce point on a déjà early-return si lookupEnabled=false, donc mode
    // est forcément "swiss" ou "french" — TS ne le sait pas, on cast.
    const endpoint = ADDRESS_ENDPOINT[mode as "swiss" | "french"];
    const timer = window.setTimeout(async () => {
      try {
        const url = `${supabaseConfig.url}/functions/v1/${endpoint}?q=${encodeURIComponent(trimmed)}&v=2`;
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
        const raw = (await res.json()) as unknown;
        // Normalise les deux formats (suisse vs français). swisstopo
        // renvoie déjà { …, canton }, français renvoie { …, department }
        // → on map dans le champ unifié "canton" pour les consommateurs.
        const normalised: AddressHit[] = Array.isArray(raw)
          ? (raw as Array<AddressHit | FrenchAddressRaw>).map((h): AddressHit => {
              if ("department" in h) {
                return {
                  label: h.label,
                  street: h.street,
                  houseNumber: h.houseNumber,
                  postalCode: h.postalCode,
                  city: h.city,
                  canton: h.department,
                };
              }
              return h;
            })
          : [];
        if (cancelled) return;
        setHits(normalised);
        setOpen(normalised.length > 0);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[AddressInput] lookup failed", err);
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
  }, [value, validatedLabel, lookupEnabled, mode]);

  const handlePick = useCallback(
    (hit: AddressHit) => {
      // Build the visible street value the user will see in the input.
      // Goal: ONLY street + number, never the postal code / city — those
      // belong in their own form fields per Habib's feedback.
      let visible: string;
      if (hit.street && hit.houseNumber) {
        visible = `${hit.street} ${hit.houseNumber}`;
      } else if (hit.street) {
        visible = hit.street;
      } else {
        // Defensive last resort: take the label and aggressively strip
        // any trailing "<plz> <city>" pattern, so we never leak PLZ /
        // city into the address field even when the parser failed.
        visible = (hit.label || "").replace(/[,;]?\s*\d{4}\s+\S.*$/u, "").trim();
        if (!visible) visible = hit.label || "";
      }
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
          placeholder={effectivePlaceholder}
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

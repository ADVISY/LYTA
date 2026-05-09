/**
 * Swiss postal code + city auto-completion via OpenPLZ public API.
 *
 * Behavior:
 *  - User types a Swiss PLZ (4 digits) → 300 ms debounce → fetch OpenPLZ
 *  - 1 match  → city auto-filled silently
 *  - N matches → small dropdown lets the user pick (e.g. PLZ 1009 = Pully OR Paudex)
 *  - 0 match  → silent, the user can still type the city manually
 *  - Country ≠ Suisse / Switzerland / CH → lookup disabled, fields behave like plain inputs
 *  - API down → silent fail, fields work like plain inputs
 *
 * The component is uncontrolled regarding its own state; it just emits
 * onPostalCodeChange / onCityChange so it plugs into react-hook-form,
 * formik, or plain useState the same way.
 *
 * No API key required. OpenPLZ is a public German/Swiss/Austrian PLZ service.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SwissPostalCodeFieldsProps {
  postalCode: string;
  city: string;
  country?: string;
  onPostalCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  /**
   * Called when the user actively picks a locality from the dropdown
   * (or when the API returns a single match and we auto-fill).
   * Useful if you want to also store canton or country in your form state.
   */
  onLocalityResolved?: (locality: { city: string; canton?: string }) => void;
  /**
   * If provided, the component renders its own <Label>s above each input.
   * Set to `null` (or omit) when the parent already provides FormLabel — in
   * that case the component just renders the two <Input>s.
   */
  postalCodeLabel?: string | null;
  cityLabel?: string | null;
  postalCodePlaceholder?: string;
  cityPlaceholder?: string;
  postalCodeId?: string;
  cityId?: string;
  postalCodeName?: string;
  cityName?: string;
  disabled?: boolean;
  /** Forwarded to the underlying inputs. */
  postalCodeClassName?: string;
  cityClassName?: string;
}

interface OpenPLZLocality {
  postalCode: string;
  name: string;
  canton?: { key?: string; name?: string; shortName?: string };
}

const SWISS_COUNTRY_VALUES = new Set([
  "",
  "ch",
  "che",
  "suisse",
  "switzerland",
  "schweiz",
  "svizzera",
  "svizra",
]);

function isSwissCountry(country?: string): boolean {
  if (!country) return true;
  return SWISS_COUNTRY_VALUES.has(country.trim().toLowerCase());
}

const SWISS_PLZ_REGEX = /^\d{4}$/;

export function SwissPostalCodeFields({
  postalCode,
  city,
  country,
  onPostalCodeChange,
  onCityChange,
  onLocalityResolved,
  postalCodeLabel,
  cityLabel,
  postalCodePlaceholder = "1003",
  cityPlaceholder = "Lausanne",
  postalCodeId,
  cityId,
  postalCodeName,
  cityName,
  disabled = false,
  postalCodeClassName,
  cityClassName,
}: SwissPostalCodeFieldsProps) {
  const [suggestions, setSuggestions] = useState<OpenPLZLocality[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  // Track the PLZ we last auto-filled for, so we don't re-overwrite a city
  // the user has manually edited.
  const lastAutoFilledPLZ = useRef<string | null>(null);

  const lookupEnabled = isSwissCountry(country);

  // Callback refs — kept up-to-date on every render but never appear in
  // useEffect deps. This is the fix for the "PLZ never resolves" bug:
  // parent forms typically pass inline arrow functions for onCityChange /
  // onLocalityResolved, which are recreated on every keystroke. If those
  // callbacks (or anything that closes over them) sit in the lookup
  // effect's dep array, the effect cleans up after every keystroke, the
  // 300ms debounce timer is cancelled before it fires, and we never call
  // OpenPLZ. Refs decouple this.
  const onCityChangeRef = useRef(onCityChange);
  const onLocalityResolvedRef = useRef(onLocalityResolved);
  const cityRef = useRef(city);
  useEffect(() => {
    onCityChangeRef.current = onCityChange;
    onLocalityResolvedRef.current = onLocalityResolved;
    cityRef.current = city;
  });

  const handlePick = useCallback((loc: OpenPLZLocality) => {
    onCityChangeRef.current(loc.name);
    lastAutoFilledPLZ.current = loc.postalCode;
    onLocalityResolvedRef.current?.({
      city: loc.name,
      canton: loc.canton?.shortName ?? loc.canton?.key ?? loc.canton?.name,
    });
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  useEffect(() => {
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[SwissPostalCodeFields] effect tick", {
        postalCode,
        country,
        lookupEnabled,
      });
    }
    if (!lookupEnabled) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    const trimmed = postalCode.trim();
    if (!SWISS_PLZ_REGEX.test(trimmed)) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const url = `https://openplz.org/api/ch/Localities?postalCode=${encodeURIComponent(trimmed)}`;
        if (typeof console !== "undefined") {
          // eslint-disable-next-line no-console
          console.log("[SwissPostalCodeFields] fetching", url);
        }
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (typeof console !== "undefined") {
          // eslint-disable-next-line no-console
          console.log("[SwissPostalCodeFields] response", res.status, res.statusText);
        }
        if (!res.ok) {
          if (!cancelled) {
            setSuggestions([]);
            setShowSuggestions(false);
          }
          return;
        }
        const raw = (await res.json()) as unknown;
        const data: OpenPLZLocality[] = Array.isArray(raw) ? (raw as OpenPLZLocality[]) : [];
        if (cancelled) return;

        if (data.length === 0) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        const currentCity = cityRef.current; // latest, not closure-stale

        if (data.length === 1) {
          // Single canonical match → auto-fill silently if the city is empty
          // or doesn't match what the API returned.
          const only = data[0];
          if (!currentCity || currentCity.trim().toLowerCase() !== only.name.toLowerCase()) {
            handlePick(only);
          } else {
            // City already correct — record we've seen this PLZ
            lastAutoFilledPLZ.current = only.postalCode;
            onLocalityResolvedRef.current?.({
              city: only.name,
              canton:
                only.canton?.shortName ?? only.canton?.key ?? only.canton?.name,
            });
            setSuggestions([]);
            setShowSuggestions(false);
          }
          return;
        }

        // Multiple matches (e.g. PLZ 1009 → Pully + Paudex). Show dropdown
        // unless the user already has one of the candidates typed in.
        const cityLower = currentCity.trim().toLowerCase();
        const cityMatchesACandidate =
          cityLower !== "" &&
          data.some((d) => d.name.toLowerCase() === cityLower);
        if (cityMatchesACandidate) {
          setSuggestions([]);
          setShowSuggestions(false);
        } else {
          setSuggestions(data);
          setShowSuggestions(true);
        }
      } catch (err) {
        // Network blocked, offline, ad-blocker, CORS, etc. The fields
        // still work as plain inputs — log a warn for diagnosability.
        if (typeof console !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn("[SwissPostalCodeFields] OpenPLZ lookup failed", err);
        }
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Deps: only the values that should re-fire the lookup.
    // - postalCode: the actual trigger
    // - lookupEnabled: country switched between Swiss and non-Swiss
    // - handlePick: stable (empty deps), included for the linter
  }, [postalCode, lookupEnabled, handlePick]);

  const postalCodeInput = (
    <div className="relative">
      <Input
        id={postalCodeId}
        name={postalCodeName}
        value={postalCode}
        onChange={(e) => {
          const next = e.target.value;
          // If user clears or changes the PLZ, drop our auto-fill memory
          // so the next valid PLZ can re-trigger a lookup.
          if (lastAutoFilledPLZ.current && next !== lastAutoFilledPLZ.current) {
            lastAutoFilledPLZ.current = null;
          }
          onPostalCodeChange(next);
        }}
        placeholder={postalCodePlaceholder}
        inputMode={lookupEnabled ? "numeric" : undefined}
        maxLength={lookupEnabled ? 4 : undefined}
        disabled={disabled}
        className={postalCodeClassName}
        autoComplete="postal-code"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
    </div>
  );

  const cityInput = (
    <div className="relative">
      <Input
        id={cityId}
        name={cityName}
        value={city}
        onChange={(e) => onCityChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        onBlur={() => {
          // Delay so a click on a suggestion has time to register
          window.setTimeout(() => setShowSuggestions(false), 150);
        }}
        placeholder={cityPlaceholder}
        disabled={disabled}
        className={cityClassName}
        autoComplete="address-level2"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => {
            const cantonLabel =
              s.canton?.shortName ?? s.canton?.key ?? s.canton?.name ?? "";
            return (
              <button
                key={`${s.postalCode}-${s.name}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(s)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-medium">{s.name}</span>
                {cantonLabel && (
                  <span className="text-muted-foreground"> · {cantonLabel}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // If the parent passed labels, wrap each input in a small column with
  // its own <Label>. Otherwise return bare inputs so the caller (typically
  // a react-hook-form FormField) controls the label.
  if (postalCodeLabel || cityLabel) {
    return (
      <>
        <div className="space-y-2">
          {postalCodeLabel && (
            <Label htmlFor={postalCodeId}>{postalCodeLabel}</Label>
          )}
          {postalCodeInput}
        </div>
        <div className="space-y-2">
          {cityLabel && <Label htmlFor={cityId}>{cityLabel}</Label>}
          {cityInput}
        </div>
      </>
    );
  }

  return (
    <>
      {postalCodeInput}
      {cityInput}
    </>
  );
}

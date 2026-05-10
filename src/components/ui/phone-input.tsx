/**
 * PhoneInput — bulletproof international phone input.
 *
 * Goals (set by Habib after Twilio rejected several malformed numbers):
 *   - Impossible to enter junk: only digits + spaces are accepted in the
 *     local number field. The country prefix is picked from a dropdown,
 *     never typed.
 *   - The leading 0 of the national format is auto-stripped for the
 *     selected country, so a user typing "079 123 45 67" with CH
 *     selected ends up storing "+41791234567" — the format Twilio
 *     and any sane SMS gateway expects.
 *   - The value EMITTED to the parent is always plain E.164 with
 *     no spaces (e.g. "+41791234567"). No more "+41 79 …" strings
 *     leaking into Edge Functions.
 *   - The DISPLAY is prettified with spaces for readability while typing,
 *     so the user still sees "79 123 45 67".
 *   - A green check appears when the number is a valid E.164 length for
 *     the selected country. A red border appears if the user typed
 *     something invalid.
 *   - Already-stored values in any historical format (with spaces, with
 *     a leading 0, with a duplicated prefix, etc.) are parsed correctly
 *     when the field mounts so legacy data doesn't break the UI.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CountryDef {
  code: string;
  name: string;
  dial: string;
  flag: string;
  /**
   * Expected number of NATIONAL digits AFTER the country code. e.g. CH
   * has 9 (79 123 45 67 → 791234567 = 9 digits). Used both for
   * validation and to format the display nicely.
   */
  nationalLength: number;
  /** How to chunk the digits for display, e.g. [2,3,2,2] → "79 123 45 67". */
  displayChunks?: number[];
}

/**
 * European country codes commonly used by Swiss insurance brokers.
 * Order: CH first (default), then EU+EEA neighbors and major destinations.
 */
const COUNTRIES: CountryDef[] = [
  { code: "CH", name: "Suisse",       dial: "+41",  flag: "🇨🇭", nationalLength: 9, displayChunks: [2, 3, 2, 2] },
  { code: "FR", name: "France",       dial: "+33",  flag: "🇫🇷", nationalLength: 9, displayChunks: [1, 2, 2, 2, 2] },
  { code: "DE", name: "Allemagne",    dial: "+49",  flag: "🇩🇪", nationalLength: 11 },
  { code: "IT", name: "Italie",       dial: "+39",  flag: "🇮🇹", nationalLength: 10 },
  { code: "ES", name: "Espagne",      dial: "+34",  flag: "🇪🇸", nationalLength: 9 },
  { code: "PT", name: "Portugal",     dial: "+351", flag: "🇵🇹", nationalLength: 9 },
  { code: "BE", name: "Belgique",     dial: "+32",  flag: "🇧🇪", nationalLength: 9 },
  { code: "NL", name: "Pays-Bas",     dial: "+31",  flag: "🇳🇱", nationalLength: 9 },
  { code: "LU", name: "Luxembourg",   dial: "+352", flag: "🇱🇺", nationalLength: 9 },
  { code: "AT", name: "Autriche",     dial: "+43",  flag: "🇦🇹", nationalLength: 11 },
  { code: "GB", name: "Royaume-Uni",  dial: "+44",  flag: "🇬🇧", nationalLength: 10 },
  { code: "IE", name: "Irlande",      dial: "+353", flag: "🇮🇪", nationalLength: 9 },
  { code: "DK", name: "Danemark",     dial: "+45",  flag: "🇩🇰", nationalLength: 8 },
  { code: "SE", name: "Suède",        dial: "+46",  flag: "🇸🇪", nationalLength: 9 },
  { code: "NO", name: "Norvège",      dial: "+47",  flag: "🇳🇴", nationalLength: 8 },
  { code: "FI", name: "Finlande",     dial: "+358", flag: "🇫🇮", nationalLength: 9 },
  { code: "PL", name: "Pologne",      dial: "+48",  flag: "🇵🇱", nationalLength: 9 },
  { code: "CZ", name: "Tchéquie",     dial: "+420", flag: "🇨🇿", nationalLength: 9 },
  { code: "SK", name: "Slovaquie",    dial: "+421", flag: "🇸🇰", nationalLength: 9 },
  { code: "HU", name: "Hongrie",      dial: "+36",  flag: "🇭🇺", nationalLength: 9 },
  { code: "RO", name: "Roumanie",     dial: "+40",  flag: "🇷🇴", nationalLength: 9 },
  { code: "BG", name: "Bulgarie",     dial: "+359", flag: "🇧🇬", nationalLength: 9 },
  { code: "GR", name: "Grèce",        dial: "+30",  flag: "🇬🇷", nationalLength: 10 },
  { code: "HR", name: "Croatie",      dial: "+385", flag: "🇭🇷", nationalLength: 9 },
  { code: "SI", name: "Slovénie",     dial: "+386", flag: "🇸🇮", nationalLength: 8 },
  { code: "EE", name: "Estonie",      dial: "+372", flag: "🇪🇪", nationalLength: 8 },
  { code: "LV", name: "Lettonie",     dial: "+371", flag: "🇱🇻", nationalLength: 8 },
  { code: "LT", name: "Lituanie",     dial: "+370", flag: "🇱🇹", nationalLength: 8 },
  { code: "MT", name: "Malte",        dial: "+356", flag: "🇲🇹", nationalLength: 8 },
  { code: "CY", name: "Chypre",       dial: "+357", flag: "🇨🇾", nationalLength: 8 },
  { code: "IS", name: "Islande",      dial: "+354", flag: "🇮🇸", nationalLength: 7 },
  { code: "LI", name: "Liechtenstein", dial: "+423", flag: "🇱🇮", nationalLength: 7 },
  { code: "MC", name: "Monaco",       dial: "+377", flag: "🇲🇨", nationalLength: 8 },
];

const DEFAULT_DIAL = "+41";
const COUNTRIES_BY_DIAL = new Map(COUNTRIES.map((c) => [c.dial, c]));

/**
 * Aggressively normalise any historically-stored phone string into
 *   { dial: "+41", digits: "791234567" }
 * Strips spaces / dashes / dots, removes duplicate "+", strips a leading
 * national 0, and figures out which dial code the number was prefixed
 * with (longest match wins because some prefixes are nested, e.g. +1 vs +1242).
 */
function parsePhone(raw: string | null | undefined): { dial: string; digits: string } {
  if (!raw) return { dial: DEFAULT_DIAL, digits: "" };

  // Strip everything except digits and `+`
  let s = raw.trim().replace(/[^\d+]/g, "");
  if (!s) return { dial: DEFAULT_DIAL, digits: "" };

  // 0041 79 ... → +41 79 ...
  if (s.startsWith("00")) s = `+${s.slice(2)}`;

  // Collapse "++…" or "+41+…" anomalies that can come from copy-paste mishaps
  while (s.startsWith("++")) s = s.slice(1);
  s = s.replace(/^\+41\+/, "+");

  // Try the longest dial code first, then a generic +N… fallback
  if (s.startsWith("+")) {
    const sortedDials = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sortedDials) {
      if (s.startsWith(c.dial)) {
        let digits = s.slice(c.dial.length).replace(/\D/g, "");
        // Strip a leading 0 of the national format
        if (digits.startsWith("0")) digits = digits.slice(1);
        return { dial: c.dial, digits };
      }
    }
    // Unknown country: keep the prefix + clean the rest
    const m = s.match(/^(\+\d{1,4})(.*)$/);
    if (m) {
      const digits = m[2].replace(/\D/g, "");
      return { dial: m[1], digits };
    }
  }

  // No `+` at all → assume Swiss
  let digits = s.replace(/\D/g, "");
  if (digits.startsWith("41") && digits.length >= 11) {
    return { dial: "+41", digits: digits.slice(2).replace(/^0/, "") };
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  return { dial: DEFAULT_DIAL, digits };
}

function formatDisplay(country: CountryDef | undefined, digits: string): string {
  if (!country?.displayChunks) {
    // Default formatting: groups of 2 then 3 then 2 then 2…
    const groups = [2, 3, 2, 2];
    let i = 0;
    const out: string[] = [];
    for (const g of groups) {
      if (i >= digits.length) break;
      out.push(digits.slice(i, i + g));
      i += g;
    }
    if (i < digits.length) out.push(digits.slice(i));
    return out.filter(Boolean).join(" ");
  }
  let i = 0;
  const out: string[] = [];
  for (const g of country.displayChunks) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out.filter(Boolean).join(" ");
}

interface PhoneInputProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** When true, an empty value is reported as valid. */
  required?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "79 123 45 67",
  id,
  className,
  disabled,
  required = false,
}: PhoneInputProps) {
  const initial = parsePhone(value);
  const [dial, setDial] = useState(initial.dial);
  const [digits, setDigits] = useState(initial.digits);

  // Keep internal state in sync if the parent updates `value` externally
  // (e.g. a form reset, or a value loaded from the API after mount).
  useEffect(() => {
    const parsed = parsePhone(value);
    setDial(parsed.dial);
    setDigits(parsed.digits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = COUNTRIES_BY_DIAL.get(dial);
  const display = formatDisplay(country, digits);

  // Validation: digits length must be in [nationalLength-1, nationalLength+1]
  // (we tolerate 1 missing/extra to handle exotic short / long numbers).
  const expected = country?.nationalLength ?? 9;
  const isEmpty = digits.length === 0;
  const isValid =
    !isEmpty && digits.length >= expected - 1 && digits.length <= expected + 1;
  const showError = !isEmpty && !isValid;
  const reportedEmpty = isEmpty && !required;

  const e164 = isEmpty ? "" : `${dial}${digits}`;

  /**
   * Emit to the parent in clean E.164 ("+41791234567"). No spaces, no
   * leading 0, no dashes. The Edge Functions never have to clean up.
   */
  const emit = (newDial: string, newDigits: string) => {
    if (!newDigits) {
      onChange("");
    } else {
      onChange(`${newDial}${newDigits}`);
    }
  };

  const handleDialChange = (next: string) => {
    setDial(next);
    emit(next, digits);
  };

  const handleNumberChange = (typed: string) => {
    // Strip everything except digits — the user CANNOT type +, letters,
    // or anything else into the number box. Country prefix is picked
    // from the dropdown.
    let cleaned = typed.replace(/\D/g, "");
    // Auto-strip a leading 0 — common Swiss/French habit
    while (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    // Cap at country expected length + 1 (defensive against typos)
    const max = (country?.nationalLength ?? 9) + 1;
    if (cleaned.length > max) cleaned = cleaned.slice(0, max);

    setDigits(cleaned);
    emit(dial, cleaned);
  };

  // Compute the small status icon shown on the right of the input
  const statusIcon = useMemo(() => {
    if (reportedEmpty) return null;
    if (isValid) {
      return (
        <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-600 pointer-events-none" />
      );
    }
    if (showError) {
      return (
        <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-500 pointer-events-none" />
      );
    }
    return null;
  }, [reportedEmpty, isValid, showError]);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2">
        <Select value={dial} onValueChange={handleDialChange} disabled={disabled}>
          <SelectTrigger className="w-[120px] shrink-0">
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <span>{country?.flag ?? "🌍"}</span>
                <span className="font-mono text-sm">{dial}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.dial}>
                <span className="flex items-center gap-2">
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-auto">
                    {c.dial}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Input
            id={id}
            type="tel"
            inputMode="numeric"
            value={display}
            onChange={(e) => handleNumberChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="tel-national"
            className={cn(
              "pr-7",
              showError && "border-red-500 focus-visible:ring-red-500",
              isValid && "border-emerald-500/40 focus-visible:ring-emerald-500/30",
            )}
          />
          {statusIcon}
        </div>
      </div>
      {showError && (
        <p className="text-[11px] text-red-600 leading-tight">
          Numéro incomplet pour {country?.name ?? "ce pays"} (attendu {expected} chiffres).
        </p>
      )}
      {isValid && (
        <p className="text-[11px] text-muted-foreground leading-tight">
          Sera enregistré : <span className="font-mono">{e164}</span>
        </p>
      )}
    </div>
  );
}

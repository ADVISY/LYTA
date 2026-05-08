import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * European country codes commonly used by Swiss insurance brokers.
 * Order: CH first (default), then EU+EEA neighbors and major destinations.
 */
const COUNTRIES: Array<{ code: string; name: string; dial: string; flag: string }> = [
  { code: "CH", name: "Suisse", dial: "+41", flag: "🇨🇭" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Allemagne", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Italie", dial: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Espagne", dial: "+34", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "BE", name: "Belgique", dial: "+32", flag: "🇧🇪" },
  { code: "NL", name: "Pays-Bas", dial: "+31", flag: "🇳🇱" },
  { code: "LU", name: "Luxembourg", dial: "+352", flag: "🇱🇺" },
  { code: "AT", name: "Autriche", dial: "+43", flag: "🇦🇹" },
  { code: "GB", name: "Royaume-Uni", dial: "+44", flag: "🇬🇧" },
  { code: "IE", name: "Irlande", dial: "+353", flag: "🇮🇪" },
  { code: "DK", name: "Danemark", dial: "+45", flag: "🇩🇰" },
  { code: "SE", name: "Suède", dial: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norvège", dial: "+47", flag: "🇳🇴" },
  { code: "FI", name: "Finlande", dial: "+358", flag: "🇫🇮" },
  { code: "PL", name: "Pologne", dial: "+48", flag: "🇵🇱" },
  { code: "CZ", name: "Tchéquie", dial: "+420", flag: "🇨🇿" },
  { code: "SK", name: "Slovaquie", dial: "+421", flag: "🇸🇰" },
  { code: "HU", name: "Hongrie", dial: "+36", flag: "🇭🇺" },
  { code: "RO", name: "Roumanie", dial: "+40", flag: "🇷🇴" },
  { code: "BG", name: "Bulgarie", dial: "+359", flag: "🇧🇬" },
  { code: "GR", name: "Grèce", dial: "+30", flag: "🇬🇷" },
  { code: "HR", name: "Croatie", dial: "+385", flag: "🇭🇷" },
  { code: "SI", name: "Slovénie", dial: "+386", flag: "🇸🇮" },
  { code: "EE", name: "Estonie", dial: "+372", flag: "🇪🇪" },
  { code: "LV", name: "Lettonie", dial: "+371", flag: "🇱🇻" },
  { code: "LT", name: "Lituanie", dial: "+370", flag: "🇱🇹" },
  { code: "MT", name: "Malte", dial: "+356", flag: "🇲🇹" },
  { code: "CY", name: "Chypre", dial: "+357", flag: "🇨🇾" },
  { code: "IS", name: "Islande", dial: "+354", flag: "🇮🇸" },
  { code: "LI", name: "Liechtenstein", dial: "+423", flag: "🇱🇮" },
  { code: "MC", name: "Monaco", dial: "+377", flag: "🇲🇨" },
];

const DEFAULT_DIAL = "+41";

/**
 * Splits a stored phone string into its dial code and the local number.
 * Falls back to default Swiss dial if the value has no recognizable prefix.
 */
function parsePhone(value: string | null | undefined): { dial: string; number: string } {
  if (!value) return { dial: DEFAULT_DIAL, number: "" };
  const trimmed = value.trim();
  // Match longest prefix first (some dial codes are 3-4 chars)
  const sortedDials = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of sortedDials) {
    if (trimmed.startsWith(country.dial)) {
      return {
        dial: country.dial,
        number: trimmed.slice(country.dial.length).trim(),
      };
    }
  }
  // Generic fallback: any +XXX prefix
  const match = trimmed.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) return { dial: match[1], number: match[2] };
  return { dial: DEFAULT_DIAL, number: trimmed };
}

interface PhoneInputProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "22 123 45 67",
  id,
  className,
  disabled,
}: PhoneInputProps) {
  const initial = parsePhone(value);
  const [dial, setDial] = useState(initial.dial);
  const [number, setNumber] = useState(initial.number);

  // Keep internal state in sync if the parent updates the value externally
  useEffect(() => {
    const parsed = parsePhone(value);
    setDial(parsed.dial);
    setNumber(parsed.number);
    // We intentionally only depend on `value` — re-syncing on internal state
    // changes would create a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (newDial: string, newNumber: string) => {
    const cleanedNumber = newNumber.trim();
    if (!cleanedNumber) {
      // No number → emit empty so the form considers it not filled
      onChange("");
    } else {
      onChange(`${newDial} ${cleanedNumber}`);
    }
  };

  const handleDialChange = (next: string) => {
    setDial(next);
    emit(next, number);
  };

  const handleNumberChange = (next: string) => {
    setNumber(next);
    emit(dial, next);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={dial} onValueChange={handleDialChange} disabled={disabled}>
        <SelectTrigger className="w-[120px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span>{COUNTRIES.find((c) => c.dial === dial)?.flag ?? "🌍"}</span>
              <span className="font-mono text-sm">{dial}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {COUNTRIES.map((country) => (
            <SelectItem key={country.code} value={country.dial}>
              <span className="flex items-center gap-2">
                <span>{country.flag}</span>
                <span>{country.name}</span>
                <span className="font-mono text-xs text-muted-foreground ml-auto">
                  {country.dial}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}

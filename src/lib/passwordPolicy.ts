/**
 * Password Policy — Politique unifiée pour TOUTE création / modification de
 * mot de passe dans LYTA (reset, change, admin invite, tenant onboarding).
 *
 * Avant cette policy on avait 3 règles différentes :
 *   - ResetPassword : min 6
 *   - CRMParametres : min 8
 *   - KingWizard    : min 8 paramétrable
 * → Incohérence + faiblesse.
 *
 * Choix de politique (juin 2026, validé par Habib pour le chantier sécu) :
 *   - MIN_LENGTH 12 caractères (au lieu de 6/8)
 *   - Au moins 1 minuscule (a-z)
 *   - Au moins 1 majuscule (A-Z)
 *   - Au moins 1 chiffre (0-9)
 *   - Au moins 1 caractère spécial (non alphanumérique)
 *   - Bloque la liste des mots de passe ultra-courants (TOP_COMMON ci-dessous)
 *   - Note : la protection "leaked passwords" (HIBP) est gérée par Supabase
 *     Auth via un toggle dans le Dashboard (à activer manuellement par Habib).
 *
 * Important : on n'applique PAS la policy à l'écran de login (Connexion) —
 * les comptes existants peuvent avoir des mots de passe historiques plus
 * faibles, ils ne doivent pas être bloqués pour se connecter. La policy
 * s'applique uniquement aux flux de CRÉATION ou MODIFICATION.
 */
import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128; // garde-fou DoS

/** Top mots de passe à toujours rejeter (case-insensitive). */
const TOP_COMMON_PASSWORDS = new Set<string>([
  "password",
  "password1",
  "passw0rd",
  "qwerty",
  "qwerty123",
  "azerty",
  "azerty123",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "admin",
  "admin123",
  "welcome",
  "welcome1",
  "letmein",
  "iloveyou",
  "monkey",
  "dragon",
  "abc123",
  "lyta",
  "lyta123",
  "lyta2026",
  "swiss",
  "switzerland",
]);

export type PasswordPolicyCheck = {
  ok: boolean;
  errors: string[];
};

export function checkPasswordPolicy(password: string): PasswordPolicyCheck {
  const errors: string[] = [];
  const pw = password ?? "";

  if (pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Minimum ${PASSWORD_MIN_LENGTH} caractères`);
  }
  if (pw.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Maximum ${PASSWORD_MAX_LENGTH} caractères`);
  }
  if (!/[a-z]/.test(pw)) {
    errors.push("Au moins une minuscule (a-z)");
  }
  if (!/[A-Z]/.test(pw)) {
    errors.push("Au moins une majuscule (A-Z)");
  }
  if (!/[0-9]/.test(pw)) {
    errors.push("Au moins un chiffre (0-9)");
  }
  if (!/[^A-Za-z0-9]/.test(pw)) {
    errors.push("Au moins un caractère spécial (!@#$%…)");
  }
  // Blocklist : on compare lowercased + trim pour attraper les variantes
  const normalized = pw.trim().toLowerCase();
  if (TOP_COMMON_PASSWORDS.has(normalized)) {
    errors.push("Mot de passe trop courant — choisis-en un unique");
  }

  return { ok: errors.length === 0, errors };
}

/** Schéma Zod réutilisable pour intégration dans react-hook-form / shadcn. */
export const passwordPolicyZod = z
  .string()
  .superRefine((val, ctx) => {
    const { errors } = checkPasswordPolicy(val);
    for (const msg of errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
    }
  });

/**
 * Petit utilitaire pour mesurer la force visuellement (0 → 4).
 * Utilisé par les indicateurs UI (barre de force) sans imposer la lib zxcvbn.
 */
export function scorePasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  const pw = password ?? "";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= PASSWORD_MIN_LENGTH) score++;
  const classes =
    (/[a-z]/.test(pw) ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  if (classes >= 3) score++;
  if (classes === 4 && pw.length >= 16) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

export function normalizeEmail(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

// Match backend: Gmail-only addresses with a basic local-part check
const EMAIL_REGEX = /^[^@\s]+@gmail\.com$/i;

export function isValidEmailForBackend(value) {
  const norm = normalizeEmail(value);
  if (!norm) return false;
  return EMAIL_REGEX.test(norm);
}

// Strong password (backend rules for registration): at least 8 chars, 1 uppercase letter, 1 number, 1 special character
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function isStrongPassword(value) {
  if (!value) return false;
  return STRONG_PASSWORD_REGEX.test(String(value));
}

export function passwordStrengthLevel(pwd) {
  if (!pwd || pwd.length < 8) return 'weak';
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  if (hasUpper && hasNumber && hasSpecial && pwd.length >= 10) return 'strong';
  if ((hasUpper && hasNumber) || (hasNumber && hasSpecial) || (hasUpper && hasSpecial)) return 'medium';
  return 'weak';
}
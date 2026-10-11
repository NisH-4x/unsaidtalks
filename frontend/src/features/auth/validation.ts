// Mirrors the server rules so people get instant feedback; the server remains the authority.

export function validateName(value: string): string | undefined {
  const length = value.trim().length;
  return length >= 2 && length <= 60 ? undefined : 'Enter your full name (2–60 characters)';
}

export function validateEmail(value: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? undefined
    : 'Enter a valid email address';
}

export function validateNewPassword(value: string): string | undefined {
  if (value.length < 8 || value.length > 64) return 'Use 8 to 64 characters';
  if (!/[A-Za-z]/.test(value)) return 'Include at least one letter';
  if (!/\d/.test(value)) return 'Include at least one number';
  return undefined;
}

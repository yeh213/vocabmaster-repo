export function groupIdFromWord(word) {
  const letter = (word ?? '').charAt(0).toLowerCase();
  return /^[a-z]$/.test(letter) ? `letter-${letter}` : null;
}

export function newId() {
  return crypto.randomUUID();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

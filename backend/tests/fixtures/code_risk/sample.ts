// Scanner fixture only; never execute.
export function unsafe(value: string) { return eval(value); }
export function safe(value: string) { return Number(value); }

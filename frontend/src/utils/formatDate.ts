const DAY_MS = 24 * 60 * 60 * 1000;

export const formatDate = (value: string) => {
  const date = new Date(value);
  const elapsedMs = Date.now() - date.getTime();
  const isRecent = elapsedMs >= 0 && elapsedMs < DAY_MS;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(isRecent ? { timeStyle: "short" } : {}),
  }).format(date);
};

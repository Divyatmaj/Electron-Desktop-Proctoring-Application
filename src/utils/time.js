function pad(value) {
  return value.toString().padStart(2, "0");
}

// 3725000 -> "01:02:05"
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// 3725000 -> "1 h 2 min 5 s", 65000 -> "1 min 5 s"
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours} h`);
  if (minutes) parts.push(`${minutes} min`);
  if (seconds || parts.length === 0) parts.push(`${seconds} s`);

  return parts.join(" ");
}

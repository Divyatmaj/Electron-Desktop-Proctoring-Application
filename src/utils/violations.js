const LABELS = {
  "focus-lost": "Left the Athena window",
  "fullscreen-exited": "Exited full screen",
  "camera-lost": "Camera disconnected",
  "app-restarted": "Athena was closed and reopened",
};

export function describeViolation(type) {
  return LABELS[type] ?? "Unknown event";
}

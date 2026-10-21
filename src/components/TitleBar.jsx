import { CloseIcon, MinimizeIcon } from "./Icons";

// The window is frameless, so this bar doubles as the drag handle and holds
// our own minimize/close buttons (hidden while an exam is running).
function TitleBar({ subtitle, showControls }) {
  return (
    <header className="titlebar">
      <span className="titlebar-brand">Athena</span>

      {subtitle && <span className="titlebar-subtitle">{subtitle}</span>}

      {showControls && (
        <div className="titlebar-controls">
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => window.electronAPI.minimizeWindow()}
          >
            <MinimizeIcon />
          </button>

          <button
            type="button"
            aria-label="Close"
            className="titlebar-close"
            onClick={() => window.electronAPI.quitApp()}
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </header>
  );
}

export default TitleBar;

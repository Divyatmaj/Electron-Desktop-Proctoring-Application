import { useEffect, useState } from "react";
import CameraPreview from "./CameraPreview";
import HelpDialog from "./HelpDialog";
import { CheckIcon } from "./Icons";

function describeCameraError(error) {
  switch (error?.name) {
    case "NotAllowedError":
      return "Camera access was blocked. Allow Athena to use the camera in your system privacy settings, then try again.";
    case "NotFoundError":
      return "No camera was found. Connect one and try again.";
    case "NotReadableError":
      return "Your camera is busy in another app. Close that app and try again.";
    default:
      return "The camera couldn't be started. Try again, or open Help below.";
  }
}

function Step({ number, done, title, description, children }) {
  return (
    <li className={`step ${done ? "is-done" : ""}`}>
      <span className="step-marker" aria-hidden="true">
        {done ? <CheckIcon /> : number}
      </span>

      <div className="step-body">
        <div className="step-heading">
          <h3>{title}</h3>
          <span className={`badge ${done ? "badge-ok" : ""}`}>
            {done ? "Ready" : "Not done"}
          </span>
        </div>

        <p className="step-description">{description}</p>

        {children}
      </div>
    </li>
  );
}

function SetupScreen({ examInfo, stream, onCameraReady, onStart }) {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(null);

  // Kept live, so the step ticks itself off as soon as an extra monitor is
  // unplugged.
  useEffect(() => {
    if (!examInfo.requireSingleDisplay) return;

    window.electronAPI.getDisplayCount().then(setDisplayCount);
    return window.electronAPI.onDisplaysChanged(setDisplayCount);
  }, [examInfo.requireSingleDisplay]);

  const detailsReady = name.trim() !== "" && rollNumber.trim() !== "";
  const cameraReady = stream !== null;
  const singleDisplay = displayCount === 1;
  const checks = [detailsReady, cameraReady, fullscreen, agreed];
  if (examInfo.requireSingleDisplay) checks.push(singleDisplay);
  const doneCount = checks.filter(Boolean).length;
  const canStart = doneCount === checks.length && !starting;
  const firstName = name.trim().split(" ")[0];

  async function requestCamera() {
    setCameraLoading(true);
    setCameraError(null);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      onCameraReady(newStream);
    } catch (error) {
      setCameraError(describeCameraError(error));
    } finally {
      setCameraLoading(false);
    }
  }

  async function enterFullscreen() {
    const isOn = await window.electronAPI.setFullScreen();
    setFullscreen(Boolean(isOn));
  }

  async function start() {
    setStarting(true);

    const started = await onStart({
      name: name.trim(),
      rollNumber: rollNumber.trim(),
    });
    if (!started) setStarting(false);
  }

  const minutes = Math.round(examInfo.durationMs / 60000);

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <h1>{examInfo.title}</h1>
        <p className="page-meta">
          {examInfo.totalQuestions} questions · {minutes} minutes
        </p>
        <p className="page-lede">
          {detailsReady ? `Hi ${firstName}! ` : ""}Finish the {checks.length}{" "}
          checks below. You can start once they're all done.
        </p>
      </header>

      <ol className="steps">
        <Step
          number={1}
          done={detailsReady}
          title="Your details"
          description="These go on your result so your invigilator can match it to you."
        >
          <div className="fields">
            <label className="field">
              <span className="field-label">Full name</span>
              <input
                type="text"
                className="field-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                autoComplete="name"
                disabled={starting}
              />
            </label>

            <label className="field">
              <span className="field-label">Roll number</span>
              <input
                type="text"
                className="field-input"
                value={rollNumber}
                onChange={(event) => setRollNumber(event.target.value)}
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
                disabled={starting}
              />
            </label>
          </div>
        </Step>

        <Step
          number={2}
          done={cameraReady}
          title="Camera"
          description="Your camera stays on for the whole test so the session can be reviewed later."
        >
          {cameraReady ? (
            <CameraPreview stream={stream} className="setup-preview" />
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={requestCamera}
              disabled={cameraLoading}
            >
              {cameraLoading ? "Waiting for camera…" : "Turn on camera"}
            </button>
          )}

          {cameraError && (
            <p className="inline-error" role="alert">
              {cameraError}
            </p>
          )}
        </Step>

        <Step
          number={3}
          done={fullscreen}
          title="Full screen"
          description="Close other windows first. Athena will fill the screen and stay there until you submit."
        >
          {!fullscreen && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={enterFullscreen}
            >
              Enter full screen
            </button>
          )}
        </Step>

        {examInfo.requireSingleDisplay && (
          <Step
            number={4}
            done={singleDisplay}
            title="One screen"
            description="Only one display can be connected during the test. Plugging one in while the test is running counts as a warning."
          >
            {displayCount > 1 && (
              <p className="inline-error" role="alert">
                {displayCount} displays are connected. Unplug the extra ones
                (or turn off screen mirroring) to continue.
              </p>
            )}
          </Step>
        )}

        <Step
          number={examInfo.requireSingleDisplay ? 5 : 4}
          done={agreed}
          title="Exam rules"
          description="Read these before you begin."
        >
          <ul className="rules">
            {examInfo.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>I've read the rules and agree to follow them.</span>
          </label>
        </Step>
      </ol>

      <footer className="setup-footer">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setHelpOpen(true)}
        >
          Need help?
        </button>

        <div className="setup-footer-end">
          <span className="setup-progress">{doneCount} of {checks.length} ready</span>

          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={start}
            disabled={!canStart}
          >
            {starting ? "Starting…" : "Start test"}
          </button>
        </div>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export default SetupScreen;

import { useState } from "react";
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
  const [cameraError, setCameraError] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const cameraReady = stream !== null;
  const doneCount = [cameraReady, fullscreen, agreed].filter(Boolean).length;
  const canStart = doneCount === 3 && !starting;

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
    await onStart();
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
          Finish the three checks below. You can start once they're all done.
        </p>
      </header>

      <ol className="steps">
        <Step
          number={1}
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
          number={2}
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

        <Step
          number={3}
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
          <span className="setup-progress">{doneCount} of 3 ready</span>

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

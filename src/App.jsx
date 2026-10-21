import { useEffect, useRef, useState } from "react";
import "./App.css";
import MainExam from "./components/MainExam";

const SNAPSHOT_INTERVAL_MS = 1000;

function formatTimeLeft(ms) {
  const seconds = Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0");

  const minutes = Math.floor((ms / (1000 * 60)) % 60)
    .toString()
    .padStart(2, "0");

  const hours = Math.floor(ms / (1000 * 60 * 60))
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!started) return;

    async function refreshTime() {
      const remaining = await window.electronAPI.getRemainingTime();
      setTime(remaining);
    }

    refreshTime();
    const interval = setInterval(refreshTime, 1000);

    return () => clearInterval(interval);
  }, [started]);

  useEffect(() => {
    if (!started) return;

    async function takePhoto() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) return;
      if (video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      const image = canvas.toDataURL("image/png");
      await window.electronAPI.savePhoto(image);
    }

    const interval = setInterval(takePhoto, SNAPSHOT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [started]);

  async function getCamera() {
    const videoData = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    videoRef.current.srcObject = videoData;

    setCameraReady(true);
  }

  async function getFullscreen() {
    await window.electronAPI.setFullScreen();
  }

  async function startTest() {
    const res = await window.electronAPI.showRules();

    if (res === 0) {
      await window.electronAPI.startTest();

      setStarted(true);
    }
  }

  return (
    <>
      {/*
        The video stays mounted for the whole session so snapshots keep
        working; once the exam starts it is only hidden.
      */}
      <video
        ref={videoRef}
        autoPlay
        muted
        className={cameraReady && !started ? "video-preview" : "hidden-video"}
      />

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {started ? (
        <MainExam time={formatTimeLeft(time)} />
      ) : (
        <div className="page-container">
          <div className="header-section">
            <h1>Hi User!</h1>

            <p>Kindly Allow the following Permissions to Start the test:</p>
          </div>

          <div className="card-container">
            {/* Camera */}

            <div className="permission-item">
              <div className="permission-icon">↗</div>

              <div className="permission-content">
                <h3>Configure Camera</h3>

                <p>Kindly configure Camera to attempt quiz/contests.</p>

                <div className="action-row">
                  <button onClick={getCamera} className="btn btn-dark">
                    Get Camera Access
                  </button>
                </div>

                {cameraReady && <div className="camera-space" />}
              </div>
            </div>

            <div className="divider" />

            {/* Fullscreen */}

            <div className="permission-item">
              <div className="permission-icon">⛶</div>

              <div className="permission-content">
                <h3>Switch to full screen</h3>

                <p>Kindly close all tabs and switch to full screen.</p>

                <button onClick={getFullscreen} className="btn btn-light-blue">
                  Give Full Screen Permissions
                </button>
              </div>
            </div>
          </div>

          <div className="bottom-actions">
            <button onClick={startTest} className="btn btn-light-blue">
              Go To Test
            </button>

            <button className="btn btn-outline">Need Help?</button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import MainExam from "./components/MainExam";
import Results from "./components/Results";
import SetupScreen from "./components/SetupScreen";
import TitleBar from "./components/TitleBar";

const SNAPSHOT_INTERVAL_MS = 1000;

function App() {
  // Hidden video + canvas used only for snapshots; visible previews are
  // separate <CameraPreview> elements fed from the same stream.
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // "setup" -> "exam" -> "results"
  const [stage, setStage] = useState("setup");
  const [examInfo, setExamInfo] = useState(null);
  const [stream, setStream] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    window.electronAPI.getExamInfo().then(setExamInfo);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (stage !== "exam") return;

    async function refreshTime() {
      const remaining = await window.electronAPI.getRemainingTime();
      setTimeLeft(remaining);
    }

    refreshTime();
    const interval = setInterval(refreshTime, 1000);

    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== "exam") return;

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
  }, [stage]);

  // Release the webcam once the exam is over so the camera light turns off.
  useEffect(() => {
    if (stage !== "results") return;

    stream?.getTracks().forEach((track) => track.stop());
  }, [stage, stream]);

  async function startTest() {
    await window.electronAPI.startTest();
    setStage("exam");
  }

  const handleSubmitted = useCallback((examResult) => {
    setResult(examResult);
    setStage("results");
  }, []);

  return (
    <div className="app">
      <TitleBar
        subtitle={stage === "exam" ? "Exam in progress" : null}
        showControls={stage !== "exam"}
      />

      <main className="app-main">
        {examInfo && stage === "setup" && (
          <SetupScreen
            examInfo={examInfo}
            stream={stream}
            onCameraReady={setStream}
            onStart={startTest}
          />
        )}

        {examInfo && stage === "exam" && (
          <MainExam
            examInfo={examInfo}
            stream={stream}
            timeLeftMs={timeLeft}
            onSubmitted={handleSubmitted}
          />
        )}

        {stage === "results" && result && <Results result={result} />}
      </main>

      <video ref={videoRef} className="capture-video" autoPlay muted />
      <canvas ref={canvasRef} hidden />
    </div>
  );
}

export default App;

import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import MainExam from "./components/MainExam";
import Results from "./components/Results";
import SetupScreen from "./components/SetupScreen";
import TitleBar from "./components/TitleBar";

const SNAPSHOT_QUALITY = 0.8;

function App() {
  // Hidden video + canvas used only for snapshots; visible previews are
  // separate <CameraPreview> elements fed from the same stream.
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // "setup" -> "exam" -> "results"
  const [stage, setStage] = useState("setup");
  const [examInfo, setExamInfo] = useState(null);
  const [student, setStudent] = useState(null);
  const [stream, setStream] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [result, setResult] = useState(null);
  // Answers and flags saved in the main process, used to restore the exam
  // screen if the window reloads mid-test.
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [info, session] = await Promise.all([
        window.electronAPI.getExamInfo(),
        window.electronAPI.getSession(),
      ]);
      if (cancelled) return;

      setExamInfo(info);

      if (session.status === "finished") {
        setResult(session.result);
        setStage("results");
      } else if (session.status === "running") {
        setStudent(session.student);
        setProgress({ answers: session.answers, flagged: session.flagged });
        setStage("exam");
        resumeCamera();
      }
    }

    // Camera permission was already granted before the reload, so this
    // normally succeeds without asking. If it doesn't, that's logged.
    async function resumeCamera() {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (!cancelled) setStream(newStream);
      } catch {
        window.electronAPI.reportViolation("camera-lost");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
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
    if (stage !== "exam" || !examInfo) return;

    async function takePhoto() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) return;
      if (video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      const image = canvas.toDataURL("image/jpeg", SNAPSHOT_QUALITY);
      await window.electronAPI.savePhoto(image);
    }

    const interval = setInterval(takePhoto, examInfo.snapshotIntervalMs);

    return () => clearInterval(interval);
  }, [stage, examInfo]);

  // Release the webcam once the exam is over so the camera light turns off.
  useEffect(() => {
    if (stage !== "results") return;

    stream?.getTracks().forEach((track) => track.stop());
  }, [stage, stream]);

  async function startTest(details) {
    const sessionId = await window.electronAPI.startTest(details);
    if (!sessionId) return false;

    setStudent(details);
    setProgress({ answers: {}, flagged: [] });
    setStage("exam");
    return true;
  }

  const handleSubmitted = useCallback((examResult) => {
    setResult(examResult);
    setStage("results");
  }, []);

  // The main process ends the exam itself on timeout or too many warnings.
  useEffect(() => window.electronAPI.onExamFinished(handleSubmitted), [
    handleSubmitted,
  ]);

  return (
    <div className="app">
      <TitleBar
        subtitle={
          stage === "exam" ? `Exam in progress · ${student.name}` : null
        }
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

        {examInfo && stage === "exam" && progress && (
          <MainExam
            examInfo={examInfo}
            initialProgress={progress}
            stream={stream}
            timeLeftMs={timeLeft}
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

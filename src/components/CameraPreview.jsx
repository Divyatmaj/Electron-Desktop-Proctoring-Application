import { useEffect, useRef } from "react";

// Shows a live, mirrored view of a camera stream. Each preview gets its own
// <video> so it can sit anywhere in the layout without affecting capture.
function CameraPreview({ stream, className = "" }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className={`camera-preview ${className}`}
      autoPlay
      muted
      playsInline
    />
  );
}

export default CameraPreview;

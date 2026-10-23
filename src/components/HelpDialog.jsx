import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";

const TOPICS = [
  {
    title: "What to enter under “Your details”",
    body: [
      "Use your full name and roll number exactly as they appear on your college ID. Your result and camera snapshots are filed under them.",
    ],
  },
  {
    title: "The camera won't turn on",
    body: [
      "Close other apps that might be using it, such as Zoom, Teams or FaceTime.",
      "On macOS, open System Settings › Privacy & Security › Camera and allow Athena (or Electron while developing).",
      "On Windows, open Settings › Privacy & security › Camera and turn on camera access for desktop apps.",
      "Then press “Turn on camera” again.",
    ],
  },
  {
    title: "Full screen didn't work",
    body: [
      "Press “Enter full screen” once more. If the window still isn't full screen, restart Athena and try again.",
    ],
  },
  {
    title: "During the test",
    body: [
      "Your answers are kept as you move between questions, and you can jump to any question from the panel on the right.",
      "Use A–D or 1–4 to pick an option and the arrow keys to move between questions.",
      "Not sure about an answer? Press “Mark for review” (or F) to flag it. Flagged questions get a dot in the question panel, and “Clear answer” removes your choice.",
      "Every answer is saved as soon as you pick it. If Athena closes unexpectedly, open it again to carry on: your answers and the timer are kept, and the restart is logged as a warning.",
      "You can't close Athena during the test. Use End Test to submit.",
      "If time runs out, whatever you've answered is submitted automatically.",
      "Switching to another window, leaving full screen or losing the camera shows a warning and is logged. After the last warning your test is submitted for you.",
    ],
  },
  {
    title: "Still stuck?",
    body: [
      "Raise your hand or message your invigilator before starting. Don't start the test until everything above is working.",
    ],
  },
];

function HelpDialog({ open, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="help-dialog"
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="help-dialog-inner">
        <div className="help-dialog-header">
          <h2>Help</h2>

          <button
            type="button"
            className="icon-btn"
            aria-label="Close help"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        {TOPICS.map((topic) => (
          <section key={topic.title} className="help-topic">
            <h3>{topic.title}</h3>
            {topic.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ))}
      </div>
    </dialog>
  );
}

export default HelpDialog;

import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";

const TOPICS = [
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
      "If time runs out, whatever you've answered is submitted automatically.",
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

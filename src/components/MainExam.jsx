import { useEffect, useRef, useState } from "react";
import CameraPreview from "./CameraPreview";
import { ArrowLeftIcon, ArrowRightIcon, FlagIcon } from "./Icons";
import { formatClock } from "../utils/time";
import { describeViolation } from "../utils/violations";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
const LOW_TIME_MS = 5 * 60 * 1000;

function MainExam({ examInfo, initialProgress, stream, timeLeftMs }) {
  const totalQuestions = examInfo.totalQuestions;

  const [questionId, setQuestionId] = useState(1);
  const [question, setQuestion] = useState(null);
  // { [questionId]: selectedOptionIndex }. Every change is also saved in the
  // main process, which grades from its own copy.
  const [answers, setAnswers] = useState(initialProgress.answers);
  const [flagged, setFlagged] = useState(() => new Set(initialProgress.flagged));
  const [submitting, setSubmitting] = useState(false);
  // Latest { violation, count, max } from the main process, shown as a banner.
  const [warning, setWarning] = useState(null);

  // A ref rather than state so a double click on Submit can't send twice.
  const submittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestion() {
      const data = await window.electronAPI.getQuestion(questionId);
      if (!cancelled) setQuestion(data);
    }

    loadQuestion();

    return () => {
      cancelled = true;
    };
  }, [questionId]);

  // The main process ends the exam on its own when the warning limit is
  // reached; App switches to the results screen when it hears about it.
  useEffect(() => {
    return window.electronAPI.onViolation((data) => {
      setWarning(data);
      if (data.limitReached) setSubmitting(true);
    });
  }, []);

  // A camera that's unplugged or taken by another app ends its track.
  useEffect(() => {
    if (!stream) return;

    const tracks = stream.getVideoTracks();
    const onEnded = () => window.electronAPI.reportViolation("camera-lost");

    tracks.forEach((track) => track.addEventListener("ended", onEnded));
    return () =>
      tracks.forEach((track) => track.removeEventListener("ended", onEnded));
  }, [stream]);

  // Keyboard: A–D / 1–4 pick an option, ←/→ move between questions.
  useEffect(() => {
    function onKeyDown(event) {
      if (submitting || !question) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toUpperCase();
      // Arrow keys on a focused radio already move the selection natively.
      const onRadio = event.target instanceof HTMLInputElement;

      if (key === "ARROWRIGHT" && !onRadio && questionId < totalQuestions) {
        setQuestionId(questionId + 1);
        return;
      }

      if (key === "ARROWLEFT" && !onRadio && questionId > 1) {
        setQuestionId(questionId - 1);
        return;
      }

      let index = OPTION_LETTERS.indexOf(key);
      if (index === -1 && /^[1-9]$/.test(key)) index = Number(key) - 1;

      if (key === "F" && !event.repeat) {
        toggleFlag(question.id);
        return;
      }

      if (index >= 0 && index < question.options.length) {
        chooseAnswer(question.id, index);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [question, questionId, totalQuestions, submitting]);

  function chooseAnswer(id, index) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (index === null) delete next[id];
      else next[id] = index;
      return next;
    });
    window.electronAPI.saveAnswer(id, index);
  }

  function toggleFlag(id) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.electronAPI.setFlag(id, next.has(id));
      return next;
    });
  }

  function goTo(id) {
    if (id < 1 || id > totalQuestions) return;
    setQuestionId(id);
  }

  async function endTest() {
    const confirmed = await window.electronAPI.confirmEndTest();
    if (!confirmed || submittedRef.current) return;

    submittedRef.current = true;
    setSubmitting(true);
    await window.electronAPI.submitTest();
  }

  const answeredCount = Object.keys(answers).length;
  const selectedOption = answers[questionId] ?? null;
  const isFlagged = flagged.has(questionId);
  const isLastQuestion = questionId === totalQuestions;
  const isLowOnTime = timeLeftMs !== null && timeLeftMs < LOW_TIME_MS;
  // Only render the question once it matches the current id, so a slow
  // load never shows the previous question's text under the new number.
  const shownQuestion = question?.id === questionId ? question : null;

  return (
    <div className="exam">
      <div className="exam-bar">
        <div>
          <h1 className="exam-title">{examInfo.title}</h1>
          <p className="exam-progress">
            {answeredCount} of {totalQuestions} answered
            {flagged.size > 0 && ` · ${flagged.size} marked for review`}
          </p>
        </div>

        <div className="exam-bar-end">
          <span
            className={`timer ${isLowOnTime ? "is-low" : ""}`}
            aria-label="Time left"
          >
            {timeLeftMs === null ? "--:--:--" : formatClock(timeLeftMs)}
          </span>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={endTest}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "End test"}
          </button>
        </div>
      </div>

      {warning && (
        <div className="exam-warning" role="alert">
          <div>
            <p className="exam-warning-title">
              {describeViolation(warning.violation.type)}. This has been
              logged.
            </p>
            <p className="exam-warning-detail">
              {warning.limitReached
                ? "You've reached the warning limit, so your test is being submitted."
                : `Warning ${warning.count} of ${warning.max}. At ${warning.max} your test is submitted automatically.`}
            </p>
          </div>

          {!warning.limitReached && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setWarning(null)}
            >
              I understand
            </button>
          )}
        </div>
      )}

      <div className="exam-body">
        <section className="question-card" aria-live="polite">
          {shownQuestion && (
            <>
              <p className="question-number">
                Question {questionId} of {totalQuestions}
              </p>

              <h2 className="question-text">{shownQuestion.question}</h2>

              <div
                className="options"
                role="radiogroup"
                aria-label={`Options for question ${questionId}`}
              >
                {shownQuestion.options.map((option, index) => (
                  <label
                    key={index}
                    className={`option ${selectedOption === index ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      className="visually-hidden"
                      name={`answer-${questionId}`}
                      checked={selectedOption === index}
                      onChange={() => chooseAnswer(questionId, index)}
                      disabled={submitting}
                    />
                    <span className="option-key">{OPTION_LETTERS[index]}</span>
                    <span className="option-text">{option}</span>
                  </label>
                ))}
              </div>

              <div className="question-tools">
                <button
                  type="button"
                  className={`btn btn-ghost flag-toggle ${isFlagged ? "is-on" : ""}`}
                  onClick={() => toggleFlag(questionId)}
                  aria-pressed={isFlagged}
                  disabled={submitting}
                >
                  <FlagIcon />
                  {isFlagged ? "Marked for review" : "Mark for review"}
                </button>

                {selectedOption !== null && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => chooseAnswer(questionId, null)}
                    disabled={submitting}
                  >
                    Clear answer
                  </button>
                )}
              </div>

              <div className="question-nav">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => goTo(questionId - 1)}
                  disabled={questionId === 1}
                >
                  <ArrowLeftIcon /> Previous
                </button>

                {isLastQuestion ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={endTest}
                    disabled={submitting}
                  >
                    Finish
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => goTo(questionId + 1)}
                  >
                    Next <ArrowRightIcon />
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="exam-aside">
          <div className="aside-block">
            <div className="camera-frame">
              {stream && <CameraPreview stream={stream} />}
              <span className="recording">
                <span className="recording-dot" aria-hidden="true" />
                Recording
              </span>
            </div>
          </div>

          <div className="aside-block">
            <h2 className="aside-heading">Questions</h2>

            <div className="palette">
              {Array.from({ length: totalQuestions }, (_, i) => i + 1).map(
                (id) => (
                  <button
                    key={id}
                    type="button"
                    className={[
                      "palette-item",
                      id === questionId && "is-current",
                      answers[id] !== undefined && "is-answered",
                      flagged.has(id) && "is-flagged",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => goTo(id)}
                    aria-current={id === questionId ? "step" : undefined}
                    aria-label={`Question ${id}${answers[id] !== undefined ? ", answered" : ""}${flagged.has(id) ? ", marked for review" : ""}`}
                  >
                    {id}
                  </button>
                ),
              )}
            </div>

            <ul className="legend">
              <li>
                <span className="legend-swatch is-answered" /> Answered
              </li>
              <li>
                <span className="legend-swatch" /> Not answered
              </li>
              <li>
                <span className="legend-swatch is-flagged" /> Review
              </li>
            </ul>
          </div>

          <p className="shortcut-hint">
            <kbd>A</kbd>–<kbd>D</kbd> choose · <kbd>F</kbd> flag ·{" "}
            <kbd>←</kbd> <kbd>→</kbd> move
          </p>
        </aside>
      </div>
    </div>
  );
}

export default MainExam;

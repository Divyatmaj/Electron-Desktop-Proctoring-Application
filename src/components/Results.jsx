import { useState } from "react";
import { formatClock, formatDuration } from "../utils/time";
import { describeViolation } from "../utils/violations";

const REASON_TEXT = {
  manual: "Your answers have been recorded. You can close Athena now.",
  timeout: "Time ran out, so your answers were submitted automatically.",
  violations:
    "Your test was submitted automatically because the warning limit was reached.",
};

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "correct", label: "Correct", test: (item) => item.isCorrect },
  {
    id: "incorrect",
    label: "Incorrect",
    test: (item) => !item.isCorrect && item.selected !== null,
  },
  { id: "skipped", label: "Skipped", test: (item) => item.selected === null },
  { id: "flagged", label: "Marked", test: (item) => item.flagged },
];

function Results({ result }) {
  const [filter, setFilter] = useState("all");

  const percent = Math.round((result.score / result.total) * 100);
  const unanswered = result.total - result.answered;
  const activeFilter = FILTERS.find((f) => f.id === filter);
  // Keep each question's original number when the list is filtered.
  const shownItems = result.review
    .map((item, index) => ({ item, number: index + 1 }))
    .filter(({ item }) => activeFilter.test(item));

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <h1>Test submitted</h1>
        <p className="page-meta">
          {result.student.name} · Roll no. {result.student.rollNumber}
        </p>
        <p className="page-lede">
          {REASON_TEXT[result.reason] ?? REASON_TEXT.manual}
        </p>
      </header>

      <section className="card results-summary">
        <div className="results-score">
          <span className="results-score-value">
            {result.score}
            <span className="results-score-total"> / {result.total}</span>
          </span>
          <span className="results-score-percent">{percent}%</span>
        </div>

        <dl className="results-stats">
          <div>
            <dt>Answered</dt>
            <dd>{result.answered}</dd>
          </div>
          <div>
            <dt>Unanswered</dt>
            <dd>{unanswered}</dd>
          </div>
          <div>
            <dt>Time taken</dt>
            <dd>{formatDuration(result.durationMs)}</dd>
          </div>
          <div>
            <dt>Snapshots</dt>
            <dd>{result.snapshotCount}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{result.violations.length}</dd>
          </div>
        </dl>

        <div className="results-session">
          <p>
            Session ID <code>{result.sessionId}</code>
          </p>

          <div className="results-files">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.electronAPI.openSnapshotsFolder()}
            >
              Open snapshots folder
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.electronAPI.showResultFile()}
            >
              Show result file
            </button>
          </div>
        </div>
      </section>

      {result.violations.length > 0 && (
        <>
          <h2 className="section-heading">Logged events</h2>

          <ol className="card incident-list">
            {result.violations.map((violation, index) => (
              <li key={index} className="incident">
                <span className="incident-time">
                  {formatClock(violation.at - result.startedAt)}
                </span>
                <span>{describeViolation(violation.type)}</span>
                {violation.snapshot && (
                  <button
                    type="button"
                    className="btn btn-ghost incident-photo"
                    onClick={() =>
                      window.electronAPI.openWarningPhoto(index + 1)
                    }
                  >
                    View photo
                  </button>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <h2 className="section-heading">Review</h2>

      <div className="filter-bar" role="group" aria-label="Filter questions">
        {FILTERS.map((f) => {
          const count = result.review.filter(f.test).length;
          if (f.id === "flagged" && count === 0) return null;

          return (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${filter === f.id ? "is-active" : ""}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {shownItems.length === 0 && (
        <p className="review-empty">No questions in this group.</p>
      )}

      <ol className="review-list">
        {shownItems.map(({ item, number }) => (
          <li
            key={item.id}
            className={`review-item ${item.isCorrect ? "is-correct" : "is-incorrect"}`}
          >
            <div className="review-item-head">
              <span className="review-number">{number}</span>
              <p className="review-question">{item.question}</p>
              {item.flagged && (
                <span className="badge badge-flag">Marked</span>
              )}
              {item.isCorrect ? (
                <span className="badge badge-ok">Correct</span>
              ) : item.selected === null ? (
                <span className="badge">Skipped</span>
              ) : (
                <span className="badge badge-bad">Incorrect</span>
              )}
            </div>

            <p className="review-answer">
              Your answer:{" "}
              <strong>
                {item.selected === null
                  ? "Not answered"
                  : item.options[item.selected]}
              </strong>
            </p>

            {!item.isCorrect && (
              <p className="review-answer">
                Correct answer: <strong>{item.options[item.correct]}</strong>
              </p>
            )}
          </li>
        ))}
      </ol>

      <footer className="results-footer">
        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={() => window.electronAPI.quitApp()}
        >
          Close Athena
        </button>
      </footer>
    </div>
  );
}

export default Results;

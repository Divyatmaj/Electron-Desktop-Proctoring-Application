import { formatClock, formatDuration } from "../utils/time";
import { describeViolation } from "../utils/violations";

const REASON_TEXT = {
  manual: "Your answers have been recorded. You can close Athena now.",
  timeout: "Time ran out, so your answers were submitted automatically.",
  violations:
    "Your test was submitted automatically because the warning limit was reached.",
};

function Results({ result }) {
  const percent = Math.round((result.score / result.total) * 100);
  const unanswered = result.total - result.answered;

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

        <p className="results-session">
          Session ID <code>{result.sessionId}</code>
        </p>
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
              </li>
            ))}
          </ol>
        </>
      )}

      <h2 className="section-heading">Review</h2>

      <ol className="review-list">
        {result.review.map((item, index) => (
          <li
            key={item.id}
            className={`review-item ${item.isCorrect ? "is-correct" : "is-incorrect"}`}
          >
            <div className="review-item-head">
              <span className="review-number">{index + 1}</span>
              <p className="review-question">{item.question}</p>
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

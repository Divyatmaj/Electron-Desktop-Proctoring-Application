import { formatDuration } from "../utils/time";

function Results({ result }) {
  const percent = Math.round((result.score / result.total) * 100);
  const unanswered = result.total - result.answered;

  return (
    <div className="exam-page">
      <div className="exam-container">
        <div className="results-card">
          <p className="results-eyebrow">
            {result.reason === "timeout"
              ? "Time ran out, so your test was submitted automatically."
              : "Your test has been submitted."}
          </p>

          <div className="results-score">
            <span className="results-score-value">
              {result.score}/{result.total}
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
          </dl>
        </div>

        <h3 className="review-heading">Review</h3>

        <ol className="review-list">
          {result.review.map((item) => (
            <li
              key={item.id}
              className={`review-item ${item.isCorrect ? "correct" : "incorrect"}`}
            >
              <p className="review-question">{item.question}</p>

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

        <div className="bottom-actions">
          <button
            className="btn btn-dark"
            onClick={() => window.electronAPI.quitApp()}
          >
            Close Athena
          </button>
        </div>
      </div>
    </div>
  );
}

export default Results;

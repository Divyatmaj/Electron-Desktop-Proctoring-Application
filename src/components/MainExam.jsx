import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock } from "../utils/time";

function MainExam({ timeLeftMs, onSubmitted }) {
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionId, setQuestionId] = useState(1);
  const [question, setQuestion] = useState(null);
  // { [questionId]: selectedOptionIndex }
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // A ref rather than state so a timeout and a manual submit that land at
  // the same moment can't both go through.
  const submittedRef = useRef(false);

  useEffect(() => {
    async function loadExamInfo() {
      const info = await window.electronAPI.getExamInfo();
      setTotalQuestions(info.totalQuestions);
    }

    loadExamInfo();
  }, []);

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

  const submit = useCallback(
    async (reason) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      const result = await window.electronAPI.submitTest(answers, reason);
      onSubmitted(result);
    },
    [answers, onSubmitted],
  );

  useEffect(() => {
    if (timeLeftMs === 0) submit("timeout");
  }, [timeLeftMs, submit]);

  function selectOption(index) {
    setAnswers((prev) => ({ ...prev, [questionId]: index }));
  }

  function goTo(id) {
    if (id < 1 || id > totalQuestions) return;
    setQuestionId(id);
  }

  async function endTest() {
    const unanswered = totalQuestions - Object.keys(answers).length;
    const confirmed = await window.electronAPI.confirmEndTest(unanswered);

    if (confirmed) submit("manual");
  }

  const selectedOption = answers[questionId] ?? null;
  const isLastQuestion = questionId === totalQuestions;
  const isLowOnTime = timeLeftMs !== null && timeLeftMs < 5 * 60 * 1000;

  return (
    <div className="exam-page">
      <div className="exam-container">
        {/* Exam Header */}

        <div className="exam-header">
          <h3 className={isLowOnTime ? "time-low" : undefined}>
            Time Left: {timeLeftMs === null ? "--:--:--" : formatClock(timeLeftMs)}
          </h3>

          <button
            className="end-test-btn"
            onClick={endTest}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "End Test"}
          </button>
        </div>

        {/* Question palette */}

        <div className="question-palette" aria-label="Questions">
          {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((id) => (
            <button
              key={id}
              className={[
                "palette-item",
                id === questionId && "current",
                answers[id] !== undefined && "answered",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => goTo(id)}
              aria-current={id === questionId ? "step" : undefined}
            >
              {id}
            </button>
          ))}
        </div>

        {/* Question */}

        {question && (
          <div className="question-card">
            <h2>
              Question {questionId} of {totalQuestions}
            </h2>

            <p>{question.question}</p>

            {/* Options */}

            {question.options.map((option, index) => (
              <label key={index} className="option-row">
                <input
                  type="radio"
                  name={`answer-${questionId}`}
                  checked={selectedOption === index}
                  onChange={() => selectOption(index)}
                  disabled={submitting}
                />

                <span>{option}</span>
              </label>
            ))}

            {/* Navigation */}

            <div className="navigation-buttons">
              <button
                onClick={() => goTo(questionId - 1)}
                disabled={questionId === 1}
              >
                Previous
              </button>

              {isLastQuestion ? (
                <button onClick={endTest} disabled={submitting}>
                  Finish
                </button>
              ) : (
                <button onClick={() => goTo(questionId + 1)}>Next</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainExam;

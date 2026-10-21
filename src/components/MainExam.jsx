import { useEffect, useState } from "react";

const TOTAL_QUESTIONS = 5;

function MainExam({ time }) {
  const [questionId, setQuestionId] = useState(1);
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

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

  function nextQuestion() {
    if (questionId === TOTAL_QUESTIONS) return;

    setQuestionId(questionId + 1);
    setSelectedOption(null);
  }

  function previousQuestion() {
    if (questionId === 1) return;

    setQuestionId(questionId - 1);
    setSelectedOption(null);
  }

  function endTest() {
    console.log("End Test clicked");
  }

  return (
    <div className="exam-page">
      <div className="exam-container">
        {/* Exam Header */}

        <div className="exam-header">
          <h3>Time Left: {time}</h3>

          <button className="end-test-btn" onClick={endTest}>
            End Test
          </button>
        </div>

        {/* Question */}

        {question && (
          <div className="question-card">
            <h2>
              Question {questionId} of {TOTAL_QUESTIONS}
            </h2>

            <p>{question.question}</p>

            {/* Options */}

            {question.options.map((option, index) => (
              <label key={index} className="option-row">
                <input
                  type="radio"
                  name="answer"
                  checked={selectedOption === index}
                  onChange={() => setSelectedOption(index)}
                />

                <span>{option}</span>
              </label>
            ))}

            {/* Navigation */}

            <div className="navigation-buttons">
              <button onClick={previousQuestion} disabled={questionId === 1}>
                Previous
              </button>

              <button
                onClick={nextQuestion}
                disabled={questionId === TOTAL_QUESTIONS}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainExam;

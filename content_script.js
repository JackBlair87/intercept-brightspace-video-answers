/**
 * XML Quiz Parser Chrome Extension
 *
 * This content script runs on D2L video pages to extract and display quiz data.
 * It parses XML quiz data from Camtasia videos and shows answers in a side panel.
 */

// CSS for the side panel
const style = document.createElement("style");
style.textContent = `
  /* Shift page content when panel is open */
  body.has-xml-panel {
    margin-right: 400px !important;
    transition: margin-right 0.3s ease;
  }

  /* Side panel styling */
  #xml-viewer-panel {
    position: fixed;
    right: 0;
    top: 0;
    width: 400px;
    height: 100vh;
    background: white;
    box-shadow: -2px 0 5px rgba(0,0,0,0.2);
    z-index: 9999;
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
    display: none;
  }

  #xml-viewer-panel.visible {
    display: block;
  }

  /* Quiz content styling */
  #xml-viewer-panel .quiz-section {
    margin-bottom: 20px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  #xml-viewer-panel h3 {
    margin: 0;
    padding: 10px;
    background: #f0f0f0;
    border-radius: 4px;
    font-size: 1.2em;
  }

  #xml-viewer-panel .question {
    padding: 10px;
    border-top: 1px solid #eee;
  }

  #xml-viewer-panel ol {
    margin: 10px 0;
    padding-left: 25px;
  }

  #xml-viewer-panel li {
    margin: 5px 0;
  }
`;
document.head.appendChild(style);

// Create and inject the panel
const panel = document.createElement("div");
panel.id = "xml-viewer-panel";
panel.innerHTML = '<div id="xml-entries"></div>';
document.body.appendChild(panel);

/**
 * Converts XML quiz data to a structured JSON format
 * @param {Document} xml - The XML document to parse
 * @returns {Object} Parsed quiz data with questions and answers
 */
function xmlToJson(xml) {
  let obj = { quizzes: [] };

  // XML namespaces used in the quiz data
  const NS = {
    xmpDM: "http://ns.adobe.com/xmp/1.0/DynamicMedia/",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    tscIQ: "http://www.techsmith.com/xmp/tscIQ/",
  };

  /**
   * Converts binary-style answer indices (1,2,4,8,16) to zero-based indices
   * @param {string} rawIndex - The binary-style index from the XML
   * @returns {number} Zero-based index for the correct answer
   */
  function normalizeAnswerIndex(rawIndex) {
    return Math.log2(parseInt(rawIndex));
  }

  // Find the Quiz track in the XML
  const tracks = xml.getElementsByTagNameNS(NS.xmpDM, "Tracks");
  if (tracks.length > 0) {
    const trackDescriptions = tracks[0].getElementsByTagNameNS(
      NS.rdf,
      "Description"
    );

    // Process each quiz track
    Array.from(trackDescriptions).forEach((track) => {
      if (track.getAttributeNS(NS.xmpDM, "trackType") === "Quiz") {
        const markers = track.getElementsByTagNameNS(NS.xmpDM, "markers");

        if (markers.length > 0) {
          const quizDescriptions = markers[0].getElementsByTagNameNS(
            NS.rdf,
            "Description"
          );

          // Process each quiz section
          Array.from(quizDescriptions).forEach((desc) => {
            if (desc.hasAttributeNS(NS.tscIQ, "questionSetName")) {
              const quizName = desc.getAttributeNS(NS.tscIQ, "questionSetName");
              const questions = [];

              // Process questions in this quiz
              const questionsContainer = desc.getElementsByTagNameNS(
                NS.tscIQ,
                "questions"
              )[0];
              if (questionsContainer) {
                const questionDescs = questionsContainer.getElementsByTagNameNS(
                  NS.rdf,
                  "Description"
                );

                Array.from(questionDescs).forEach((q) => {
                  if (q.getAttributeNS(NS.tscIQ, "type") === "MC") {
                    const questionElem = q.getElementsByTagNameNS(
                      NS.tscIQ,
                      "question"
                    )[0];
                    const correctAnswerElem = q.getElementsByTagNameNS(
                      NS.tscIQ,
                      "correctAnswer"
                    )[0];
                    const answerArray = q.getElementsByTagNameNS(
                      NS.tscIQ,
                      "answer"
                    );

                    const rawCorrectAnswer = correctAnswerElem?.textContent;
                    const normalizedIndex =
                      normalizeAnswerIndex(rawCorrectAnswer);

                    questions.push({
                      question: questionElem?.textContent,
                      correctAnswer: normalizedIndex,
                      answers: Array.from(answerArray).map(
                        (a) => a.textContent
                      ),
                    });
                  }
                });
              }

              if (questions.length > 0) {
                obj.quizzes.push({ name: quizName, questions });
              }
            }
          });
        }
      }
    });
  }

  return obj;
}

/**
 * Updates the side panel with quiz data
 * @param {Object} data - Object containing XML content to parse
 */
function updateEntry(data) {
  const entriesDiv = document.getElementById("xml-entries");
  entriesDiv.innerHTML = "";

  // Parse the XML string to a document
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(data.xmlContent, "text/xml");
  const jsonData = xmlToJson(xmlDoc);

  // Display each quiz section
  jsonData.quizzes.forEach((quiz) => {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "quiz-section";
    sectionDiv.innerHTML = `<h3>${quiz.name || "Unnamed Section"}</h3>`;

    // Display each question
    quiz.questions.forEach((q) => {
      const questionDiv = document.createElement("div");
      questionDiv.className = "question";

      const answersList = q.answers
        .map((answer, idx) => {
          const isCorrect = idx === q.correctAnswer;
          return `<li${
            isCorrect ? ' style="font-weight: bold;"' : ""
          }>${answer}${isCorrect ? " ✓" : ""}</li>`;
        })
        .join("");

      questionDiv.innerHTML = `
        <p><strong>Question:</strong> ${q.question || "No question found"}</p>
        <ol>${answersList}</ol>
        <p><strong>Correct Answer:</strong> Press ${q.correctAnswer + 1}</p>
      `;
      sectionDiv.appendChild(questionDiv);
    });

    entriesDiv.appendChild(sectionDiv);
  });
}

// Listen for new XML data from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "NEW_XML_DATA") {
    panel.classList.add("visible");
    document.body.classList.add("has-xml-panel");
    updateEntry(message.data);
  }
});

// Show historical data if we're on a video page
const isVideoPage = window.location.href.includes("/d2l/le/content/");
if (isVideoPage) {
  chrome.storage.local.get(null, (data) => {
    const entries = Object.entries(data)
      .filter(([key]) => key.startsWith("xml_data_"))
      .sort(([, a], [, b]) => new Date(b.timestamp) - new Date(a.timestamp));

    if (entries.length > 0) {
      const mostRecent = entries[0][1];
      if (mostRecent.url.includes(window.location.pathname)) {
        panel.classList.add("visible");
        document.body.classList.add("has-xml-panel");
        updateEntry(mostRecent);
      }
    }
  });
}

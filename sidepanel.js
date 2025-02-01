async function updateSessionsDisplay(sessions, currentTabId) {
  const sessionsContainer = document.getElementById("sessions");
  console.log("tryna update sessionsDisplay")
  sessionsContainer.innerHTML = "<h2>Current Sessions</h2>"; // Reset content
  if (sessions.length === 0) {
    sessionsContainer.innerHTML += "<p>No sessions found.</p>";
  } else {
    sessions.reverse().forEach((session) => {
      const sessionElement = document.createElement("div");
      sessionElement.className = "session";
      sessionElement.innerHTML = `
                <p><strong>Session ID:</strong> ${session.sessionID}</p>
                <p><strong>Current URL:</strong> ${session.currentURL}</p>
                <div>
                    <button class="toggle-tools-button">Show Tools</button>
                    <div class="tools-content minimizable" style="display: none;">
                        <p><strong>Current Tools:</strong></p>
                    </div>
                </div>
            `;

      const toolsContent = sessionElement.querySelector(".tools-content");
      console.log("this session: ", session)
      session.domTree.forEach((element) => {
        let domElement;
        if (element.elementType === "button") {
          domElement = document.createElement("button");
          domElement.textContent = element.description; // Button with description
          domElement.onclick = () => {
            chrome.tabs.sendMessage(
              currentTabId,
              { type: "highlight", toolId: element.uniqueIdentifier },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error sending message:",
                    chrome.runtime.lastError.message
                  );
                } else {
                  console.log("Message sent, received response:", response);
                }
              }
            );
          };
        } else if (element.elementType === "link") {
          domElement = document.createElement("a");
          domElement.textContent = element.description; // Link with description
          domElement.href = element.uniqueIdentifier; // URL as href
          domElement.target = "_blank"; // Open link in new tab
        }

        toolsContent.appendChild(domElement);
      });

      addToggleEventListeners(
        ".toggle-tools-button",
        "Show Tools",
        "Hide Tools"
      );

      sessionsContainer.appendChild(sessionElement);
    });
  }
}

function addToggleEventListeners(selector, showText, hideText) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", (event) => {
      const content = event.target.nextElementSibling;
      if (content.style.display === "none") {
        event.target.textContent = hideText;
        content.style.display = "block";
      } else {
        event.target.textContent = showText;
        content.style.display = "none";
      }
    });
  });
}

// CSS for highlighting elements
document.head.insertAdjacentHTML(
  "beforeend",
  `
<style>
    .highlighted { outline: 2px solid red; }
</style>
`
);

function getCurrentTab(callback) {
  let queryOptions = { active: true, lastFocusedWindow: true };
  chrome.tabs.query(queryOptions, ([tab]) => {
    if (chrome.runtime.lastError)
    console.error(chrome.runtime.lastError);
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    callback(tab);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const convertButton = document.getElementById("convertButton");
  const clearSessionsButton = document.getElementById("clearSessionsButton"); // New Button

  function getCurrentTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        callback(tabs[0]);
      } else {
        alert("No active tab detected.");
      }
    });
  }

  // Initial load of sessions data
  chrome.storage.local.get("sessions", (result) => {
    getCurrentTab((tab) => {
      updateSessionsDisplay(result.sessions || [], tab.id); // Pass currentTabId
    });
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.sessions) {
      getCurrentTab((tab) => {
        updateSessionsDisplay(changes.sessions.newValue || [], tab.id); // Pass currentTabId
      });
    }
  });

  convertButton.addEventListener("click", () => {
    getCurrentTab((tab) => {
      const link = tab.url;
      const currentTabId = tab.id;
      console.log("this tab id of current tab: ", tab.id)

      if (link) {
        chrome.runtime.sendMessage(
          { type: "scrapePage", link, tabId: currentTabId }, // Pass currentTabId
          (response) => {
            if (response.success) {
              alert("Tab processed successfully!");
            } else {
              alert(`Error: ${response.error}`);
            }
          }
        );
      } else {
        alert("Please enter a valid link.");
      }
    });
  });

  clearSessionsButton.addEventListener("click", () => {
    // New Event Listener
    chrome.storage.local.remove("sessions", () => {
      alert("All sessions cleared.");
      getCurrentTab((tab) => {
        updateSessionsDisplay([], tab.id); // Pass currentTabId and clear the display
      });
    });
  });
});

// Connect to background script
const port = chrome.runtime.connect({ name: "sidepanel" });

// Request all data when panel opens
port.postMessage({ type: "GET_ALL_DATA" });

// Listen for messages from background script
port.onMessage.addListener((msg) => {
  if (msg.type === "ALL_DATA") {
    displayData(msg.data);
  }
});

// Listen for new data
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "NEW_XML_DATA") {
    appendData(msg.data);
  }
});

function displayData(data) {
  const content = document.getElementById('content');
  content.innerHTML = '';
  
  Object.values(data)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .forEach(entry => {
      appendData(entry);
    });
}

function appendData(data) {
  const content = document.getElementById('content');
  const div = document.createElement('div');
  div.className = 'data-entry';
  div.innerHTML = `
    <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
    <p><strong>URL:</strong> ${data.url}</p>
    <!-- Add more fields here based on your XML structure -->
  `;
  content.insertBefore(div, content.firstChild);
}

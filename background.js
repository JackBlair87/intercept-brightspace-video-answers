// Pattern to match Brightspace video config XML files
const XML_CONFIG_PATTERN =
  /content\.us-east-1\.content-service\.brightspace\.com\/.*?_config\.xml$/;

console.log("Background script loaded!");

// Keep track of processed URLs to avoid infinite loops
const processedUrls = new Set();

// Set up web request listener
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    console.log("Got a request:", details.type, details.url);

    // Check if we've already processed this URL
    if (processedUrls.has(details.url)) {
      console.log("Already processed URL:", details.url);
      return;
    }

    console.log("Checking URL pattern...");
    if (
      details.type === "xmlhttprequest" &&
      XML_CONFIG_PATTERN.test(details.url)
    ) {
      console.log("Matched XML pattern!");

      // Mark URL as processed
      processedUrls.add(details.url);
      console.log("Current processed URLs:", Array.from(processedUrls));

      // Fetch the XML content
      fetch(details.url)
        .then((response) => {
          console.log("Got response:", response.status);
          return response.text();
        })
        .then((xmlText) => {
          console.log("XML Content length:", xmlText.length);
          console.log("First 200 chars:", xmlText.substring(0, 200));

          const data = {
            timestamp: new Date().toISOString(),
            url: details.url,
            xmlContent: xmlText,
          };

          // Store the XML content
          chrome.storage.local.set({
            [`xml_data_${Date.now()}`]: data,
          });

          // Send to content script
          chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: "NEW_XML_DATA",
                  data: data,
                });
              }
            }
          );

          // Remove from processed after some time
          setTimeout(() => {
            processedUrls.delete(details.url);
            console.log("Removed URL from processed list");
          }, 5000);
        })
        .catch((error) => {
          console.error("Error processing XML:", error);
          processedUrls.delete(details.url);
        });
    }
  },
  {
    urls: [
      "https://content.us-east-1.content-service.brightspace.com/*_config.xml",
    ],
  }
);

// Listen for side panel connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel") {
    port.onMessage.addListener((msg) => {
      if (msg.type === "GET_ALL_DATA") {
        // Send all stored XML data to side panel
        chrome.storage.local.get(null, (data) => {
          port.postMessage({
            type: "ALL_DATA",
            data: data,
          });
        });
      }
    });
  }
});

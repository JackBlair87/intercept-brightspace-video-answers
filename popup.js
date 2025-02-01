// When popup opens, request data from storage
chrome.storage.local.get(null, (data) => {
  const content = document.getElementById('content');
  
  // Clear existing content
  content.innerHTML = '';
  
  // Get all XML entries and sort by timestamp
  const entries = Object.entries(data)
    .filter(([key]) => key.startsWith('xml_data_'))
    .sort(([, a], [, b]) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (entries.length === 0) {
    content.innerHTML = '<div class="no-data">No XML data captured yet...</div>';
    return;
  }
  
  // Display each entry
  entries.forEach(([key, data]) => {
    const div = document.createElement('div');
    div.className = 'xml-entry';
    div.innerHTML = `
      <div class="timestamp">${new Date(data.timestamp).toLocaleString()}</div>
      <div class="url">${data.url}</div>
      <pre class="content">${data.xmlContent || 'No content available'}</pre>
    `;
    content.appendChild(div);
  });
}); 
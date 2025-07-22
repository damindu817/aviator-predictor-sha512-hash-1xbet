// Display prediction results
function displayResults(odd, entropy, score, delay, confidence) {
  const future = new Date(Date.now() + serverTimeOffset + delay * 1000);
  const timeStr = future.toLocaleTimeString();
  
  document.getElementById("result-odd").textContent = `${odd}x`;
  document.getElementById("result-entropy").textContent = entropy.toFixed(3);
  document.getElementById("result-score").textContent = score;
  document.getElementById("result-confidence").textContent = `${confidence}%`;
  document.getElementById("result-delay").textContent = `${delay} seconds`;
  document.getElementById("result-time").textContent = timeStr;
  
  document.getElementById("copyResultBtn").disabled = false;
  document.getElementById("output").style.display = 'block';
}


// Update confidence bars for each odd
function updateConfidenceBars(hash) {
  if (!hash || hash.length !== 128 || !/^[a-f0-9]+$/.test(hash)) return;
  
  const entropy = calcEntropy(hash);
  const score = scoreFromHash(hash);
  
  [2, 3, 4, 7, 10, 100].forEach(odd => {
    const confidence = calculateConfidence(entropy, score, odd.toString(), hash);
    document.getElementById(`confidence-${odd}`).style.width = `${confidence}%`;
  });
}
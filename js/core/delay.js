// Calculate delay based on score, entropy, and target multiplier
function calculateDelay(score, entropy, oddTarget, hash) {
  let base = parseInt(oddTarget) * 45;
  
  if (entropy > 4.3) base += 20;
  if (score % 7 === 0) base += 30;
  if (score % 5 === 0) base += 15;
  if (/(\w)\1{2,}/.test(hash)) base += 20;
  if (/(\w{2,4})\1{1,}/.test(hash)) base += 15;
  
  // Odd-specific adjustments
  if (oddTarget === '10') base += 60;
  if (oddTarget === '100') base += 600;
  
  return Math.max(45, base);
}// Calculate delay based on score, entropy, and target multiplier
function calculateDelay(score, entropy, oddTarget, hash) {
  let base = parseInt(oddTarget) * 45;
  
  if (entropy > 4.3) base += 20;
  if (score % 7 === 0) base += 30;
  if (score % 5 === 0) base += 15;
  if (/(\w)\1{2,}/.test(hash)) base += 20;
  if (/(\w{2,4})\1{1,}/.test(hash)) base += 15;
  
  // Odd-specific adjustments
  if (oddTarget === '10') base += 60;
  if (oddTarget === '100') base += 600;
  
  return Math.max(45, base);
}

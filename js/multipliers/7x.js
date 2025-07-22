
function predict7x(hash) {
  const entropy = calcEntropy(hash);
  const score = scoreFromHash(hash);
  const confidence = calculateConfidence(entropy, score, '7', hash);
  const delay = calculateDelay(score, entropy, '7', hash);
  
  return {
    odd: '7',
    confidence,
    delay
  };
}

function calculateConfidence(entropy, score, oddTarget, hash) {
  let confidence = 50;
  
  if (entropy > 4.2) confidence += 10;
  if (entropy > 4.5) confidence += 15;
  if (score % 7 === 0) confidence += 8;
  if (score % 5 === 0) confidence += 5;
  if (/(\w)\1{2,}/.test(hash)) confidence += 15;
  if (/(\w{2,4})\1{1,}/.test(hash)) confidence += 10;
  
  const tail = hash.slice(-4);
  if (/^(aaaa|ffff|0000|1111)$/.test(tail)) confidence += 20;
  
  // 7x specific adjustments
  confidence += 5;
  if (entropy > 4.1 && entropy < 4.4) confidence += 12;
  if (score >= 55 && score <= 90) confidence += 6;
  
  return Math.min(98, Math.max(5, Math.round(confidence)));
}
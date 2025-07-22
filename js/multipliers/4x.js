function predict4x(hash) {
  const entropy = calcEntropy(hash);
  const score = scoreFromHash(hash);
  const confidence = calculateConfidence(entropy, score, '4', hash);
  const delay = calculateDelay(score, entropy, '4', hash);
  
  return {
    odd: '4',
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
  
  // 4x specific adjustments
  if (entropy > 3.91 && entropy < 3.97) confidence += 10;
  if (score >= 45 && score <= 80) confidence += 8;
  
  return Math.min(98, Math.max(5, Math.round(confidence)));
}

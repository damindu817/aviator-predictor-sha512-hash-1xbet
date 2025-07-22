// Calculate score from hash based on specific positions
function scoreFromHash(hash) {
  const indexes = [5, 15, 25, 35, 50, 75, 100, 120];
  return indexes.reduce((sum, i) => sum + parseInt(hash[i], 16), 0);
}

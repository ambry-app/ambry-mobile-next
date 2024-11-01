export function formatPlaybackRate(rate: number) {
  if (!rate) {
    return "1.0";
  }
  if (Number.isInteger(rate)) {
    return rate + ".0";
  } else {
    const out = rate.toFixed(2);
    return out.endsWith("0") ? out.slice(0, -1) : out;
  }
}

export function secondsDisplay(total: number): string {
  const hours = String(Math.floor(total / 3600));
  const minutes = String(Math.floor((total % 3600) / 60));
  const seconds = String(Math.floor((total % 3600) % 60));

  if (hours === "0") {
    return `${minutes}:${seconds.padStart(2, "0")}`;
  } else {
    return `${hours}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
  }
}

export function secondsDisplayMinutesOnly(
  total: number,
  showPlus: boolean = false,
): string {
  const totalInSeconds = Math.abs(total);
  const minutes = String(Math.floor(totalInSeconds / 60));
  const seconds = String(Math.floor(totalInSeconds % 60));

  return `${total < 0 ? "-" : showPlus ? "+" : ""}${minutes}:${seconds.padStart(2, "0")}`;
}

export function durationDisplay(input: string): string {
  const total = Number(input);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours === 0) {
    return `${minutes} minutes`;
  } else {
    return `${hours} hours and ${minutes} minutes`;
  }
}

/** Confetti and chirpy sounds. Both respect the user's motion/sound choices. */

const reduceMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let muted = false;
let audio = null;

export function setMuted(value) {
  muted = Boolean(value);
}

export function burstConfetti(count = 40) {
  if (reduceMotion()) return;
  const colors = ["#c3f76b", "#ff8a5c", "#5ed3ff", "#ffd166", "#7c5cff"];
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty("--dur", `${1.1 + Math.random() * 1.2}s`);
    piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2800);
}

function context() {
  if (typeof AudioContext !== "function") return null;
  if (!audio) audio = new AudioContext();
  return audio;
}

function tone(freq, start, duration, type = "sine", volume = 0.06) {
  const ctx = context();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(ctx.currentTime + start);
  oscillator.stop(ctx.currentTime + start + duration + 0.02);
}

export function play(kind) {
  if (muted) return;
  try {
    if (kind === "win") {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, i * 0.075, 0.22, "triangle"));
    } else if (kind === "nope") {
      tone(196, 0, 0.16, "sawtooth", 0.035);
      tone(155, 0.09, 0.2, "sawtooth", 0.03);
    } else if (kind === "tap") {
      tone(880, 0, 0.05, "square", 0.02);
    } else if (kind === "level") {
      [659.25, 880, 1174.66].forEach((freq, i) => tone(freq, i * 0.09, 0.3, "sine", 0.05));
    }
  } catch {
    /* audio is a bonus, never a blocker */
  }
}

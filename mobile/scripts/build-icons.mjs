// Generates the app icon, Android adaptive icon layers, splash image and favicon from one vector
// design: a silver pinball above two flippers on a dark playfield. Run: npm run icons
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const NAVY_CENTER = '#16305a';
const NAVY_EDGE = '#0a1426';
const FLIPPER = '#f07a3e';
const FLIPPER_EDGE = '#c2410c';

const defs = `
  <defs>
    <radialGradient id="field" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="${NAVY_CENTER}"/>
      <stop offset="100%" stop-color="${NAVY_EDGE}"/>
    </radialGradient>
    <!-- Chrome is a mirror: hard-edged reflections, not a smooth shade. Upper half reflects the
         cabinet lights, a sharp horizon reflects the room, the lower half reflects the dark playfield. -->
    <clipPath id="ballClip"><circle cx="512" cy="455" r="178"/></clipPath>
    <linearGradient id="chromeSky" gradientUnits="userSpaceOnUse" x1="0" y1="277" x2="0" y2="462">
      <stop offset="0%" stop-color="#565f6c"/>
      <stop offset="30%" stop-color="#959ea9"/>
      <stop offset="72%" stop-color="#cfd5dc"/>
      <stop offset="100%" stop-color="#e8ecf0"/>
    </linearGradient>
    <linearGradient id="chromeGround" gradientUnits="userSpaceOnUse" x1="0" y1="452" x2="0" y2="633">
      <stop offset="0%" stop-color="#10141c"/>
      <stop offset="40%" stop-color="#262e3d"/>
      <stop offset="78%" stop-color="#566071"/>
      <stop offset="100%" stop-color="#aeb7c3"/>
    </linearGradient>
    <radialGradient id="chromeEdge" cx="512" cy="455" r="178" gradientUnits="userSpaceOnUse">
      <stop offset="70%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
    <linearGradient id="flipper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${FLIPPER}"/>
      <stop offset="100%" stop-color="${FLIPPER_EDGE}"/>
    </linearGradient>
  </defs>`;

// A flipper: round pivot tapering to a round tip, drawn pointing right from its pivot.
const flipperPath = 'M 0,-36 L 236,-17 A 17 17 0 0 1 236,17 L 0,36 A 36 36 0 0 1 0,-36 Z';

/** The ball and flippers, laid out on a 1024 canvas and scaled about its center. */
/** A chrome steel ball: mirrored sky above a curved horizon, dark playfield below, crisp highlights. */
const chromeBall = `
  <g clip-path="url(#ballClip)">
    <rect x="300" y="270" width="424" height="380" fill="url(#chromeGround)"/>
    <rect x="300" y="270" width="424" height="180" fill="url(#chromeSky)"/>
    <ellipse cx="512" cy="450" rx="200" ry="44" fill="url(#chromeSky)"/>
    <path d="M 330 470 Q 512 512 694 470" stroke="#0a0d13" stroke-width="8" fill="none" opacity="0.6"/>
    <path d="M 352 322 Q 512 268 672 322" stroke="#3b4350" stroke-width="16" fill="none" opacity="0.45"/>
    <path d="M 398 606 Q 430 618 466 622" stroke="${FLIPPER}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.7"/>
    <path d="M 626 606 Q 594 618 558 622" stroke="${FLIPPER}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.7"/>
    <circle cx="512" cy="455" r="178" fill="url(#chromeEdge)"/>
  </g>
  <ellipse cx="440" cy="356" rx="34" ry="15" fill="#fff" opacity="0.95" transform="rotate(-32 440 356)"/>
  <circle cx="590" cy="346" r="6" fill="#fff" opacity="0.85"/>
  <circle cx="512" cy="455" r="177" fill="none" stroke="#10151f" stroke-width="3" opacity="0.6"/>`;

function artwork({ scale = 1, mono = false } = {}) {
  const flipperFill = mono ? '#ffffff' : 'url(#flipper)';
  return `
    <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
      ${mono ? '' : '<ellipse cx="512" cy="672" rx="150" ry="22" fill="#000" opacity="0.28"/>'}
      ${mono ? '<circle cx="512" cy="455" r="178" fill="#ffffff"/>' : chromeBall}
      <g transform="translate(250 790) rotate(24)"><path d="${flipperPath}" fill="${flipperFill}"/></g>
      <g transform="translate(774 790) scale(-1 1) rotate(24)"><path d="${flipperPath}" fill="${flipperFill}"/></g>
    </g>`;
}

const svg = (body, size = 1024) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${defs}${body}</svg>`);

const background = '<rect width="1024" height="1024" fill="url(#field)"/>';

// Android adaptive icons crop to the middle ~66%, so the foreground art is shrunk into that zone.
const outputs = [
  ['icon.png', 1024, svg(background + artwork())],
  ['android-icon-background.png', 512, svg(background)],
  ['android-icon-foreground.png', 512, svg(artwork({ scale: 0.62 }))],
  ['android-icon-monochrome.png', 432, svg(artwork({ scale: 0.62, mono: true }))],
  ['splash-icon.png', 1024, svg(artwork({ scale: 0.9 }))],
  ['favicon.png', 48, svg(background + artwork({ scale: 1.1 }))],
];

await mkdir(out, { recursive: true });
for (const [name, size, source] of outputs) {
  await sharp(source, { density: 300 }).resize(size, size).png().toFile(join(out, name));
  console.log(`${name} ${size}x${size}`);
}

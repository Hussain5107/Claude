import { SKIN_TONES, HAIR_COLORS, OUTFITS, SHOES, HATS, GLASSES, BAGS } from "./avatarCatalog.js";

function colorOf(list, id, fallback) {
  return list.find((x) => x.id === id)?.color || fallback;
}

const HAIR_BACK = {
  "twin-tails": '<path d="M20 55 Q5 90 15 130 Q22 140 30 128 Q22 95 34 60 Z" /><path d="M100 55 Q115 90 105 130 Q98 140 90 128 Q98 95 86 60 Z" />',
  pigtails: '<circle cx="18" cy="70" r="16"/><circle cx="102" cy="70" r="16"/>',
  ponytail: '<path d="M100 45 Q135 60 120 120 Q112 132 104 120 Q114 75 92 55 Z" />',
  "curly-bun": '<circle cx="60" cy="22" r="18"/>',
  "short-bob": "",
  "long-wavy": '<path d="M18 55 Q5 110 22 150 Q30 155 32 145 Q18 105 30 60 Z"/><path d="M102 55 Q115 110 98 150 Q90 155 88 145 Q102 105 90 60 Z"/>',
  "braid-crown": '<path d="M25 45 Q60 25 95 45" fill="none" stroke-width="10" stroke-linecap="round"/>',
};

const HAIR_FRONT = {
  "twin-tails": '<path d="M20 55 Q60 8 100 55 Q95 30 60 25 Q25 30 20 55 Z"/>',
  pigtails: '<path d="M20 58 Q60 10 100 58 Q92 32 60 28 Q28 32 20 58 Z"/>',
  ponytail: '<path d="M18 58 Q60 6 102 58 Q95 28 60 24 Q25 28 18 58 Z"/>',
  "curly-bun": '<path d="M16 60 Q60 10 104 60 Q98 26 60 22 Q22 26 16 60 Z"/>',
  "short-bob": '<path d="M14 62 Q60 4 106 62 Q108 95 96 100 Q100 60 60 50 Q20 60 24 100 Q12 95 14 62 Z"/>',
  "long-wavy": '<path d="M16 58 Q60 6 104 58 Q98 30 60 24 Q22 30 16 58 Z"/>',
  "braid-crown": '<path d="M18 56 Q60 12 102 56 Q94 30 60 26 Q26 30 18 56 Z"/>',
};

const EYES = {
  round: '<circle cx="46" cy="78" r="5"/><circle cx="74" cy="78" r="5"/>',
  sparkle: '<circle cx="46" cy="78" r="5"/><circle cx="74" cy="78" r="5"/><circle cx="44" cy="76" r="1.6" fill="#fff"/><circle cx="72" cy="76" r="1.6" fill="#fff"/>',
  happy: '<path d="M40 78 Q46 84 52 78" fill="none" stroke-width="3" stroke-linecap="round"/><path d="M68 78 Q74 84 80 78" fill="none" stroke-width="3" stroke-linecap="round"/>',
};

const OUTFIT_SHAPE = {
  sundress: '<path d="M35 118 Q60 100 85 118 L95 175 Q60 190 25 175 Z"/>',
  overalls: '<path d="M40 118 L80 118 L88 175 L32 175 Z"/><rect x="42" y="105" width="10" height="20"/><rect x="68" y="105" width="10" height="20"/>',
  romper: '<path d="M38 118 Q60 105 82 118 L86 160 Q60 172 34 160 Z"/>',
  "hoodie-skirt": '<path d="M32 115 Q60 98 88 115 L92 145 L28 145 Z"/><path d="M30 145 L90 145 L96 178 L24 178 Z"/>',
  "fairy-gown": '<path d="M30 116 Q60 98 90 116 L102 180 Q60 195 18 180 Z"/>',
  "explorer-vest": '<path d="M38 116 L82 116 L88 170 L32 170 Z"/><rect x="44" y="122" width="8" height="30" fill="#5b7a3a"/><rect x="68" y="122" width="8" height="30" fill="#5b7a3a"/>',
  "starlight-dress": '<path d="M28 115 Q60 96 92 115 L104 182 Q60 198 16 182 Z"/>',
  "royal-gown": '<path d="M26 114 Q60 94 94 114 L108 185 Q60 202 12 185 Z"/>',
};

function svgWrap(inner, { size = 220 } = {}) {
  return `<svg viewBox="0 0 120 200" width="${size}" height="${size * (200 / 120)}" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/** Renders a full-body avatar as an inline SVG string. */
export function renderAvatarSVG(avatar, opts = {}) {
  const skin = colorOf(SKIN_TONES, avatar.skin, "#ffcda3");
  const hair = colorOf(HAIR_COLORS, avatar.hairColor, "#8a5a3b");
  const outfitColor = colorOf(OUTFITS, avatar.outfit, "#ff9ecb");
  const shoeColor = colorOf(SHOES, avatar.shoes, "#ffffff");
  const eyes = EYES[avatar.eyes] || EYES.round;
  const hairBack = HAIR_BACK[avatar.hairStyle] || "";
  const hairFront = HAIR_FRONT[avatar.hairStyle] || HAIR_FRONT["twin-tails"];
  const outfitShape = OUTFIT_SHAPE[avatar.outfit] || OUTFIT_SHAPE.sundress;
  const hatEmoji = HATS.find((h) => h.id === avatar.hat)?.emoji;
  const glassesEmoji = GLASSES.find((g) => g.id === avatar.glasses)?.emoji;
  const bagEmoji = BAGS.find((b) => b.id === avatar.bag)?.emoji;

  const inner = `
    <g fill="${shoeColor}" stroke="#00000022"><rect x="40" y="180" width="14" height="12" rx="4"/><rect x="66" y="180" width="14" height="12" rx="4"/></g>
    <g fill="${skin}"><rect x="42" y="150" width="10" height="35" rx="4"/><rect x="68" y="150" width="10" height="35" rx="4"/></g>
    <g fill="${hair}" opacity="0.95">${hairBack}</g>
    <g fill="${skin}"><ellipse cx="60" cy="75" rx="30" ry="32"/></g>
    <g fill="${skin}"><rect x="30" y="115" width="12" height="25" rx="6"/><rect x="78" y="115" width="12" height="25" rx="6"/></g>
    <g fill="${outfitColor}" stroke="#00000015">${outfitShape}</g>
    <g fill="#5c4a3a">${eyes}</g>
    <path d="M55 92 Q60 96 65 92" fill="none" stroke="#5c4a3a" stroke-width="2.4" stroke-linecap="round"/>
    <g fill="#ff9db8" opacity="0.6"><ellipse cx="38" cy="86" rx="6" ry="4"/><ellipse cx="82" cy="86" rx="6" ry="4"/></g>
    <g fill="${hair}">${hairFront}</g>
    ${hatEmoji ? `<text x="60" y="30" font-size="26" text-anchor="middle">${hatEmoji}</text>` : ""}
    ${glassesEmoji ? `<text x="60" y="84" font-size="18" text-anchor="middle">${glassesEmoji}</text>` : ""}
    ${bagEmoji ? `<text x="98" y="145" font-size="20" text-anchor="middle">${bagEmoji}</text>` : ""}
    ${(avatar.accessories || []).includes("wings") ? `<text x="60" y="120" font-size="30" text-anchor="middle">🦋</text>` : ""}
  `;
  return svgWrap(inner, opts);
}

export default { renderAvatarSVG };

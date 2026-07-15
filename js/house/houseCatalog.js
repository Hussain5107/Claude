/**
 * Furniture/decor catalog. Rendered as large glyphs inside the drag/drop
 * canvas (see houseEditor.js) — zero image assets to fetch, fully offline.
 */
function item(id, category, icon, label, price, unlockLevel = 0, rarity = "common") {
  return { id, category, icon, label, price, unlockLevel, rarity };
}

export const HOUSE_CATEGORIES = [
  "beds", "sofas", "curtains", "kitchen", "dining", "bathroom", "studyTable",
  "plants", "lights", "carpets", "tv", "bookshelf", "wallArt", "toyShelf",
  "windows", "garden", "pool", "petArea", "appliances",
];

export const CATEGORY_LABELS = {
  beds: "🛏 Beds", sofas: "🛋 Sofas", curtains: "🪟 Curtains", kitchen: "🍳 Kitchen",
  dining: "🍽 Dining", bathroom: "🛁 Bathroom", studyTable: "📚 Study Table", plants: "🌱 Plants",
  lights: "💡 Lights", carpets: "🟪 Carpets", tv: "📺 TV", bookshelf: "📖 Bookshelf",
  wallArt: "🖼 Wall Art", toyShelf: "🧸 Toy Shelf", windows: "🌤 Windows", garden: "🌷 Garden",
  pool: "🏊 Pool", petArea: "🐾 Pet Area", appliances: "🧺 Appliances",
};

export const HOUSE_ITEMS = [
  item("bed-basic", "beds", "🛏️", "Cozy Bed", 20, 0),
  item("bed-canopy", "beds", "👑", "Canopy Bed", 60, 3, "rare"),
  item("bed-cloud", "beds", "☁️", "Cloud Bed", 120, 7, "legendary"),

  item("sofa-basic", "sofas", "🛋️", "Comfy Sofa", 25, 0),
  item("sofa-pink", "sofas", "🌸", "Blossom Sofa", 55, 2, "rare"),

  item("curtain-basic", "curtains", "🪟", "Simple Curtain", 10, 0),
  item("curtain-star", "curtains", "✨", "Starlight Curtain", 35, 3, "rare"),

  item("kitchen-basic", "kitchen", "🍳", "Little Kitchen", 30, 0),
  item("kitchen-deluxe", "kitchen", "👩‍🍳", "Deluxe Kitchen", 80, 5, "rare"),

  item("dining-basic", "dining", "🍽️", "Dining Table", 25, 0),
  item("dining-royal", "dining", "🍰", "Royal Dining Set", 70, 6, "rare"),

  item("bath-basic", "bathroom", "🛁", "Bathtub", 20, 0),
  item("bath-rubber-duck", "bathroom", "🦆", "Duck Bath Set", 30, 1),

  item("study-basic", "studyTable", "📚", "Study Table", 20, 0),
  item("study-magic", "studyTable", "🔮", "Magic Study Desk", 65, 4, "rare"),

  item("plant-basic", "plants", "🪴", "Little Plant", 8, 0),
  item("plant-flower", "plants", "🌻", "Sunflower Pot", 15, 1),
  item("plant-tree", "plants", "🌳", "Mini Tree", 25, 2),

  item("light-basic", "lights", "💡", "Warm Lamp", 10, 0),
  item("light-fairy", "lights", "🎇", "Fairy Lights", 30, 3, "rare"),

  item("carpet-basic", "carpets", "🟫", "Cozy Rug", 10, 0),
  item("carpet-rainbow", "carpets", "🌈", "Rainbow Rug", 35, 3, "rare"),

  item("tv-basic", "tv", "📺", "TV", 40, 1),

  item("bookshelf-basic", "bookshelf", "📖", "Bookshelf", 22, 0),
  item("bookshelf-tall", "bookshelf", "📚", "Tall Library Shelf", 45, 4),

  item("wallart-basic", "wallArt", "🖼️", "Framed Art", 12, 0),
  item("wallart-stars", "wallArt", "🌌", "Starry Canvas", 30, 2, "rare"),

  item("toyshelf-basic", "toyShelf", "🧸", "Toy Shelf", 18, 0),
  item("toyshelf-dolls", "toyShelf", "🪆", "Doll Collection Shelf", 32, 2),

  item("window-basic", "windows", "🌤️", "Sunny Window", 8, 0),
  item("window-moon", "windows", "🌙", "Moonlit Window", 20, 3, "rare"),

  item("garden-basic", "garden", "🌷", "Flower Bed", 15, 0),
  item("garden-fountain", "garden", "⛲", "Garden Fountain", 50, 5, "rare"),
  item("garden-gazebo", "garden", "🏛️", "Garden Gazebo", 90, 8, "legendary"),

  item("pool-basic", "pool", "🏊", "Splash Pool", 60, 6, "rare"),
  item("pool-slide", "pool", "🛝", "Pool Slide", 90, 9, "legendary"),

  item("petarea-basic", "petArea", "🐾", "Pet Bed", 15, 0),
  item("petarea-house", "petArea", "🏠", "Pet House", 40, 3, "rare"),

  item("appliance-fridge", "appliances", "🧊", "Fridge", 25, 1),
  item("appliance-washer", "appliances", "🧺", "Washing Machine", 25, 2),
  item("appliance-oven", "appliances", "🔥", "Baking Oven", 30, 3),
];

export const WALLPAPERS = [
  { id: "wp-clouds", label: "Clouds", gradient: "linear-gradient(180deg,#eaf7ff,#ffffff)", unlockLevel: 0 },
  { id: "wp-stripes", label: "Pink Stripes", gradient: "repeating-linear-gradient(90deg,#fff,#fff 30px,#ffe3f0 30px,#ffe3f0 60px)", unlockLevel: 1 },
  { id: "wp-stars", label: "Starry Night", gradient: "radial-gradient(circle,#3a3560,#211c3d)", unlockLevel: 4 },
  { id: "wp-rainbow", label: "Rainbow", gradient: "linear-gradient(90deg,#ffadad,#ffd6a5,#fdffb6,#caffbf,#9bf6ff,#a0c4ff,#bdb2ff)", unlockLevel: 6, rarity: "rare" },
];

export const FLOORINGS = [
  { id: "fl-wood", label: "Wood", color: "#e3c39a", unlockLevel: 0 },
  { id: "fl-tile", label: "Tile", color: "#dbeafe", unlockLevel: 1 },
  { id: "fl-grass", label: "Grass", color: "#bdeecb", unlockLevel: 3 },
  { id: "fl-cloud", label: "Cloud Floor", color: "#f3e9ff", unlockLevel: 6, rarity: "rare" },
];

export const ROOMS = [
  { id: "bedroom", label: "Bedroom", icon: "🛏️", unlockLevel: 0 },
  { id: "livingRoom", label: "Living Room", icon: "🛋️", unlockLevel: 3 },
  { id: "gardenRoom", label: "Garden", icon: "🌷", unlockLevel: 6 },
];

export function itemsInCategory(category) {
  return HOUSE_ITEMS.filter((i) => i.category === category);
}

export function findItem(id) {
  return HOUSE_ITEMS.find((i) => i.id === id);
}

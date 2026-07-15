function pet(id, emoji, label, price, currency, unlockLevel = 0, rarity = "common") {
  return { id, emoji, label, price, currency, unlockLevel, rarity };
}

export const PET_CATALOG = [
  pet("cat", "🐱", "Kitten", 30, "coins", 0),
  pet("dog", "🐶", "Puppy", 30, "coins", 0),
  pet("rabbit", "🐰", "Bunny", 35, "coins", 1),
  pet("hamster", "🐹", "Hamster", 25, "coins", 0),
  pet("bird", "🐦", "Songbird", 30, "coins", 1),
  pet("fox", "🦊", "Fox Kit", 50, "coins", 3),
  pet("panda", "🐼", "Panda Cub", 3, "diamonds", 4, "rare"),
  pet("unicorn", "🦄", "Baby Unicorn", 5, "diamonds", 6, "rare"),
  pet("dragon", "🐲", "Baby Dragon", 8, "diamonds", 9, "legendary"),
];

export function findPet(petId) {
  return PET_CATALOG.find((p) => p.id === petId);
}

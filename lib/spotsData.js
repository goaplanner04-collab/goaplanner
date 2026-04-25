export const CATEGORIES = [
  { key: "all", label: "All", icon: "sparkles" },
  { key: "cafe", label: "Cafes", icon: "coffee" },
  { key: "restobar", label: "Restobars", icon: "cocktail" },
  { key: "seafood", label: "Seafood", icon: "fish" },
  { key: "beach", label: "Beaches", icon: "waves" },
  { key: "hidden_gem", label: "Hidden Gems", icon: "leaf" },
  { key: "scooter_rental", label: "Scooter Rentals", icon: "scooter" },
];

export const CATEGORY_ICON = {
  cafe: "coffee",
  restobar: "cocktail",
  seafood: "fish",
  beach: "waves",
  hidden_gem: "leaf",
  scooter_rental: "scooter",
};

export const spots = [
  { id: 1, name: "Artjuna Cafe", category: "cafe", area: "Arambol", lat: 15.6870, lng: 73.7037, rating: 4.6, reviews: 312, priceRange: "Rs Rs", description: "Boho garden cafe with organic food and hammocks", openNow: true },
  { id: 2, name: "Infantaria Cafe", category: "cafe", area: "Baga", lat: 15.5617, lng: 73.7519, rating: 4.4, reviews: 876, priceRange: "Rs Rs", description: "Iconic Goa bakery cafe since 1993", openNow: true },
  { id: 3, name: "A Reverie", category: "cafe", area: "Panjim", lat: 15.4978, lng: 73.8311, rating: 4.6, reviews: 521, priceRange: "Rs Rs", description: "Quirky cafe with eclectic decor in heritage Fontainhas", openNow: true },
  { id: 4, name: "Pousada by the Beach", category: "cafe", area: "Calangute", lat: 15.5440, lng: 73.7628, rating: 4.4, reviews: 543, priceRange: "Rs Rs", description: "Charming Portuguese villa cafe with garden brunch", openNow: true },

  { id: 5, name: "Sublime", category: "restobar", area: "Vagator", lat: 15.6027, lng: 73.7351, rating: 4.8, reviews: 891, priceRange: "Rs Rs Rs", description: "Award-winning fine dining with cliff views", openNow: true },
  { id: 6, name: "Thalassa", category: "restobar", area: "Vagator", lat: 15.6018, lng: 73.7344, rating: 4.5, reviews: 1204, priceRange: "Rs Rs Rs", description: "Greek restaurant with stunning sunset cliff seating", openNow: true },
  { id: 7, name: "Antares", category: "restobar", area: "Vagator", lat: 15.6021, lng: 73.7340, rating: 4.7, reviews: 567, priceRange: "Rs Rs Rs", description: "Chef Floyd's beach-view restaurant and beach club", openNow: true },
  { id: 8, name: "Curlies Beach Shack", category: "restobar", area: "Anjuna", lat: 15.5766, lng: 73.7404, rating: 4.2, reviews: 2341, priceRange: "Rs Rs", description: "Legendary Anjuna beach shack and party spot", openNow: true },
  { id: 9, name: "Black Sheep Bistro", category: "restobar", area: "Panjim", lat: 15.4989, lng: 73.8278, rating: 4.7, reviews: 654, priceRange: "Rs Rs Rs", description: "Craft cocktails and innovative Goan cuisine", openNow: false },
  { id: 10, name: "Bomra's", category: "restobar", area: "Panjim", lat: 15.5004, lng: 73.8267, rating: 4.8, reviews: 432, priceRange: "Rs Rs Rs", description: "Burmese fine dining, one of Goa's best kept secrets", openNow: false },
  { id: 11, name: "Gunpowder", category: "restobar", area: "Assagao", lat: 15.5891, lng: 73.7629, rating: 4.7, reviews: 789, priceRange: "Rs Rs", description: "South Indian cuisine in a beautiful garden setting", openNow: true },
  { id: 12, name: "La Plage", category: "restobar", area: "Ashvem", lat: 15.6531, lng: 73.7128, rating: 4.6, reviews: 445, priceRange: "Rs Rs Rs", description: "French beach restaurant, Goa's most stylish lunch spot", openNow: true },

  { id: 13, name: "Britto's", category: "seafood", area: "Baga", lat: 15.5609, lng: 73.7521, rating: 4.3, reviews: 3102, priceRange: "Rs Rs", description: "Famous beachside seafood and live music", openNow: true },
  { id: 14, name: "Fisherman's Wharf", category: "seafood", area: "Cavelossim", lat: 15.1824, lng: 73.9478, rating: 4.4, reviews: 1876, priceRange: "Rs Rs", description: "Riverside seafood with authentic Goan fish curry", openNow: true },
  { id: 15, name: "Mum's Kitchen", category: "seafood", area: "Panjim", lat: 15.4956, lng: 73.8289, rating: 4.8, reviews: 1123, priceRange: "Rs Rs", description: "Legendary home-style Goan food and family recipes", openNow: true },
  { id: 16, name: "Vinayak Family Restaurant", category: "seafood", area: "Margao", lat: 15.2832, lng: 73.9862, rating: 4.5, reviews: 2341, priceRange: "Rs", description: "No-frills local legend for fish thali in South Goa", openNow: true },

  { id: 17, name: "Sweet Water Lake", category: "hidden_gem", area: "Arambol", lat: 15.6891, lng: 73.7021, rating: 4.9, reviews: 234, priceRange: "Rs", description: "Freshwater lake behind Arambol beach, magical at sunset", openNow: true },
  { id: 18, name: "Chapora Fort", category: "hidden_gem", area: "Vagator", lat: 15.6089, lng: 73.7289, rating: 4.7, reviews: 3421, priceRange: "Rs", description: "Portuguese fort with wide coastal views over Vagator", openNow: true },

  { id: 19, name: "Morjim Beach", category: "beach", area: "Morjim", lat: 15.6390, lng: 73.7219, rating: 4.5, reviews: 1234, priceRange: "Rs", description: "Quiet turtle-nesting beach with a calmer North Goa feel", openNow: true },
  { id: 20, name: "Mandrem Beach", category: "beach", area: "Mandrem", lat: 15.6612, lng: 73.7134, rating: 4.8, reviews: 876, priceRange: "Rs", description: "Peaceful beach for yoga, long walks and sunsets", openNow: true },

  { id: 21, name: "Raju Bike Rentals", category: "scooter_rental", area: "Baga", lat: 15.5630, lng: 73.7510, rating: 4.3, reviews: 187, priceRange: "Rs", description: "Activa and scooters from Rs 300/day. Daily and weekly rates available.", openNow: true },
  { id: 22, name: "Morjim Bike Rentals", category: "scooter_rental", area: "Morjim", lat: 15.6385, lng: 73.7225, rating: 4.2, reviews: 143, priceRange: "Rs", description: "Scooters from Rs 300-500/day depending on model. Right at the beach.", openNow: true },
  { id: 23, name: "Palolem Scooter Rentals", category: "scooter_rental", area: "Palolem", lat: 15.0100, lng: 74.0230, rating: 4.1, reviews: 98, priceRange: "Rs", description: "South Goa rentals from Rs 400-500/day. Good condition bikes.", openNow: true },
];

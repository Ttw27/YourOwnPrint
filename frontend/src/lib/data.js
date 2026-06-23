// Static seed data (sectors, reviews) used across themes.
export const SECTORS = [
  { name: "Construction & Trades", image: "https://images.pexels.com/photos/8821005/pexels-photo-8821005.jpeg" },
  { name: "Healthcare", image: "https://images.pexels.com/photos/5430213/pexels-photo-5430213.jpeg" },
  { name: "Hospitality", image: "https://images.pexels.com/photos/15323377/pexels-photo-15323377.png" },
  { name: "Retail", image: "https://images.pexels.com/photos/18703556/pexels-photo-18703556.jpeg" },
  { name: "Sports & Fitness", image: "https://images.pexels.com/photos/12097160/pexels-photo-12097160.jpeg" },
  { name: "Dance & Theatre", image: "https://images.pexels.com/photos/4250534/pexels-photo-4250534.jpeg" },
  { name: "Schools & Leavers", image: "https://images.pexels.com/photos/8926904/pexels-photo-8926904.jpeg" },
  { name: "Hi-Vis", image: "https://images.pexels.com/photos/34859873/pexels-photo-34859873.jpeg" },
  { name: "Security", image: "https://images.pexels.com/photos/35562107/pexels-photo-35562107.png" },
  { name: "Beauty & Wellness", image: "https://images.pexels.com/photos/6899554/pexels-photo-6899554.jpeg" },
];

export const BEST_SELLERS = [
  { id: "personalised-tee", name: "Personalised T-Shirt", price: "£6.99", image: "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg" },
  { id: "personalised-hoodie", name: "Hoodie", price: "£14.99", image: "https://images.pexels.com/photos/8217544/pexels-photo-8217544.jpeg" },
  { id: "kids-tee", name: "Kids T-Shirt", price: "£7.99", image: "https://images.pexels.com/photos/31977041/pexels-photo-31977041.jpeg" },
  { id: "polo-shirt", name: "Polo", price: "£8.99", image: "https://images.pexels.com/photos/26063373/pexels-photo-26063373.jpeg" },
];

export const REVIEWS = [
  {
    name: "Simon Chinery",
    rating: 5,
    title: "Great quality, great printing",
    body: "Great quality product, great printing. Took a little longer than my other orders but all good.",
    product: "Personalised Hoodie",
  },
  {
    name: "David Davies",
    rating: 5,
    title: "I'll be back!",
    body: "Comprehensive catalogue of great items with a print quality that's second to none. Terrific work guys.",
    product: "Personalised T-Shirt",
  },
  {
    name: "Adele P.",
    rating: 5,
    title: "Highly recommend",
    body: "Had a personalised t-shirt made for my husband. Quality was brilliant and just how I wanted it.",
    product: "Personalised T-Shirt",
  },
];

export const TRUST_ITEMS = [
  "No Minimum Orders",
  "No Setup Fees",
  "Free Logo Design",
  "UK Based",
  "Free Print Included",
  "Fast UK Dispatch",
];

export const RATING = { value: 4.5, count: 404 };

// ---- WhatsApp ----
// Swap this number whenever you're ready (placeholder for now).
export const WHATSAPP_NUMBER_RAW = "+447000000000";  // E.164
export const WHATSAPP_NUMBER_DISPLAY = "+44 7000 000000";
export const buildWhatsAppLink = (preset = "Hi! I'd like some help with my custom print order.") =>
  `https://wa.me/${WHATSAPP_NUMBER_RAW.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(preset)}`;

export const NAV_LINKS = [
  { label: "Workwear", to: "/workwear" },
  { label: "Teams & Schools", to: "/teams-schools" },
  { label: "Sports & Combat", to: "/sports" },
  { label: "Team Kit Builder", to: "/team-kit-builder" },
  { label: "Design Your Own", to: "/design", highlight: true },
  { label: "Get a Quote", to: "/contact" },
];

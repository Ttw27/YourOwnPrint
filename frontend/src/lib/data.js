// Static seed data (sectors, reviews) used across themes.
export const SECTORS = [
  // `href` is where the chip/tile links to. Previously these were rendered as
  // plain <span>s on the Workwear page — styled to look clickable (cursor,
  // hover colour) but doing nothing at all when clicked.
  { name: "Construction & Trades", href: "/industries/construction-trades", image: "https://images.pexels.com/photos/8821005/pexels-photo-8821005.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { name: "Healthcare", href: "/industries/healthcare", image: "https://images.pexels.com/photos/5430213/pexels-photo-5430213.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { name: "Hospitality", href: "/industries/hospitality-catering", image: "https://images.pexels.com/photos/15323377/pexels-photo-15323377.png?auto=compress&cs=tinysrgb&w=800" },
  { name: "Retail", href: "/industries/retail", image: "https://images.pexels.com/photos/18703556/pexels-photo-18703556.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { name: "Sports & Fitness", href: "/industries/sports-fitness", image: "https://images.pexels.com/photos/12097160/pexels-photo-12097160.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { name: "Dance & Theatre", href: "/sports", image: "https://images.pexels.com/photos/4250534/pexels-photo-4250534.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { name: "Schools & Leavers", href: "/leavers-hoodies", image: "https://images.pexels.com/photos/8926904/pexels-photo-8926904.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { name: "Hi-Vis", href: "/shop/hi-vis", image: "https://images.pexels.com/photos/34859873/pexels-photo-34859873.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { name: "Security", href: "/industries/security", image: "https://images.pexels.com/photos/35562107/pexels-photo-35562107.png?auto=compress&cs=tinysrgb&w=800" },
  { name: "Beauty & Wellness", href: "/industries/beauty-wellness", image: "https://images.pexels.com/photos/6899554/pexels-photo-6899554.jpeg?auto=compress&cs=tinysrgb&w=800" },
];

export const BEST_SELLERS = [
  { id: "personalised-tee", name: "Personalised T-Shirt", price: "£6.99", image: "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { id: "personalised-hoodie", name: "Hoodie", price: "£14.99", image: "https://images.pexels.com/photos/8217544/pexels-photo-8217544.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { id: "kids-tee", name: "Kids T-Shirt", price: "£7.99", image: "https://images.pexels.com/photos/31977041/pexels-photo-31977041.jpeg?auto=compress&cs=tinysrgb&w=800" },
  { id: "polo-shirt", name: "Polo", price: "£8.99", image: "https://images.pexels.com/photos/26063373/pexels-photo-26063373.jpeg?auto=compress&cs=tinysrgb&w=800" },
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
  { label: "Specials", to: "/specials", highlight: true },
  { label: "Workwear", to: "/workwear" },
  { label: "Kit Workforce", to: "/workforce" },
  { label: "Teams & Schools", to: "/teams-schools" },
  { label: "Sports & Combat", to: "/sports" },
  { label: "Team Kits", to: "/team-kits" },
  { label: "Leavers'", to: "/leavers-hoodies" },
  { label: "Design Your Own", to: "/design" },
  { label: "Get a Quote", to: "/contact" },
];

// Structured menu used by the mega-menu navbar (fallback when /api/navigation isn't reachable).
export const NAV_MENU = [
  {
    key: "shop",
    label: "Shop",
    columns: [
      {
        heading: "Featured",
        links: [
          { label: "Your Own Print Specials", to: "/specials", badge: "Starter" },
          { label: "Kit Your Workforce", to: "/workforce", badge: "Bulk" },
          { label: "Workwear", to: "/workwear" },
          { label: "Portfolio", to: "/portfolio" },
        ],
      },
      {
        heading: "By collection",
        links: [
          { label: "Fight Night Tees", to: "/fight-night-tee" },
          { label: "Festival & DJ Merch", to: "/festival-tees-and-brands" },
          { label: "Leavers' Hoodies", to: "/leavers-hoodies" },
          { label: "Team Kits", to: "/team-kits" },
          { label: "Teams & Schools", to: "/teams-schools" },
        ],
      },
      {
        heading: "By garment",
        links: [
          { label: "T-shirts", to: "/shop/t-shirts" },
          { label: "Hoodies", to: "/shop/hoodies" },
          { label: "Polos", to: "/shop/polos" },
          { label: "Sweatshirts", to: "/shop/sweatshirts" },
          { label: "Jackets", to: "/shop/jackets" },
          { label: "Hi-Vis", to: "/shop/hi-vis" },
          { label: "Joggers & Trousers", to: "/shop/bottoms" },
          { label: "Aprons", to: "/shop/aprons" },
          { label: "Shorts", to: "/shop/shorts" },
          { label: "Promotional & Gifts", to: "/shop/promotional" },
          { label: "Accessories", to: "/shop/accessories" },
        ],
      },
    ],
  },
  {
    key: "teams",
    label: "Sports & Fitness",
    columns: [
      {
        heading: "Sports",
        links: [
          { label: "Football Kits", to: "/sports-teams/football" },
          { label: "Rugby Kits", to: "/sports-teams/rugby" },
          { label: "Team Kits configurator", to: "/team-kits" },
        ],
      },
      {
        heading: "Fitness",
        links: [
          { label: "Gyms", to: "/sports-teams/gyms" },
          { label: "Personal Trainers", to: "/sports-teams/personal-trainers" },
          { label: "Boxing Gyms", to: "/sports-teams/boxing-gyms" },
          { label: "Thai Boxing", to: "/sports-teams/thai-boxing" },
          { label: "Kickboxing", to: "/sports-teams/kick-boxing" },
          { label: "Dance Studios", to: "/sports-teams/dance-studios" },
        ],
      },
      {
        heading: "Schools & Leavers",
        links: [
          { label: "Teams & Schools", to: "/teams-schools" },
          { label: "Leavers' Hoodies", to: "/leavers-hoodies" },
          { label: "Fight Night Tees", to: "/fight-night-tee" },
        ],
      },
    ],
  },
  {
    key: "industries",
    label: "Workwear",
    columns: [
      {
        heading: "Trades & Site",
        links: [
          { label: "Construction & Trades", to: "/industries/construction-trades" },
          { label: "Industrial", to: "/industries/industrial" },
          { label: "Cleaning & Maintenance", to: "/industries/cleaning" },
          { label: "Kit Your Workforce", to: "/workforce", badge: "Bulk" },
        ],
      },
      {
        heading: "Front-of-house",
        links: [
          { label: "Healthcare", to: "/industries/healthcare" },
          { label: "Hospitality & Catering", to: "/industries/hospitality-catering" },
          { label: "Retail", to: "/industries/retail" },
          { label: "Beauty & Wellness", to: "/industries/beauty-wellness" },
        ],
      },
      {
        heading: "Office & Field",
        links: [
          { label: "Corporate", to: "/industries/corporate" },
          { label: "Security", to: "/industries/security" },
          { label: "Sports & Fitness", to: "/industries/sports-fitness" },
          { label: "All Industries →", to: "/industries" },
        ],
      },
    ],
  },
  { key: "portfolio", label: "Portfolio", to: "/portfolio" },
  { key: "design", label: "Design Your Own", to: "/design" },
  { key: "contact", label: "Get a quote", to: "/contact", cta: true },
];

// 5 hero tools showcased across the site
export const TOOLS_SHOWCASE = [
  { key: "design", title: "Design Your Own", tagline: "Live canvas. Drag, upload, type. Print-ready in minutes.", to: "/design", image: "https://images.pexels.com/photos/3826676/pexels-photo-3826676.jpeg?auto=compress&cs=tinysrgb&w=800", colour: "#fde68a", accent: "#1a1a1a" },
  { key: "specials", title: "Your Own Print Specials", tagline: "Starter lineup. No MOQ. Breast logo included.", to: "/specials", image: "https://images.pexels.com/photos/8217544/pexels-photo-8217544.jpeg?auto=compress&cs=tinysrgb&w=800", colour: "#7bc67e", accent: "#1a1a1a" },
  { key: "workforce", title: "Kit Your Workforce", tagline: "Mixed garments, bulk tiers, one logo across the lot.", to: "/workforce", image: "https://images.pexels.com/photos/8961326/pexels-photo-8961326.jpeg?auto=compress&cs=tinysrgb&w=800", colour: "#fbbf24", accent: "#1a1a1a" },
  { key: "team-kits", title: "Team Kits", tagline: "Configurator for clubs and squads — front, back, sleeves.", to: "/team-kits", image: "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg?auto=compress&cs=tinysrgb&w=800", colour: "#a78bfa", accent: "#1a1a1a" },
  { key: "fight-night", title: "Fight Night Tees", tagline: "Branded tees for fight cards, gyms and combat events.", to: "/sports/fight-night", image: "https://images.pexels.com/photos/4761792/pexels-photo-4761792.jpeg?auto=compress&cs=tinysrgb&w=800", colour: "#f87171", accent: "#ffffff" },
];

export const GENDER_FITS = [
  { id: "all", label: "All" },
  { id: "mens", label: "Men's" },
  { id: "womens", label: "Women's" },
  { id: "unisex", label: "Unisex" },
  { id: "kids", label: "Kids" },
];

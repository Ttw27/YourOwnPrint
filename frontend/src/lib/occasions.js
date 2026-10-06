// Seasonal / occasion landing pages (/occasions/:slug). Text, photo, FAQ and
// button can all be changed in Admin > Page copy ("Occasion: ..."); these are
// the defaults. `months` (1-12) = when the homepage seasonal banner shows it.
export const OCCASIONS = {
  christmas: {
    months: [10, 11, 12],
    accent: "from-[#b91c1c] via-[#166534] to-[#1a1a1a]",
    kicker: "Christmas",
    title: "Staff Christmas, sorted.",
    subtitle: "Christmas party tees, festive sweatshirts for the whole team, and personalised gifts - printed in Leicester and delivered before the big day.",
    bullets: ["Christmas party tees from £6.99 each (10+)", "Your logo or a festive design on sweatshirts & hoodies", "Personalised gifts - teddies, beanies, tote bags", "Order by early December for Christmas delivery"],
    ctas: [
      { label: "Design a Christmas sweatshirt", to: "/design?product=workwear-sweatshirt" },
      { label: "Party tees from £6.99", to: "/design?product=personalised-tee" },
      { label: "Kit the whole team", to: "/workforce" },
    ],
    products: ["gd56", "jh030", "gd57", "bb486", "bb459", "mm573", "mm563", "bg184"],
    faq: [
      { q: "When do I need to order for Christmas?", a: "Aim for early December for UK delivery before Christmas - the sooner the better for big team orders." },
      { q: "Can you do a different name on each one?", a: "Yes - in the designer or on a team order, add names and we'll print each one personally." },
      { q: "Do you do Christmas jumpers?", a: "We print festive designs on soft sweatshirts and hoodies in red, green, navy and more - your logo, a festive slogan or both." },
    ],
  },
  "stag-and-hen": {
    months: [4, 5, 6, 7],
    accent: "from-[#f472b6] via-[#a855f7] to-[#1a1a1a]",
    kicker: "Stag & hen",
    title: "Stag & hen tees everyone will actually wear.",
    subtitle: "Matching tees, vests and bucket hats with names, nicknames and the date - design it yourself in minutes.",
    bullets: ["Tees from £6.99 each for 10+", "A different name or nickname on every back", "Vests and bucket hats for sunny weekends away", "Free proof before we print"],
    ctas: [
      { label: "Design your tees", to: "/design?product=personalised-tee" },
      { label: "Get a quote", to: "/contact" },
    ],
    products: ["gd01", "gd77", "gd12", "jc007", "bb88", "bb90n", "bg184"],
    faq: [
      { q: "Can everyone have their own name?", a: "Yes - add each name in the designer or send us a list, and we print them individually." },
      { q: "How quickly can you print?", a: "Tell us your date and we'll let you know - most group orders are printed within a week or two of approving the proof." },
    ],
  },
  "charity-events": {
    months: [3, 4, 5, 6, 7, 8, 9],
    accent: "from-[#0ea5e9] via-[#7bc67e] to-[#1a1a1a]",
    kicker: "Charity & events",
    title: "Kit for fun runs, sponsored walks and fundraisers.",
    subtitle: "Bright team tees, wicking running tops, hi-vis for marshals and tote bags for the stalls - with your charity's logo.",
    bullets: ["Wicking running tees from £6.99", "Kids sizes for the whole family", "Hi-vis vests for marshals", "Sponsor logos on the back"],
    ctas: [
      { label: "Design your event tee", to: "/design?product=personalised-tee" },
      { label: "Get a quote for the team", to: "/contact" },
    ],
    products: ["jc001", "gd01", "gd01b", "jc007", "pw002", "w101", "bb88"],
    faq: [
      { q: "Do you do discounts for charities?", a: "Bigger orders get bulk pricing automatically - get in touch and tell us about your event." },
      { q: "Can we add sponsors?", a: "Yes - sponsor logos on the back or sleeves are easy to add." },
    ],
  },
  "back-to-school": {
    months: [8, 9],
    accent: "from-[#7bc67e] via-[#fde68a] to-[#1a1a1a]",
    kicker: "New term",
    title: "New season kit for clubs, schools and staff.",
    subtitle: "Club kits, staff uniform, kids' hoodies and book bags - all with your badge, ready for the new term.",
    bullets: ["Football kits from real AWDis kit, adults + kids", "Staff packs for schools", "Kids' hoodies and tees in 40+ colours", "Printed book bags"],
    ctas: [
      { label: "Team kits", to: "/team-kits" },
      { label: "Dance studio kit", to: "/dance-studio-kit" },
      { label: "Parent order link", to: "/club-shop/new" },
      { label: "School staff pack", to: "/product/bundle-school-staff-pack-10-people" },
    ],
    products: ["kit-classic", "jh001b", "gd01b", "qd456", "bundle-school-staff-pack-10-people", "jc001b"],
    faq: [
      { q: "Do you do kids' sizes?", a: "Yes - most of our club and school garments come in kids' sizes from age 3-4." },
      { q: "Can parents order themselves?", a: "Ask us about a parent order list - each family orders and pays for their own and we print them together." },
    ],
  },
};

export function currentOccasion(date = new Date()) {
  const m = date.getMonth() + 1;
  // most specific first
  for (const slug of ["christmas", "back-to-school", "stag-and-hen", "charity-events"]) {
    if (OCCASIONS[slug].months.includes(m)) return slug;
  }
  return null; // Jan-Feb: leavers season (homepage shows the leavers banner instead)
}

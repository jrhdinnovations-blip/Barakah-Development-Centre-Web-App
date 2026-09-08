export const ORG = {
  legalName: "Barakah Development Centre Limited",
  shortName: "Barakah",
  rc: "RC 9564724",
  founder: "Imam Muhammad Jamilu Ibrahim",
  founderTitle: "Executive Director & CEO",
  address: "Suite S3, No. 20 Rwang Pam Street, Jos, Plateau State, Nigeria",
  phones: ["07066272531", "07044223076", "07041626545"],
  email: "barakahdevelopmentcentre@gmail.com",
  website: "barakahdevelopmentcentre.org",
  tagline: "Building a Better Today for a Brighter Tomorrow",
  vision:
    "To build a better today for a brighter tomorrow by developing empowered people, capable institutions and thriving communities.",
  mission:
    "To empower individuals, strengthen institutions and transform communities through knowledge, leadership, innovation and service.",
  promise: [
    "Empowering People",
    "Building Skills",
    "Creating Opportunities",
    "Serving Communities",
  ],
  values: [
    "Faith",
    "Knowledge",
    "Service",
    "Impact",
    "Trust",
    "Inclusion",
    "Excellence",
    "Accountability",
  ],
} as const;

export type NavItem = {
  label: string;
  to: string;
  description?: string;
  children?: NavItem[];
};

export const NAV: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  {
    label: "What We Do",
    to: "/what-we-do",
    children: [
      { label: "Learn & Develop", to: "/learn-and-develop", description: "Courses, training and mentorship" },
      { label: "Enterprise & Ventures", to: "/enterprise-and-ventures", description: "Skills, incubation and trade" },
      { label: "SwiftMove Logistics & Ride Hailing", to: "/my-swift-move", description: "Dispatch, delivery and on-demand rides" },
      { label: "Travel & Pilgrimage", to: "/travel-and-pilgrimage", description: "Umrah support and travel services" },
      { label: "Community & Humanitarian", to: "/community-and-humanitarian", description: "Relief, welfare and outreach" },
      { label: "Peace & Institutional Services", to: "/peace-and-institutional-services", description: "Research, mediation and advisory" },
    ],
  },
  {
    label: "Get Involved",
    to: "/volunteer",
    children: [
      { label: "Courses", to: "/learn", description: "Browse the course catalogue" },
      { label: "Travel & Pilgrimage", to: "/travel", description: "Umrah, Hajj and travel packages" },
      { label: "Book a Session", to: "/bookings", description: "Counselling, training and appointments" },
      { label: "Marketplace", to: "/market", description: "Products and digital downloads" },
      { label: "Volunteer", to: "/volunteer", description: "Give your time and skills" },
    ],
  },

  { label: "Media & Insights", to: "/media-and-insights" },
  { label: "Partners", to: "/partners" },
  { label: "Impact", to: "/impact" },
  { label: "Contact", to: "/contact" },
];

export const ECO_ACTIONS = [
  { label: "Learn", to: "/learn-and-develop" },
  { label: "Build a Business", to: "/enterprise-and-ventures" },
  { label: "Find Training", to: "/learn-and-develop" },
  { label: "Book Umrah Support", to: "/travel-and-pilgrimage" },
  { label: "Request Help", to: "/community-and-humanitarian" },
  { label: "Volunteer", to: "/community-and-humanitarian" },
  { label: "Partner With Us", to: "/partners" },
  { label: "Access Counselling", to: "/peace-and-institutional-services" },
  { label: "Commission Research", to: "/peace-and-institutional-services" },
  { label: "Buy Products", to: "/enterprise-and-ventures" },
  { label: "Use SwiftMove Logistics", to: "/my-swift-move" },
  { label: "Send a Package", to: "/my-swift-move" },
  { label: "Request a Ride", to: "/my-vehicle-hires" },
  { label: "Drive for SwiftMove", to: "/drive" },
  { label: "Watch / Learn", to: "/media-and-insights" },
  { label: "Support a Campaign", to: "/impact" },
] as const;

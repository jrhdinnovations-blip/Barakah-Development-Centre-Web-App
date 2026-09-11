import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export type MediaFolder = "all" | "gallery" | "events" | "news" | "general" | "documents";

export interface PublicMediaItem {
  id: string;
  name: string;
  title: string;
  url: string;
  folder: string;
  type: "image" | "video" | "document";
  size?: number;
  mimeType?: string;
  createdAt: string;
  isUploaded?: boolean;
}

export interface InsightArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: "Leadership & Impact" | "Logistics & Innovation" | "Sacred Journeys" | "Youth & Empowerment" | "Community Welfare";
  categoryColor: string;
  date: string;
  readTime: string;
  author: string;
  authorRole: string;
  coverImage: string;
  tags: string[];
  content: string[];
}

export const INSIGHT_ARTICLES: InsightArticle[] = [
  {
    id: "insight-1",
    slug: "strategic-vision-2026-barakah-development-centre",
    title: "Building a Better Today for a Brighter Tomorrow: The 2026 Vision",
    summary: "How Barakah Development Centre is bridging socio-economic gaps through unified enterprise, logistics, human capital development, and community impact.",
    category: "Leadership & Impact",
    categoryColor: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    date: "September 2026",
    readTime: "5 min read",
    author: "Imam Muhammad Jamilu Ibrahim",
    authorRole: "Executive Director & CEO",
    coverImage: "/barakah-centre-logo.png",
    tags: ["Leadership", "Vision", "Community Development", "Nigeria"],
    content: [
      "The challenges of our time require visionary solutions anchored in timeless moral integrity. At Barakah Development Centre, our guiding philosophy — Building a Better Today for a Brighter Tomorrow — is not merely an institutional motto, but an operational blueprint.",
      "Over the past years, we have observed how fragmented interventions often fail to achieve lasting economic upliftment. To break cycles of dependency, we established an interconnected ecosystem where logistics, vocational education, sacred hospitality, and humanitarian relief reinforce one another.",
      "Every parcel delivered via SwiftMove generates sustainable livelihoods for dedicated couriers while subsidizing community welfare outreach. Every training program delivered through Learn & Develop creates capable entrepreneurs who in turn hire youth from our neighborhoods.",
      "As we advance through 2026, our commitment remains unshakable: empowering individuals, strengthening institutions, and transforming communities with faith, knowledge, excellence, and accountability."
    ]
  },
  {
    id: "insight-2",
    slug: "swiftmove-ethical-logistics-ride-hailing",
    title: "SwiftMove: Revolutionizing Ethical Logistics & Ride-Hailing",
    summary: "A deep dive into our on-demand fleet operations, rider empowerment initiatives, and technology infrastructure connecting Plateau State and beyond.",
    category: "Logistics & Innovation",
    categoryColor: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    date: "August 2026",
    readTime: "4 min read",
    author: "SwiftMove Operations Desk",
    authorRole: "Logistics & Fleet Team",
    coverImage: "/barakah-centre-logo.png",
    tags: ["SwiftMove", "Logistics", "Ride Hailing", "Tech"],
    content: [
      "Urban mobility and parcel dispatch in emerging hubs have historically suffered from unpredictable pricing, opaque tracking, and unfair commission models that squeeze drivers.",
      "SwiftMove was conceived to balance efficiency with equity. With transparent per-kilometer and weight-based pricing, real-time GPS telemetry, and driver welfare funds, we provide reliable courier solutions for local businesses, online vendors, and individual customers.",
      "Our fleet includes agile delivery motorcycles, intra-city cars, and specialized cargo vehicles capable of handling diverse logistical requirements — from express pharmaceutical delivery to heavy freight.",
      "Looking forward, SwiftMove is expanding smart fleet corridors between Jos, Abuja, Kaduna, and Bauchi, creating high-trust distribution pipelines that fuel Northern Nigeria's commercial growth."
    ]
  },
  {
    id: "insight-3",
    slug: "sacred-journeys-umrah-hajj-preparation-guide",
    title: "Sacred Steps: Spiritual & Practical Guidance for Umrah & Hajj",
    summary: "Essential advice for pilgrims embarking on spiritual journeys with Barakah Travel & Tours Limited, covering physical preparation, rituals, and mentorship.",
    category: "Sacred Journeys",
    categoryColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    date: "July 2026",
    readTime: "6 min read",
    author: "Shari'ah & Pilgrimage Advisory Board",
    authorRole: "Barakah Travel & Tours Ltd",
    coverImage: "/barakah-centre-logo.png",
    tags: ["Pilgrimage", "Umrah", "Hajj", "Spiritual Mentorship"],
    content: [
      "The pilgrimage to the Holy Lands is the journey of a lifetime. Yet too often, pilgrims find their spiritual experience marred by disorganized travel arrangements, substandard accommodations, and a lack of scholarly guidance.",
      "At Barakah Travel and Tours Limited, our pilgrimage programs are designed around two core principles: impeccable logistical care and authentic scholarly mentorship.",
      "Before departure, every pilgrim participates in comprehensive seminars covering the Fiqh of Manasik, personal wellness, and practical advice on navigating modern Saudi infrastructure with confidence and peace of mind.",
      "Our flexible instalment savings plans allow families and civil servants to plan their sacred journeys over 6 to 18 months without financial strain, ensuring that the call to the House of Allah remains accessible to all sincere believers."
    ]
  },
  {
    id: "insight-4",
    slug: "empowering-plateau-youth-vocational-skills",
    title: "Skills for Tomorrow: Empowering Plateau Youth with Digital & Trade Skills",
    summary: "Highlighting our training workshops in software, graphics design, mechanical repair, solar installation, and cooperative entrepreneurship.",
    category: "Youth & Empowerment",
    categoryColor: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    date: "June 2026",
    readTime: "4 min read",
    author: "Barakah Learn & Develop",
    authorRole: "Capacity Building Directorate",
    coverImage: "/barakah-centre-logo.png",
    tags: ["Youth", "Skills Acquisition", "Digital Economy", "Entrepreneurship"],
    content: [
      "Youth unemployment cannot be addressed by conventional classroom education alone. The contemporary labor market demands hands-on practical skills, digital literacy, and agile problem-solving.",
      "Through the Barakah Training and Development Institute, we have graduated hundreds of young men and women in computer programming, mobile device repair, solar inverter installation, tailoring, and bookkeeping.",
      "Crucially, our programs do not end on graduation day. Through our Enterprise & Ventures incubator, top graduates receive seed micro-grants, co-working access, and mentorship to launch self-sustaining cooperative enterprises.",
      "When we empower a youth with a skill, we transform an entire household and cultivate resilient ambassadors of communal peace and productivity."
    ]
  }
];

export const CURATED_SHOWCASE_MEDIA: PublicMediaItem[] = [
  {
    id: "curated-1",
    name: "barakah-centre-headquarters.jpg",
    title: "Barakah Development Centre Headquarters & Civic Hub",
    url: "/barakah-centre-logo.png",
    folder: "general",
    type: "image",
    createdAt: "2026-09-01T10:00:00Z",
    isUploaded: false,
  },
  {
    id: "curated-2",
    name: "swiftmove-fleet-dispatch.jpg",
    title: "SwiftMove Courier & Dispatch Fleet Ready for Service",
    url: "/barakah-centre-logo.png",
    folder: "events",
    type: "image",
    createdAt: "2026-08-25T14:30:00Z",
    isUploaded: false,
  },
  {
    id: "curated-3",
    name: "barakah-youth-graduation-ceremony.jpg",
    title: "Annual Youth Skills & Digital Empowerment Convocation",
    url: "/barakah-centre-logo.png",
    folder: "gallery",
    type: "image",
    createdAt: "2026-08-15T09:15:00Z",
    isUploaded: false,
  },
  {
    id: "curated-4",
    name: "sacred-travel-umrah-mentorship.jpg",
    title: "Pilgrims Pre-Departure Orientation Seminar in Jos",
    url: "/barakah-centre-logo.png",
    folder: "news",
    type: "image",
    createdAt: "2026-08-05T11:45:00Z",
    isUploaded: false,
  }
];

function humanizeFilename(name: string): string {
  // Remove leading timestamps like 1726051234567-
  const withoutTimestamp = name.replace(/^\d{10,14}[-_]/, "");
  // Remove file extension
  const withoutExt = withoutTimestamp.replace(/\.[^.]+$/, "");
  // Replace dashes and underscores with spaces
  const spaced = withoutExt.replace(/[-_]+/g, " ").trim();
  // Capitalize words
  if (!spaced) return name;
  return spaced
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function detectMediaType(name: string, mime?: string): "image" | "video" | "document" {
  if (mime) {
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("image/")) return "image";
    return "document";
  }
  const lower = name.toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(lower)) return "video";
  if (/\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)$/i.test(lower)) return "image";
  return "document";
}

const BUCKET = "site-media";

/**
 * Server function to fetch all public media items uploaded by admin.
 * Safe for anonymous public site visitors.
 */
export const fetchPublicMediaFiles = createServerFn({ method: "GET" })
  .validator((d: { folder?: string } | undefined) => d || {})
  .handler(async ({ data }) => {
    const targetFolder = data?.folder && data.folder !== "all" ? [data.folder] : ["gallery", "events", "news", "general"];

    let uploadedFiles: PublicMediaItem[] = [];

    try {
      const { supabaseAdmin, hasServiceRoleKey } = await import("@/integrations/supabase/client.server");
      const client = hasServiceRoleKey ? supabaseAdmin : supabase;

      for (const folder of targetFolder) {
        try {
          const { data: listData, error } = await client.storage
            .from(BUCKET)
            .list(folder, { limit: 150, sortBy: { column: "created_at", order: "desc" } });

          if (!error && listData) {
            const valid = listData
              .filter(f => f.name && f.name !== ".emptyFolderPlaceholder")
              .map(f => {
                const mediaType = detectMediaType(f.name, (f.metadata as any)?.mimetype);
                const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(folder + "/" + f.name);
                return {
                  id: f.id || folder + "-" + f.name,
                  name: f.name,
                  title: humanizeFilename(f.name),
                  url: urlData.publicUrl,
                  folder,
                  type: mediaType,
                  size: (f.metadata as any)?.size,
                  mimeType: (f.metadata as any)?.mimetype,
                  createdAt: f.created_at || new Date().toISOString(),
                  isUploaded: true,
                } as PublicMediaItem;
              });

            uploadedFiles.push(...valid);
          }
        } catch (folderErr) {
          console.warn("Could not list folder " + folder + ":", folderErr);
        }
      }
    } catch (err) {
      console.warn("Server storage list warning:", err);
    }

    // Sort uploaded files by date newest first
    uploadedFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      uploaded: uploadedFiles,
      curated: CURATED_SHOWCASE_MEDIA,
      all: [...uploadedFiles, ...CURATED_SHOWCASE_MEDIA],
    };
  });

/**
 * Client-friendly helper to load public media.
 * Attempts server function first, then falls back to direct client Supabase storage.
 */
export async function getPublicMedia(folder: MediaFolder = "all"): Promise<{
  items: PublicMediaItem[];
  uploadedCount: number;
  totalCount: number;
}> {
  try {
    const res = await fetchPublicMediaFiles({ data: { folder } });
    if (res && res.all) {
      const filtered = folder === "all" ? res.all : res.all.filter(item => item.folder === folder);
      return {
        items: filtered,
        uploadedCount: res.uploaded.length,
        totalCount: filtered.length,
      };
    }
  } catch (serverErr) {
    console.warn("Public media server function error, using client fallback:", serverErr);
  }

  // Client-side fallback
  try {
    const foldersToFetch = folder === "all" ? ["gallery", "events", "news", "general"] : [folder];
    const clientItems: PublicMediaItem[] = [];

    for (const f of foldersToFetch) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(f, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (!error && data) {
        data
          .filter(item => item.name && item.name !== ".emptyFolderPlaceholder")
          .forEach(item => {
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(f + "/" + item.name);
            clientItems.push({
              id: item.id || f + "-" + item.name,
              name: item.name,
              title: humanizeFilename(item.name),
              url: urlData.publicUrl,
              folder: f,
              type: detectMediaType(item.name, (item.metadata as any)?.mimetype),
              size: (item.metadata as any)?.size,
              mimeType: (item.metadata as any)?.mimetype,
              createdAt: item.created_at || new Date().toISOString(),
              isUploaded: true,
            });
          });
      }
    }

    clientItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const combined = [...clientItems, ...CURATED_SHOWCASE_MEDIA];
    const finalItems = folder === "all" ? combined : combined.filter(i => i.folder === folder);

    return {
      items: finalItems,
      uploadedCount: clientItems.length,
      totalCount: finalItems.length,
    };
  } catch (clientErr) {
    console.error("Client storage fallback error:", clientErr);
    return {
      items: CURATED_SHOWCASE_MEDIA,
      uploadedCount: 0,
      totalCount: CURATED_SHOWCASE_MEDIA.length,
    };
  }
}

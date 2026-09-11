import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Image as ImageIcon, Film, Eye, Download, Share2, Search,
  X, ChevronLeft, ChevronRight, Check, Play, RefreshCw,
  Sparkles, Layers, BookOpen, Clock, Calendar, ArrowRight,
  ExternalLink, FileText, Filter, HardDrive, ShieldCheck, Mail
} from "lucide-react";
import {
  getPublicMedia,
  INSIGHT_ARTICLES,
  type PublicMediaItem,
  type InsightArticle,
  type MediaFolder
} from "@/lib/public-media.functions";
import { ORG } from "@/lib/site";
import { BarakahCentreLogo } from "@/components/BarakahCentreLogo";

export const Route = createFileRoute("/media-and-insights")({
  head: () => ({
    meta: [
      { title: "Media & Insights — Barakah Development Centre" },
      {
        name: "description",
        content: "Explore official photo galleries, videos, field documentaries, and editorial insights from Barakah Development Centre.",
      },
      { property: "og:title", content: "Media & Insights — Barakah Development Centre" },
      {
        property: "og:description",
        content: "Visual stories, videos, and strategic publications from Barakah Development Centre.",
      },
    ],
  }),
  component: MediaAndInsightsPage,
});

type FilterType = "all" | "image" | "video";
type ActiveTab = "all" | "media" | "insights";

const FOLDER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  all: { label: "All Media", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  gallery: { label: "Photo Gallery", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  events: { label: "Events & Summits", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  news: { label: "News & Press", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  general: { label: "General Hub", color: "text-slate-300", bg: "bg-slate-700/20 border-slate-600/30" },
};

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function MediaAndInsightsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder>("all");
  const [selectedType, setSelectedType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaItems, setMediaItems] = useState<PublicMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Lightbox & Modal States
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeArticle, setActiveArticle] = useState<InsightArticle | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Newsletter form state
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "submitting" | "success">("idle");

  const loadMedia = useCallback(async () => {
    try {
      const res = await getPublicMedia(selectedFolder);
      setMediaItems(res.items);
      setUploadedCount(res.uploadedCount);
    } catch (err) {
      console.error("Error loading public media:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFolder]);

  useEffect(() => {
    setLoading(true);
    loadMedia();
  }, [loadMedia]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMedia();
  };

  // Filter media items
  const filteredMedia = useMemo(() => {
    return mediaItems.filter((item) => {
      // Type filter
      if (selectedType === "image" && item.type !== "image") return false;
      if (selectedType === "video" && item.type !== "video") return false;

      // Folder filter (already handled if single folder requested, but safety check)
      if (selectedFolder !== "all" && item.folder !== selectedFolder) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesFolder = item.folder.toLowerCase().includes(q);
        if (!matchesTitle && !matchesName && !matchesFolder) return false;
      }

      return true;
    });
  }, [mediaItems, selectedType, selectedFolder, searchQuery]);

  // Filter articles
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return INSIGHT_ARTICLES;
    const q = searchQuery.toLowerCase();
    return INSIGHT_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Lightbox navigation
  const currentLightboxItem = lightboxIndex !== null ? filteredMedia[lightboxIndex] : null;

  const handlePrevLightbox = () => {
    if (lightboxIndex === null || filteredMedia.length === 0) return;
    setLightboxIndex((lightboxIndex - 1 + filteredMedia.length) % filteredMedia.length);
  };

  const handleNextLightbox = () => {
    if (lightboxIndex === null || filteredMedia.length === 0) return;
    setLightboxIndex((lightboxIndex + 1) % filteredMedia.length);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex !== null) {
        if (e.key === "Escape") setLightboxIndex(null);
        if (e.key === "ArrowLeft") handlePrevLightbox();
        if (e.key === "ArrowRight") handleNextLightbox();
      }
      if (activeArticle !== null && e.key === "Escape") {
        setActiveArticle(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, activeArticle, filteredMedia.length]);

  const copyMediaUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes("@")) return;
    setNewsletterStatus("submitting");
    setTimeout(() => {
      setNewsletterStatus("success");
      setNewsletterEmail("");
    }, 800);
  };

  const totalPhotos = mediaItems.filter((i) => i.type === "image").length;
  const totalVideos = mediaItems.filter((i) => i.type === "video").length;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* ── HERO SECTION ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-16 lg:pb-24 border-b border-slate-800/80">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -top-24 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center max-w-3xl mx-auto">
            
            {/* Medallion badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-semibold mb-6 shadow-xl backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Barakah Media & Insights Hub</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 font-normal">Building a Better Today</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-6">
              Stories of Impact,{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400">
                Faith & Action
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
              Explore high-resolution galleries, field documentaries, and strategic publications 
              documenting the transformative work of Barakah Development Centre across Northern Nigeria and beyond.
            </p>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto pt-2 pb-2">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-white">{mediaItems.length}</p>
                <p className="text-xs text-slate-400 font-medium">Total Media Assets</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-emerald-400">{totalPhotos}</p>
                <p className="text-xs text-slate-400 font-medium">Photographs</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-amber-400">{totalVideos}</p>
                <p className="text-xs text-slate-400 font-medium">Videos & Films</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-blue-400">{INSIGHT_ARTICLES.length}</p>
                <p className="text-xs text-slate-400 font-medium">In-Depth Insights</p>
              </div>
            </div>

            {/* Section Switcher Tabs */}
            <div className="flex items-center justify-center gap-2 mt-10 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-md mx-auto">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === "all"
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                All Highlights
              </button>
              <button
                onClick={() => setActiveTab("media")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === "media"
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                Media Gallery
              </button>
              <button
                onClick={() => setActiveTab("insights")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === "insights"
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Insights
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT AREA ──────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
        
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-sm">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search media, events, articles..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Controls: Type Filter & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type selector (only for media tab or all) */}
            {activeTab !== "insights" && (
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setSelectedType("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedType === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All Types
                </button>
                <button
                  onClick={() => setSelectedType("image")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedType === "image" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Photos
                </button>
                <button
                  onClick={() => setSelectedType("video")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedType === "video" ? "bg-slate-800 text-amber-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Film className="h-3.5 w-3.5" />
                  Videos
                </button>
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh live media feed"
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Folder Category Pills (When viewing media or all) */}
        {activeTab !== "insights" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
            {(Object.keys(FOLDER_LABELS) as MediaFolder[]).map((fKey) => {
              const info = FOLDER_LABELS[fKey];
              const isSelected = selectedFolder === fKey;
              return (
                <button
                  key={fKey}
                  onClick={() => setSelectedFolder(fKey)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? `${info.bg} ${info.color} shadow-md`
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  {info.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── SECTION: MEDIA GALLERY (PHOTOS & VIDEOS) ────────────────────────── */}
        {(activeTab === "all" || activeTab === "media") && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-amber-400" />
                  Live Visual Gallery
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Photos and high-definition video captures uploaded directly from the field
                </p>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
                {filteredMedia.length} {filteredMedia.length === 1 ? "item" : "items"}
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/30 border border-slate-800/80">
                <ImageIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white">No media found</h3>
                <p className="text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mt-1">
                  {searchQuery
                    ? `No media matches "${searchQuery}". Try another keyword or folder.`
                    : "No uploaded files found in this category yet."}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredMedia.map((item, index) => {
                  const isVid = item.type === "video";
                  const folderInfo = FOLDER_LABELS[item.folder] || FOLDER_LABELS.general;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setLightboxIndex(index)}
                      className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
                    >
                      {/* Media Thumbnail Container */}
                      <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
                        {isVid ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 text-amber-400 relative">
                            {/* Video background if possible */}
                            <video
                              src={item.url}
                              preload="metadata"
                              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                            />
                            {/* Overlay Play Badge */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                              <div className="h-12 w-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 group-hover:scale-110 transition-transform">
                                <Play className="h-6 w-6 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={item.url}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              // Fallback image if broken
                              (e.target as HTMLImageElement).src = "/barakah-centre-logo.png";
                            }}
                          />
                        )}

                        {/* Folder badge overlay */}
                        <div className="absolute top-3 left-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg backdrop-blur-md border ${folderInfo.bg} ${folderInfo.color}`}
                          >
                            {folderInfo.label}
                          </span>
                        </div>

                        {/* Media Type pill */}
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white border border-white/10">
                            {isVid ? <Film className="h-3 w-3 text-amber-400" /> : <ImageIcon className="h-3 w-3 text-emerald-400" />}
                            {isVid ? "Video" : "Photo"}
                          </span>
                        </div>

                        {/* Hover Quick Action */}
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg">
                            <Eye className="h-3.5 w-3.5" />
                            {isVid ? "Play Video" : "View Photo"}
                          </span>
                        </div>
                      </div>

                      {/* Card Information */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h3
                            className="text-sm font-semibold text-slate-200 group-hover:text-white line-clamp-1 transition-colors"
                            title={item.title}
                          >
                            {item.title}
                          </h3>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                            <span>{formatDate(item.createdAt)}</span>
                            {item.size && <span>{formatBytes(item.size)}</span>}
                          </div>
                        </div>

                        {/* Quick action bar */}
                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyMediaUrl(item.url);
                            }}
                            title="Copy Public Link"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
                          >
                            {copiedUrl === item.url ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            href={item.url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Download Media"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── SECTION: EDITORIAL INSIGHTS & STORIES ───────────────────────────── */}
        {(activeTab === "all" || activeTab === "insights") && (
          <section className="pt-4 mb-16">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-400" />
                  Strategic Insights & Perspectives
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Thought leadership, programmatic analyses, and official publications from Barakah Centre
                </p>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
                {filteredArticles.length} {filteredArticles.length === 1 ? "article" : "articles"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => setActiveArticle(article)}
                  className="group p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Category & Read Time */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${article.categoryColor}`}
                      >
                        {article.category}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {article.readTime}
                      </div>
                    </div>

                    {/* Title & Summary */}
                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-emerald-300 transition-colors mb-3 leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4 line-clamp-3">
                      {article.summary}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800/80 text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer: Author & CTA */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{article.author}</p>
                      <p className="text-[11px] text-slate-500">{article.authorRole}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                      Read Insight
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION: NEWSLETTER / PRESS SUBSCRIPTION ────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0a0f1c] to-slate-950 border border-slate-800 p-8 sm:p-12 mb-12 text-center">
          <div className="max-w-2xl mx-auto relative z-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-4 shadow-lg shadow-amber-500/5">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
              Stay Connected to Our Mission
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Subscribe to receive the latest photo chronicles, developmental reports, 
              and announcements directly from Barakah Development Centre.
            </p>

            {newsletterStatus === "success" ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center justify-center gap-2 max-w-md mx-auto">
                <Check className="h-4 w-4" />
                Thank you! You are now subscribed to Barakah Insights.
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === "submitting"}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all shrink-0"
                >
                  {newsletterStatus === "submitting" ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
            )}

            <p className="text-[11px] text-slate-500 mt-4">
              We respect your privacy. No spam. You may unsubscribe at any time.
            </p>
          </div>
        </section>

      </main>

      {/* ── CINEMA LIGHTBOX & VIDEO PLAYER MODAL ──────────────────────────────── */}
      {lightboxIndex !== null && currentLightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="p-4 sm:px-8 flex items-center justify-between border-b border-slate-800 bg-slate-950/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                  FOLDER_LABELS[currentLightboxItem.folder]?.bg || FOLDER_LABELS.general.bg
                } ${FOLDER_LABELS[currentLightboxItem.folder]?.color || FOLDER_LABELS.general.color}`}
              >
                {FOLDER_LABELS[currentLightboxItem.folder]?.label || "Media"}
              </span>
              <div>
                <h4 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                  {currentLightboxItem.title}
                </h4>
                <p className="text-[11px] text-slate-400">{formatDate(currentLightboxItem.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyMediaUrl(currentLightboxItem.url)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                {copiedUrl === currentLightboxItem.url ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </button>

              <a
                href={currentLightboxItem.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>

              <button
                onClick={() => setLightboxIndex(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors ml-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Center Stage: Image or Video */}
          <div
            className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {currentLightboxItem.type === "video" ? (
              <div className="w-full max-w-4xl max-h-[75vh] flex items-center justify-center">
                <video
                  src={currentLightboxItem.url}
                  controls
                  autoPlay
                  className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl border border-slate-800 bg-black"
                />
              </div>
            ) : (
              <div className="relative max-w-5xl max-h-[75vh] flex items-center justify-center">
                <img
                  src={currentLightboxItem.url}
                  alt={currentLightboxItem.title}
                  className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-800"
                />
              </div>
            )}

            {/* Left Navigation Arrow */}
            {filteredMedia.length > 1 && (
              <button
                onClick={handlePrevLightbox}
                className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-xl"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Right Navigation Arrow */}
            {filteredMedia.length > 1 && (
              <button
                onClick={handleNextLightbox}
                className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-xl"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Bottom Caption Bar */}
          <div
            className="p-4 sm:px-8 border-t border-slate-800 bg-slate-950/80 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-slate-400">
              {lightboxIndex + 1} of {filteredMedia.length} &bull; Use Left / Right arrow keys to navigate &bull; Esc to exit
            </p>
          </div>
        </div>
      )}

      {/* ── ARTICLE READING MODAL ────────────────────────────────────────────── */}
      {activeArticle && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setActiveArticle(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl bg-[#0a0f1c] border border-slate-800 shadow-2xl p-6 sm:p-10 my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setActiveArticle(null)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Category badge & Read Time */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg border ${activeArticle.categoryColor}`}
              >
                {activeArticle.category}
              </span>
              <span className="text-xs text-slate-400">{activeArticle.date}</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">{activeArticle.readTime}</span>
            </div>

            {/* Article Heading */}
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-4 leading-tight">
              {activeArticle.title}
            </h2>

            {/* Author Byline */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 mb-8">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                {activeArticle.author.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">{activeArticle.author}</p>
                <p className="text-[11px] text-slate-400">{activeArticle.authorRole}</p>
              </div>
            </div>

            {/* Article Content Paragraphs */}
            <div className="space-y-4 text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
              {activeArticle.content.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            {/* Tags & Share */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {activeArticle.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400"
                  >
                    #{t}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopiedUrl("article");
                  setTimeout(() => setCopiedUrl(null), 2000);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 text-xs font-medium transition-colors"
              >
                {copiedUrl === "article" ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                {copiedUrl === "article" ? "Link Copied" : "Share Article"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

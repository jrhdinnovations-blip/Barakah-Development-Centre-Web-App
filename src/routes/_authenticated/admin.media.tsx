import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, Image as ImageIcon, Video, Trash2, Copy, Check,
  FolderOpen, Grid3x3, List, Search, X, Loader2, Eye,
  AlertCircle, Film, FileImage, Plus, RefreshCw,
} from 'lucide-react';

// ─── Route guard ──────────────────────────────────────────────────────────────
export const Route = createFileRoute('/_authenticated/admin/media')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const userRoles = (roleData || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      const isAuthorized =
        userRoles.some((r: string) => ['administrator', 'admin', 'swift_manager'].includes(r)) ||
        ['administrator', 'admin', 'swift_manager'].includes(metaRole);
      if (!isAuthorized) throw redirect({ to: '/' });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: AdminMediaLibrary,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type Folder = 'general' | 'news' | 'events' | 'gallery';
type ViewMode = 'grid' | 'list';

interface MediaFile {
  name: string;
  id: string;
  created_at: string;
  updated_at: string;
  metadata: { size: number; mimetype: string } | null;
  publicUrl: string;
  folder: Folder;
}

const BUCKET = 'site-media';

const FOLDERS: { key: Folder; label: string; color: string; bg: string }[] = [
  { key: 'general',  label: 'General',  color: 'text-slate-300',   bg: 'bg-slate-700/40'   },
  { key: 'news',     label: 'News',     color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  { key: 'events',   label: 'Events',   color: 'text-purple-400',  bg: 'bg-purple-500/10'  },
  { key: 'gallery',  label: 'Gallery',  color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
];

const ACCEPTED = 'image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo';
const MAX_SIZE_MB = 100;

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVideo(mime: string) {
  return mime?.startsWith('video/');
}

// ─── Component ────────────────────────────────────────────────────────────────
function AdminMediaLibrary() {
  const [activeFolder, setActiveFolder] = useState<Folder>('general');
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch files ─────────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: listErr } = await supabase.storage
        .from(BUCKET)
        .list(activeFolder, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

      if (listErr) {
        // Bucket may not exist yet — create it on first use
        if (listErr.message?.includes('does not exist') || listErr.message?.includes('Bucket not found')) {
          setFiles([]);
          setError('Storage bucket not configured. See setup note below.');
          return;
        }
        throw listErr;
      }

      const mapped: MediaFile[] = (data || [])
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map(f => ({
          name: f.name,
          id: f.id || f.name,
          created_at: f.created_at || '',
          updated_at: f.updated_at || '',
          metadata: f.metadata as any,
          publicUrl: supabase.storage.from(BUCKET).getPublicUrl(`${activeFolder}/${f.name}`).data.publicUrl,
          folder: activeFolder,
        }));

      setFiles(mapped);
    } catch (e: any) {
      setError(e?.message || 'Failed to load media files.');
    } finally {
      setLoading(false);
    }
  }, [activeFolder]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ── Upload ───────────────────────────────────────────────────────────────────
  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const toUpload = Array.from(fileList);

    // Validate
    const oversize = toUpload.find(f => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversize) {
      setError(`"${oversize.name}" exceeds the ${MAX_SIZE_MB} MB limit.`);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(toUpload.map(f => ({ name: f.name, pct: 0 })));

    const results = await Promise.allSettled(
      toUpload.map(async (file, idx) => {
        const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `${activeFolder}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (upErr) throw new Error(`${file.name}: ${upErr.message}`);
        setUploadProgress(prev =>
          prev.map((p, i) => (i === idx ? { ...p, pct: 100 } : p))
        );
      })
    );

    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) {
      setError(failed.map(f => f.reason?.message || 'Unknown error').join(' | '));
    }

    setUploading(false);
    setUploadProgress([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await fetchFiles();
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(file: MediaFile) {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeletingId(file.id);
    const { error: delErr } = await supabase.storage
      .from(BUCKET)
      .remove([`${file.folder}/${file.name}`]);
    if (delErr) setError(delErr.message);
    else setFiles(prev => prev.filter(f => f.id !== file.id));
    setDeletingId(null);
  }

  // ── Copy URL ─────────────────────────────────────────────────────────────────
  function copyUrl(file: MediaFile) {
    navigator.clipboard.writeText(file.publicUrl);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }

  // ── Filtered files ────────────────────────────────────────────────────────────
  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-violet-600/10 rounded-2xl border border-violet-500/20">
                <ImageIcon className="h-7 w-7 text-violet-400" />
              </div>
              Media Library
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Upload images &amp; videos to the Barakah site. Files are served via Supabase Storage CDN.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchFiles}
              className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
              className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            >
              {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl text-sm font-bold text-white transition-colors"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
          </div>
        </div>

        {/* ── Error banner ───────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── Upload progress ────────────────────────────────────── */}
        {uploadProgress.length > 0 && (
          <div className="space-y-2">
            {uploadProgress.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400 shrink-0" />
                <span className="text-sm text-slate-300 truncate flex-1">{p.name}</span>
                <span className="text-xs text-violet-400 font-bold">{p.pct}%</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Folder tabs ────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {FOLDERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFolder(f.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                activeFolder === f.key
                  ? `${f.bg} ${f.color} border-current/30`
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Drop zone ──────────────────────────────────────────── */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
            dragOver
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-800/30'
          }`}
        >
          <div className="p-3 rounded-2xl bg-violet-600/10 border border-violet-500/20">
            <Upload className="h-6 w-6 text-violet-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-300">
              {dragOver ? 'Drop files here…' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Images (JPG, PNG, WebP, GIF, SVG) · Videos (MP4, WebM, MOV) · Up to {MAX_SIZE_MB} MB each
            </p>
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </div>
          )}
        </div>

        {/* ── Search ─────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search files…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── File count ────────────────────────────────────────── */}
        <div className="text-xs text-slate-500 font-medium">
          {loading ? 'Loading…' : `${filtered.length} file${filtered.length !== 1 ? 's' : ''} in /${activeFolder}`}
        </div>

        {/* ── Grid view ──────────────────────────────────────────── */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-4">
              <FolderOpen className="h-8 w-8 text-slate-600" />
            </div>
            <p className="text-slate-400 font-semibold">No files yet</p>
            <p className="text-slate-600 text-sm mt-1">Upload some images or videos to get started.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(file => (
              <MediaCard
                key={file.id}
                file={file}
                onPreview={() => setPreview(file)}
                onDelete={() => handleDelete(file)}
                onCopy={() => copyUrl(file)}
                isCopied={copiedId === file.id}
                isDeleting={deletingId === file.id}
              />
            ))}
          </div>
        )}

        {/* ── List view ──────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && viewMode === 'list' && (
          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">File</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Size</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((file, idx) => (
                  <tr
                    key={file.id}
                    className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {isVideo(file.metadata?.mimetype || '') ? (
                            <Film className="h-5 w-5 text-blue-400" />
                          ) : (
                            <img
                              src={file.publicUrl}
                              alt={file.name}
                              className="h-full w-full object-cover"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                        </div>
                        <span className="text-slate-200 font-medium truncate max-w-[160px]">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                      {file.metadata?.mimetype || 'unknown'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                      {file.metadata?.size ? humanSize(file.metadata.size) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setPreview(file)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => copyUrl(file)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors">
                          {copiedId === file.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          disabled={deletingId === file.id}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deletingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Loading skeleton ───────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-900 border border-slate-800 aspect-square animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Setup note ──────────────────────────────────────────── */}
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-300/70">
          <strong className="text-blue-300">Supabase Storage setup:</strong> Make sure a public bucket named{' '}
          <code className="bg-blue-900/40 px-1.5 py-0.5 rounded font-mono">{BUCKET}</code> exists in your Supabase project
          with <strong>public access</strong> enabled. Go to <strong>Supabase Dashboard → Storage → New bucket</strong>,
          name it <code className="bg-blue-900/40 px-1.5 py-0.5 rounded font-mono">{BUCKET}</code>, toggle{' '}
          <em>Public bucket</em> ON, then save.
        </div>

      </div>

      {/* ── Preview modal ─────────────────────────────────────────── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative bg-[#0d1221] border border-slate-700 rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                {isVideo(preview.metadata?.mimetype || '') ? (
                  <Video className="h-5 w-5 text-blue-400 shrink-0" />
                ) : (
                  <FileImage className="h-5 w-5 text-violet-400 shrink-0" />
                )}
                <span className="text-sm font-semibold text-slate-200 truncate">{preview.name}</span>
                {preview.metadata?.size && (
                  <span className="text-xs text-slate-500 shrink-0">{humanSize(preview.metadata.size)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyUrl(preview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 text-xs font-medium transition-colors"
                >
                  {copiedId === preview.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === preview.id ? 'Copied!' : 'Copy URL'}
                </button>
                <a
                  href={preview.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 text-xs font-medium transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" /> Open
                </a>
                <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center bg-[#070b14] min-h-64 max-h-[70vh] overflow-auto">
              {isVideo(preview.metadata?.mimetype || '') ? (
                <video
                  src={preview.publicUrl}
                  controls
                  autoPlay
                  className="max-h-[65vh] rounded-lg w-full"
                />
              ) : (
                <img
                  src={preview.publicUrl}
                  alt={preview.name}
                  className="max-h-[65vh] rounded-lg object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Media card ───────────────────────────────────────────────────────────────
function MediaCard({
  file, onPreview, onDelete, onCopy, isCopied, isDeleting,
}: {
  file: MediaFile;
  onPreview: () => void;
  onDelete: () => void;
  onCopy: () => void;
  isCopied: boolean;
  isDeleting: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const video = isVideo(file.metadata?.mimetype || '');

  return (
    <div className="group relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-slate-600 transition-all">
      {/* Thumbnail */}
      <div
        className="aspect-square bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={onPreview}
      >
        {video ? (
          <div className="flex flex-col items-center gap-2 text-blue-400">
            <Film className="h-8 w-8" />
            <span className="text-[10px] font-bold uppercase text-blue-400/60">Video</span>
          </div>
        ) : imgError ? (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <ImageIcon className="h-8 w-8" />
          </div>
        ) : (
          <img
            src={file.publicUrl}
            alt={file.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Name */}
      <div className="px-3 py-2">
        <p className="text-xs text-slate-300 font-medium truncate" title={file.name}>{file.name}</p>
        {file.metadata?.size && (
          <p className="text-[10px] text-slate-600 mt-0.5">{humanSize(file.metadata.size)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 px-3 pb-3">
        <button
          onClick={onCopy}
          title="Copy public URL"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Locate, Navigation, X, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  LocationSuggestion,
  fetchRealtimeLocationSuggestions,
  getBrowserGpsLocation,
  geocodePlaceId,
  searchLocalLocations,
  resolveJosLocation,
  JOS_LOCATIONS,
} from '@/lib/location-suggestions';
import { resolveAddressToCoordinates } from '@/lib/google-maps-client';

interface LocationSearchInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSelectLocation: (loc: { address: string; lat: number; lng: number }, isExplicit?: boolean) => void;
  iconVariant?: 'pickup' | 'dropoff';
  showGpsButton?: boolean;
  mapsLoaded?: boolean;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null> | React.RefObject<HTMLInputElement>;
}

export function LocationSearchInput({
  label,
  placeholder,
  value,
  onChange,
  onSelectLocation,
  iconVariant = 'pickup',
  showGpsButton = false,
  mapsLoaded = false,
  className = '',
  inputRef,
}: LocationSearchInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debounce as user types
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await fetchRealtimeLocationSuggestions(value, mapsLoaded);
        if (active) {
          setSuggestions(results);
        }
      } finally {
        if (active) setIsLoadingSuggestions(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, isOpen, mapsLoaded]);

  const hasExplicitSelection = useRef(false);
  const lastResolvedQuery = useRef('');

  // Auto-resolve typed input if user blurs or presses Enter (never interrupts typing)
  const autoResolveText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) return;
    if (hasExplicitSelection.current && lastResolvedQuery.current === trimmed.toLowerCase()) return;

    // 1. Check verified Jos landmark database first
    const match = resolveJosLocation(trimmed);
    if (match && match.lat && match.lng) {
      lastResolvedQuery.current = trimmed.toLowerCase();
      onSelectLocation({
        address: `${match.label}, ${match.sublabel}`,
        lat: match.lat,
        lng: match.lng,
      }, false);
      return;
    }

    // 2. Server geocoding lookup
    setIsResolving(true);
    try {
      const geo = await resolveAddressToCoordinates(trimmed);
      lastResolvedQuery.current = trimmed.toLowerCase();
      if (geo && geo.lat && geo.lng) {
        onSelectLocation({
          address: geo.address,
          lat: geo.lat,
          lng: geo.lng,
        }, false);
      }
    } catch {
      // Keep state clean without inserting dummy coordinates
    } finally {
      setIsResolving(false);
    }
  };

  // Handle GPS location click
  const handleLiveLocationClick = async () => {
    setIsLocating(true);
    toast.loading('Detecting your GPS location...', { id: 'gps-locating' });

    try {
      const gps = await getBrowserGpsLocation();
      toast.success('Live location detected!', { id: 'gps-locating' });
      onChange(gps.address);
      onSelectLocation({
        address: gps.address,
        lat: gps.lat,
        lng: gps.lng,
      }, true);
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Could not retrieve live GPS location', { id: 'gps-locating' });
    } finally {
      setIsLocating(false);
    }
  };

  const handleSelect = async (item: LocationSuggestion) => {
    let lat = item.lat;
    let lng = item.lng;
    let fullAddress = `${item.label}, ${item.sublabel}`;

    hasExplicitSelection.current = true;
    lastResolvedQuery.current = item.label.toLowerCase();
    onChange(item.label);
    setIsOpen(false);

    // Only resolve via geocodePlaceId IF placeId exists AND coordinates are missing
    if (item.placeId && (!item.hasResolvedCoords || !lat || lat === 0)) {
      setIsResolving(true);
      try {
        const resolved = await geocodePlaceId(item.placeId, item.lat, item.lng);
        if (resolved && (resolved.lat !== 0 || resolved.lng !== 0)) {
          lat = resolved.lat;
          lng = resolved.lng;
          if (resolved.address) fullAddress = resolved.address;
        }
      } catch {
        // Fallback to existing
      } finally {
        setIsResolving(false);
      }
    }

    onSelectLocation({
      address: fullAddress,
      lat,
      lng,
    }, true);
  };

  const handleClear = () => {
    onChange('');
    setSuggestions(JOS_LOCATIONS.slice(0, 6));
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-2">
        {label}
      </label>

      <div className="relative flex items-center">
        {/* Leading Pin Icon */}
        <div className="absolute left-4 z-10 flex items-center justify-center pointer-events-none">
          {iconVariant === 'pickup' ? (
            <div className="h-5 w-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>
          ) : (
            <div className="h-5 w-5 bg-orange-500/20 rounded-full flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            </div>
          )}
        </div>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            hasExplicitSelection.current = false;
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (value.trim() && !hasExplicitSelection.current) {
                autoResolveText(value);
              }
            }, 250);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions.length > 0 && suggestions[0]) {
                handleSelect(suggestions[0]);
              } else if (value.trim()) {
                const local = searchLocalLocations(value.trim());
                if (local.length > 0 && local[0]) {
                  handleSelect(local[0]);
                } else {
                  setIsResolving(true);
                  resolveAddressToCoordinates(value.trim())
                    .then((geo) => {
                      setIsResolving(false);
                      if (geo) {
                        onSelectLocation({
                          address: geo.address,
                          lat: geo.lat,
                          lng: geo.lng,
                        }, true);
                      } else {
                        onSelectLocation({
                          address: value.trim(),
                          lat: 9.8965,
                          lng: 8.8583,
                        }, true);
                      }
                      setIsOpen(false);
                    })
                    .catch(() => {
                      setIsResolving(false);
                      onSelectLocation({
                        address: value.trim(),
                        lat: 9.8965,
                        lng: 8.8583,
                      }, true);
                      setIsOpen(false);
                    });
                }
              }
            }
          }}
          placeholder={placeholder}
          className="w-full h-14 pl-12 pr-20 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-inner"
        />

        {/* Trailing Action Buttons */}
        <div className="absolute right-2.5 z-10 flex items-center gap-1.5">
          {/* Resolving Spinner */}
          {isResolving && (
            <div className="h-8 w-8 flex items-center justify-center text-orange-400" title="Resolving coordinates...">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {/* Clear button */}
          {value && !isResolving && (
            <button
              type="button"
              onClick={handleClear}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Live GPS Button */}
          {showGpsButton && (
            <button
              type="button"
              onClick={handleLiveLocationClick}
              disabled={isLocating}
              className={`h-9 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm ${
                isLocating
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 cursor-wait'
                  : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-200 border border-blue-500/30 hover:border-blue-400/50'
              }`}
              title="Use current GPS live location"
            >
              {isLocating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span className="hidden sm:inline">Locating...</span>
                </>
              ) : (
                <>
                  <Locate className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[11px] font-medium hidden sm:inline">GPS</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Real-time Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-slate-900/95 border border-slate-800 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Quick Header */}
          <div className="px-4 py-2 border-b border-slate-800/60 flex items-center justify-between bg-slate-950/40">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-orange-400" />
              {value ? 'Suggested Locations' : 'Popular Spots in Jos'}
            </span>
            {isLoadingSuggestions && (
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
            )}
          </div>

          {/* List of Suggestions */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar">
            {suggestions.length > 0 ? (
              suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-white/[0.06] active:bg-orange-500/10 transition-colors group"
                >
                  <span className="text-base shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    {item.iconEmoji || '📍'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white group-hover:text-orange-300 transition-colors truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.sublabel}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-slate-400">No matching landmark found.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Press enter or click outside to use your custom entered address.
                </p>
              </div>
            )}
          </div>

          {/* Quick Shortcuts Bar */}
          <div className="p-2 bg-slate-950/60 border-t border-slate-800/60 flex flex-wrap gap-1.5">
            {['Terminus', 'Rayfield', 'UNIJOS', 'Airport', 'Bukuru'].map((shortcut) => (
              <button
                key={shortcut}
                type="button"
                onClick={() => {
                  const match = JOS_LOCATIONS.find((l) =>
                    l.label.toLowerCase().includes(shortcut.toLowerCase())
                  );
                  if (match) handleSelect(match);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[10px] font-medium text-slate-300 hover:text-white transition-all"
              >
                {shortcut}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

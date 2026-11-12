'use client';

import { useEffect, useId, useState } from 'react';
import { api, ApiError, type Place, type Zone, type ZoneMatch } from '@/lib/api';

export interface SelectedPlace {
  label: string;
  lat: number;
  lng: number;
}

interface PlaceSearchProps {
  label: string;
  placeholder?: string;
  /** Used when the search service is unreachable — the 11 zones still work. */
  zones: Zone[];
  allowGps?: boolean;
  onPlace: (place: SelectedPlace | null) => void;
  onZone: (match: ZoneMatch) => void;
}

const DEBOUNCE_MS = 280;

const KIND_LABEL: Record<Place['kind'], string> = {
  airport: 'Airport',
  place: 'Area',
  street: 'Street',
  poi: 'Landmark',
  other: 'Place',
};

/**
 * Search-as-you-type over OSM, plus one-tap "use my location".
 *
 * The text is only a label — the coordinates are what get sent, and the zone
 * they price from is resolved by PostGIS on the server, so a pin dropped on a
 * map and a name typed by hand can never disagree about the fare.
 */
export function PlaceSearch({
  label,
  placeholder,
  zones,
  allowGps = false,
  onPlace,
  onZone,
}: PlaceSearchProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  /** Non-null when the search service is down and we are offering zones instead. */
  const [fallbackZones, setFallbackZones] = useState<Zone[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setFallbackZones(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .searchPlaces({ q: trimmed, limit: 6 })
        .then((result) => {
          if (cancelled) return;
          setSuggestions(result.places);
          setFallbackZones(null);
          setActive(0);
          setOpen(true);
        })
        .catch((cause) => {
          if (cancelled) return;
          // Search being down must not lock the customer out of booking:
          // fall back to the zone list we already have in memory.
          const needle = trimmed.toLowerCase();
          const matches = zones.filter((zone) => zone.name.toLowerCase().includes(needle));
          setSuggestions(
            matches.map((zone) => ({
              label: zone.name,
              lat: zone.lat ?? 0,
              lng: zone.lng ?? 0,
              kind: zone.airport ? ('airport' as const) : ('place' as const),
            })),
          );
          setFallbackZones(matches);
          setActive(0);
          setOpen(true);
          setError(cause instanceof ApiError ? cause.message : null);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, zones]);

  async function choose(place: Place) {
    setQuery(place.label);
    setOpen(false);
    setError(null);
    onPlace({ label: place.label, lat: place.lat, lng: place.lng });

    // Coordinates in, zone out — the server decides what this prices as.
    try {
      onZone(await api.resolveZone({ lat: place.lat, lng: place.lng }));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not place that on the map');
    }
  }

  function chooseZoneFallback(zone: Zone) {
    setQuery(zone.name);
    setOpen(false);
    setError(null);
    onPlace({
      label: zone.name,
      lat: zone.lat ?? 0,
      lng: zone.lng ?? 0,
    });
    onZone({
      zone: { slug: zone.slug, name: zone.name, airport: zone.airport },
      distanceMetres: 0,
      withinServiceArea: true,
    });
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share a location');
      return;
    }

    setGpsBusy(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const result = await api.locate({ lat, lng });
          const text = result.place?.label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setQuery(text);
          onPlace({ label: text, lat, lng });
          onZone(result);
          if (!result.withinServiceArea) {
            setError('That location is outside our service area');
          }
        } catch (cause) {
          setError(cause instanceof ApiError ? cause.message : 'Could not read your location');
        } finally {
          setGpsBusy(false);
        }
      },
      (fault) => {
        setGpsBusy(false);
        setError(
          fault.code === fault.PERMISSION_DENIED
            ? 'Location permission was denied — search instead'
            : 'Could not read your location — search instead',
        );
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60_000 },
    );
  }

  function chooseActive(index: number) {
    if (fallbackZones) {
      const zone = fallbackZones[index];
      if (zone) chooseZoneFallback(zone);
      return;
    }
    const place = suggestions[index];
    if (place) void choose(place);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseActive(active);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="field grid grid-cols-[minmax(0,1fr)_auto] items-end gap-1">
        <label htmlFor={id} className="min-w-0">
          <span className="field-label">{label}</span>
          <input
            id={id}
            className="field-control"
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onPlace(null);
              setOpen(false);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setOpen(true);
            }}
            onBlur={() => {
              // Let a mousedown on a suggestion land before the list unmounts.
              setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
          />
        </label>

        {allowGps ? (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={gpsBusy}
            aria-label="Use my current location"
            title="Use my current location"
            className="mb-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-forest transition-colors hover:bg-raised disabled:opacity-50"
          >
            {gpsBusy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-forest" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </svg>
            )}
          </button>
        ) : (
          <span aria-hidden className="mb-1.5 h-9 w-9" />
        )}
      </div>

      {error ? <p className="mt-1.5 text-caption text-danger">{error}</p> : null}

      {open && suggestions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-line bg-raised py-1 shadow-elevated"
        >
          {suggestions.map((place, index) => (
            <li key={`${place.lat},${place.lng},${place.label}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                // onMouseDown beats blur, so the click still registers.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseActive(index)}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === active ? 'bg-sunken' : 'bg-raised'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  {place.kind === 'airport' ? (
                    <path d="M2 13.5 21 4l-4.5 9.5L13 15l-2.5 4.5L8 16l-6-2.5Z" strokeLinejoin="round" />
                  ) : (
                    <>
                      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" strokeLinejoin="round" />
                      <circle cx="12" cy="10" r="2.5" />
                    </>
                  )}
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-ink">{place.label}</span>
                  <span className="block text-caption text-muted">
                    {fallbackZones ? 'Area in our service zone' : KIND_LABEL[place.kind]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

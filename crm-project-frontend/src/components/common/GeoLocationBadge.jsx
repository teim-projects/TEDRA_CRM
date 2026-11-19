import React, { useState, useEffect } from "react";
import { MdOpenInNew, MdLocationOn } from "react-icons/md";
import { reverseGeocodeLocation } from "../../utils/geoUtils";

export default function GeoLocationBadge({
  latitude,
  longitude,
  accuracy = null,
  showMapsLink = false,
  mapsLinkText = "View on Maps",
  compact = false,
  className = "",
}) {
  const [locationName, setLocationName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!latitude || !longitude) {
      setLocationName("");
      return;
    }

    setLoading(true);
    reverseGeocodeLocation(latitude, longitude)
      .then((name) => {
        if (isMounted) {
          setLocationName(name || "Recorded GPS Location");
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLocationName("Recorded GPS Location");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  if (!latitude || !longitude) {
    return <span className="text-slate-400 italic text-[11px]">No GPS recorded</span>;
  }

  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  const mapsUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;

  if (compact) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        <div className="flex items-start gap-1 text-[11px] font-semibold text-slate-800 leading-tight">
          <MdLocationOn className="text-rose-500 shrink-0 mt-0.5" size={13} />
          <span className="line-clamp-2">{loading ? "Detecting location..." : locationName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 font-mono pl-3.5">
          <span>{latNum.toFixed(5)}°, {lngNum.toFixed(5)}°</span>
          {accuracy && <span className="text-slate-400 font-sans">(±{Math.round(accuracy)}m)</span>}
          {showMapsLink && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:text-sky-800 font-bold underline inline-flex items-center gap-0.5 ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span>Maps</span>
              <MdOpenInNew size={9} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Exact Location Name */}
      <div className="flex items-start gap-1.5 text-xs font-bold text-slate-800 leading-snug">
        <MdLocationOn className="text-rose-500 shrink-0 mt-0.5" size={15} />
        <span className="break-words">
          {loading ? (
            <span className="text-slate-400 font-normal animate-pulse">Detecting address...</span>
          ) : (
            locationName
          )}
        </span>
      </div>

      {/* Longitude and Latitude Below */}
      <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-mono pl-4">
        <span>Lat: {latNum.toFixed(5)}°</span>
        <span>•</span>
        <span>Lng: {lngNum.toFixed(5)}°</span>
        {accuracy && (
          <span className="text-slate-400 font-sans text-[10px]">
            (±{Math.round(accuracy)}m)
          </span>
        )}
      </div>

      {/* Optional Maps Link */}
      {showMapsLink && (
        <div className="pl-4 pt-0.5">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-sky-600 hover:text-sky-800 font-bold underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{mapsLinkText}</span>
            <MdOpenInNew size={11} />
          </a>
        </div>
      )}
    </div>
  );
}

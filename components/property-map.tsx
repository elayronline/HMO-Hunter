"use client";

import { useState, useEffect } from "react";
import maplibregl from "maplibre-gl";

type Property = { lat: number; lng: number; address?: string; price?: number };

interface PropertyMapProps {
  properties: Property[];
}

export default function PropertyMap({ properties }: PropertyMapProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [showArticle4, setShowArticle4] = useState(true);
  const [mapContainerRef, setMapContainerRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (map || !mapContainerRef) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainerRef,
      style: "https://demotiles.maplibre.org/style.json",
      center: [-0.1276, 51.5074],
      zoom: 11,
    });

    mapInstance.addControl(new maplibregl.NavigationControl());

    // Add property markers
    properties.forEach((prop) => {
      new maplibregl.Marker({ color: "#0d9488" })
        .setLngLat([prop.lng, prop.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <strong>${prop.address || "Unknown"}</strong><br/>
            Price: £${prop.price?.toLocaleString() || "N/A"}
          `)
        )
        .addTo(mapInstance);
    });

    // Load Article 4 GeoJSON
    mapInstance.on("load", () => {
      fetch("/data/article4-areas.geojson")
        .then((res) => res.json())
        .then((geojson) => {
          mapInstance.addSource("article4", { type: "geojson", data: geojson });

          mapInstance.addLayer({
            id: "article4-fill",
            type: "fill",
            source: "article4",
            paint: { "fill-color": "#ef4444", "fill-opacity": 0.15 },
          });

          mapInstance.addLayer({
            id: "article4-outline",
            type: "line",
            source: "article4",
            paint: { "line-color": "#dc2626", "line-width": 2, "line-dasharray": [2, 2] },
          });

          // Add click handler for Article 4 info
          mapInstance.on("click", "article4-fill", (e) => {
            if (!e.features || !e.features[0]) return;
            const { name, authority, restrictions } = e.features[0].properties;
            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(
                `<strong>${name}</strong><br/>` +
                `Authority: ${authority}<br/>` +
                `${restrictions}`
              )
              .addTo(mapInstance);
          });

          mapInstance.on("mouseenter", "article4-fill", () => {
            mapInstance.getCanvas().style.cursor = "pointer";
          });

          mapInstance.on("mouseleave", "article4-fill", () => {
            mapInstance.getCanvas().style.cursor = "";
          });
        })
        .catch((err) => {
          console.error("Failed to load Article 4 data:", err);
        });
    });

    setMap(mapInstance);
    
    return () => mapInstance.remove();
  }, [map, properties]);

  // Toggle Article 4 visibility
  useEffect(() => {
    if (!map) return;
    ["article4-fill", "article4-outline"].forEach((layer) => {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, "visibility", showArticle4 ? "visible" : "none");
      }
    });
  }, [showArticle4, map]);

  return (
    <div className="relative w-full h-[350px] md:h-[500px] lg:h-[600px] rounded-xl overflow-hidden">
      <div 
        ref={setMapContainerRef}
        className="w-full h-full" 
      />
      <div className="absolute top-4 right-4 bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-200 z-10">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showArticle4}
            onChange={() => setShowArticle4(!showArticle4)}
            className="w-4 h-4 text-teal-600 rounded focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-sm font-medium text-slate-700">Show Article 4 Areas</span>
        </label>
      </div>
    </div>
  );
}

"use client"

import { useState } from "react"
import { Play } from "lucide-react"

const VIDEO_ID = "Yrm8N1NLQ54"

export function VideoPlayer() {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
          title="HMO Hunter Demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="group relative w-full overflow-hidden rounded-2xl"
      style={{ paddingBottom: "56.25%" }}
      aria-label="Play demo video"
    >
      <img
        src={`https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`}
        alt="Watch how HMO Hunter works"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg group-hover:scale-110 transition-transform">
          <Play className="h-7 w-7 text-[var(--teal-dark)] ml-1" fill="currentColor" />
        </div>
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-sm font-medium text-white drop-shadow-lg">
        Watch how it works
      </p>
    </button>
  )
}

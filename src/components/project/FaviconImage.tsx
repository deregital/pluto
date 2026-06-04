"use client";
import Image from "next/image";
import { useState } from "react";

export default function FaviconImage({ faviconUrl }: { faviconUrl: string }) {
  const [imgSrc, setImgSrc] = useState(faviconUrl || "/placeholder.svg");

  const handleImageError = () => {
    setImgSrc("/placeholder.svg");
  };

  return (
    <Image
      src={imgSrc}
      alt="Favicon"
      width={64}
      height={64}
      className="rounded-md object-cover w-32"
      onError={handleImageError}
    />
  );
}

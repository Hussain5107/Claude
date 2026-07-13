import React from "react";
import { Audio } from "remotion";

interface AudioTrackProps {
  src: string;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({ src }) => <Audio src={src} />;

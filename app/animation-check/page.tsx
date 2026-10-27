import type { Metadata } from "next";
import AnimationPreview from "./preview";
export const metadata: Metadata = { title: "Перевірка прозорості анімацій", robots: { index: false, follow: false } };
export default function AnimationCheck() { return <AnimationPreview />; }

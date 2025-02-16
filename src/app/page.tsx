import Canvas from "@/components/canvas/canvas";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="h-screen w-screen">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Canvas />
    </div>
  );
}

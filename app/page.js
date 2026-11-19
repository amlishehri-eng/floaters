import { Button } from "@/components/ui/button";

// Placeholder home screen. Replace with the first screen of the happy path in SPEC.md.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Floaters</h1>
      <p className="max-w-md text-muted-foreground">
        Hackathon prototype. Fill in SPEC.md, then build the happy path.
      </p>
      <Button size="lg">Get started</Button>
    </main>
  );
}

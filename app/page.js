import { Button } from "@/components/ui/button";

const rainbow = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-400",
  "bg-green-500",
  "bg-sky-500",
  "bg-blue-600",
  "bg-violet-600",
];

export default function Home() {
  return (
    <main className="relative isolate flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-rose-100 via-amber-50 to-violet-100 px-6 py-16">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(to_right,#ef4444_0%,#f97316_16%,#facc15_32%,#22c55e_48%,#0ea5e9_64%,#2563eb_80%,#7c3aed_100%)]"
      />
      <div aria-hidden="true" className="absolute -left-24 top-1/4 -z-10 size-80 rounded-full bg-pink-300/40 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-24 bottom-1/4 -z-10 size-80 rounded-full bg-violet-300/50 blur-3xl" />

      <section className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/75 p-8 text-center shadow-xl shadow-violet-200/50 backdrop-blur sm:p-12">
        <div className="mx-auto mb-8 flex w-fit gap-1.5" aria-label="Rainbow colors">
          {rainbow.map((color) => (
            <span key={color} className={`h-2 w-7 rounded-full ${color}`} />
          ))}
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-violet-700">
          Make room for wonder
        </p>
        <h1 className="bg-[linear-gradient(to_right,#e11d48,#ea580c,#ca8a04,#16a34a,#0284c7,#4f46e5,#9333ea)] bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
          Floaters
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-600 sm:text-lg">
          A brighter little space for ideas to take shape. Pick a color, follow a thought, and see where it floats.
        </p>
        <Button
          size="lg"
          className="mt-8 rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-violet-600 px-8 text-white shadow-lg shadow-rose-200 transition hover:scale-[1.02] hover:opacity-95"
        >
          Get started
        </Button>
      </section>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sleepox — Wellness & Sleep Resources" },
      { name: "description", content: "Discover articles on better sleep, mindfulness, and daily wellness habits." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold">Sleepox</div>
          <nav className="flex gap-4 text-sm">
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <Link to="/login" className="hover:underline">Login</Link>
            <Link to="/signup" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90">Sign up</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold leading-tight">Better sleep, better days.</h1>
        <p className="mt-4 text-muted-foreground">
          Sleepox is your daily companion for healthier sleep habits, mindfulness practices, and
          wellness reading. Explore evidence-based articles and gentle routines designed to help
          you rest deeper and wake up refreshed.
        </p>
        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <article className="rounded-lg border border-border p-6">
            <h2 className="font-semibold">Sleep guides</h2>
            <p className="mt-2 text-sm text-muted-foreground">Practical bedtime routines and tips backed by research.</p>
          </article>
          <article className="rounded-lg border border-border p-6">
            <h2 className="font-semibold">Mindfulness</h2>
            <p className="mt-2 text-sm text-muted-foreground">Short breathing and meditation practices for everyday calm.</p>
          </article>
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Sleepox
      </footer>
    </div>
  );
}

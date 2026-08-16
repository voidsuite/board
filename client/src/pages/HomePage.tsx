import { VoidBoardLogo } from "@/components/VoidBoardLogo"

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <VoidBoardLogo size="lg" tagline />
      <p className="text-sm text-muted-foreground">Scaffolding VoidBoard…</p>
    </div>
  )
}
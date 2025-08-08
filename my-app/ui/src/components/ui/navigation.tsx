import * as React from "react"
import { cn } from "@/lib/utils"

interface NavigationProps extends React.HTMLAttributes<HTMLElement> {
  items?: {
    href: string
    text: string
  }[]
}

export default function Navigation({
  className,
  items = [],
  ...props
}: NavigationProps) {
  return (
    <nav
      className={cn(
        "hidden md:flex items-center gap-6 text-sm font-medium",
        className
      )}
      {...props}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="text-foreground/60 transition-colors hover:text-foreground/80"
        >
          {item.text}
        </a>
      ))}
    </nav>
  )
} 
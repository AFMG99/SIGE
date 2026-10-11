interface PanelHeadingProps {
  number: string
  label: string
  heading: string
  description: string
}

/** Editorial kicker + heading shared by the four settings panels. */
export function PanelHeading({ number, label, heading, description }: PanelHeadingProps) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-wider text-uv-forest dark:text-emerald-400">
        {number} · {label}
      </p>
      <h2 className="ui-title mt-1 text-lg">{heading}</h2>
      <p className="ui-muted mt-1 text-sm">{description}</p>
    </header>
  )
}

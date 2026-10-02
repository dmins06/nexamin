export function LabIntro({
  title,
  description,
  notice,
}: {
  title: string
  description: string
  notice: string
}) {
  return (
    <header className="it-heading it-sim-heading">
      <h1>{title}</h1>
      <p>{description}</p>
      <p className="it-small">{notice}</p>
    </header>
  )
}

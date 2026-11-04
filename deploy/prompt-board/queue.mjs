/** Completed deliveries leave the work queue. Their records and files remain private and intact. */
export function completed(prompt, record) {
  if (!record || record.revision) return false;
  const files = record.files.filter((f) => !record.revisedAt || f.uploadedAt > record.revisedAt);
  return prompt.kind === "animation"
    ? files.some((f) => f.type === "application/zip") || files.length >= 8
    : files.length > 0;
}
export function remaining(catalog, records) {
  return catalog.filter((p) => !completed(p, records[p.id]));
}

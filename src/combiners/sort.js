// Natural sort so "part2.txt" comes before "part10.txt".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function naturalCompare(a, b) {
  return collator.compare(a, b);
}

export function sortByName(items, direction = 'asc') {
  const sign = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => sign * naturalCompare(a.name, b.name));
}

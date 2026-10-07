// Arrays allow sibling submenus to stay open independently. Older sessions stored one key.
export function normalizeExpandedParents(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([groupId, keys]) => [
    groupId, Array.isArray(keys) ? [...new Set(keys.filter((key) => typeof key === "string"))]
      : typeof keys === "string" ? [keys] : [],
  ]));
}

export function openGroupParents(previous, groupId, parentKeys, activeParent = null) {
  const keys = Object.hasOwn(previous, groupId) ? previous[groupId] : parentKeys;
  return { ...previous, [groupId]: [...new Set([...keys, ...(activeParent ? [activeParent] : [])])] };
}

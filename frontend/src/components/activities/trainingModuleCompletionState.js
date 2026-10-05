export function completedTopicKeys(course) {
  return new Set(
    (course?.topics || [])
      .filter((topic) => Number(topic.total || 0) > 0 && Number(topic.completed || 0) === Number(topic.total || 0))
      .map((topic) => topic.key)
  );
}

export function newlyCompletedTopics(course, previousCompleted = new Set()) {
  const completed = completedTopicKeys(course);
  return (course?.topics || [])
    .filter((topic) => completed.has(topic.key) && !previousCompleted.has(topic.key))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

export function topicHighlights(topic, limit = 4) {
  const seen = new Set();
  const rows = [];
  for (const activity of topic?.activities || []) {
    const label = String(activity.title || "").trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    rows.push(label);
    if (rows.length >= limit) break;
  }
  return rows;
}

export function nextTopicAfter(course, completedTopic) {
  if (!completedTopic) return null;
  return (course?.topics || [])
    .filter((topic) => Number(topic.order || 0) > Number(completedTopic.order || 0) && Number(topic.total || 0) > 0)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))[0] || null;
}

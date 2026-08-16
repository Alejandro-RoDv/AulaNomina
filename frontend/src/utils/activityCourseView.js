export function normalizeActivityCourseForView(payload) {
  const source = payload && typeof payload === "object" ? payload : {};

  const topics = (source.topics || []).map((topic, topicIndex) => {
    const topicOrder = Number(topic?.order) || topicIndex + 1;
    const activities = (topic?.activities || []).map((activity, activityIndex) => ({
      ...activity,
      display_number: `${topicOrder}.${activityIndex + 1}`,
    }));

    const completed = activities.filter((activity) => activity?.is_completed).length;
    const total = activities.length;

    return {
      ...topic,
      activities,
      completed,
      total,
      progress_percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });

  const activities = topics.flatMap((topic) => topic.activities || []);
  const completed = activities.filter((activity) => activity?.is_completed).length;
  const total = activities.length;

  return {
    ...source,
    topics,
    course: {
      ...(source.course || {}),
      completed,
      total,
      pending: total - completed,
      progress_percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
      visible_runtime_steps: total,
    },
  };
}

export function normalizeActivityCourseForView(payload) {
  const source = payload && typeof payload === "object" ? payload : {};

  const topics = (source.topics || []).map((topic, topicIndex) => {
    const topicOrder = Number(topic?.order) || topicIndex + 1;
    const activities = (topic?.activities || []).map((activity, activityIndex) => ({
      ...activity,
      display_number: activity?.display_number || `${topicOrder}.${activityIndex + 1}`,
    }));

    const runtimeCompleted = activities.filter((activity) => activity?.is_completed).length;
    const runtimeTotal = activities.length;
    const completed = Number.isFinite(Number(topic?.completed)) ? Number(topic.completed) : runtimeCompleted;
    const total = Number.isFinite(Number(topic?.total)) ? Number(topic.total) : runtimeTotal;
    const progressPercentage = Number.isFinite(Number(topic?.progress_percentage))
      ? Number(topic.progress_percentage)
      : total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      ...topic,
      activities,
      completed,
      total,
      progress_percentage: progressPercentage,
      runtime_completed_steps: runtimeCompleted,
      runtime_total_steps: runtimeTotal,
    };
  });

  const activities = topics.flatMap((topic) => topic.activities || []);
  const runtimeCompleted = activities.filter((activity) => activity?.is_completed).length;
  const runtimeTotal = activities.length;
  const sourceCourse = source.course || {};
  const completed = Number.isFinite(Number(sourceCourse.completed)) ? Number(sourceCourse.completed) : runtimeCompleted;
  const total = Number.isFinite(Number(sourceCourse.total)) ? Number(sourceCourse.total) : runtimeTotal;
  const progressPercentage = Number.isFinite(Number(sourceCourse.progress_percentage))
    ? Number(sourceCourse.progress_percentage)
    : total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    ...source,
    topics,
    course: {
      ...sourceCourse,
      completed,
      total,
      pending: Number.isFinite(Number(sourceCourse.pending)) ? Number(sourceCourse.pending) : Math.max(0, total - completed),
      progress_percentage: progressPercentage,
      visible_runtime_steps: Number(sourceCourse.visible_runtime_steps || runtimeTotal),
    },
  };
}

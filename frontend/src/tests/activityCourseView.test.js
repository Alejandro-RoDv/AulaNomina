import assert from "node:assert/strict";
import test from "node:test";

import { normalizeActivityCourseForView } from "../utils/activityCourseView.js";

function activity(id, completed = false) {
  return { id, is_completed: completed, display_number: "A01.1" };
}

test("visible counters match the rows rendered in each topic", () => {
  const normalized = normalizeActivityCourseForView({
    course: { completed: 0, total: 60, catalog_total_practices: 60 },
    topics: [
      {
        order: 1,
        title: "Fundamentos y organización laboral",
        completed: 0,
        total: 5,
        activities: [
          activity("1"),
          activity("2"),
          activity("3"),
          activity("4"),
          activity("5"),
          activity("6"),
          activity("7"),
          activity("8"),
        ],
      },
    ],
  });

  assert.equal(normalized.topics[0].total, 8);
  assert.equal(normalized.topics[0].completed, 0);
  assert.deepEqual(
    normalized.topics[0].activities.map((item) => item.display_number),
    ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8"]
  );
  assert.equal(normalized.course.total, 8);
  assert.equal(normalized.course.catalog_total_practices, 60);
});

test("progress is calculated from executable rows rather than master codes", () => {
  const normalized = normalizeActivityCourseForView({
    course: {},
    topics: [
      {
        order: 6,
        activities: [activity("a", true), activity("b"), activity("c", true)],
      },
      {
        order: 7,
        activities: [activity("d"), activity("e")],
      },
    ],
  });

  assert.equal(normalized.topics[0].completed, 2);
  assert.equal(normalized.topics[0].total, 3);
  assert.equal(normalized.topics[0].progress_percentage, 67);
  assert.deepEqual(
    normalized.topics[0].activities.map((item) => item.display_number),
    ["6.1", "6.2", "6.3"]
  );
  assert.equal(normalized.course.completed, 2);
  assert.equal(normalized.course.total, 5);
  assert.equal(normalized.course.pending, 3);
  assert.equal(normalized.course.progress_percentage, 40);
});

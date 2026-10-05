import test from "node:test";
import assert from "node:assert/strict";

import {
  completedTopicKeys,
  newlyCompletedTopics,
  nextTopicAfter,
  topicHighlights,
} from "../components/activities/trainingModuleCompletionState.js";


const course = {
  topics: [
    {
      key: "m1",
      order: 1,
      title: "Bloque 1",
      total: 2,
      completed: 2,
      activities: [
        { title: "Alta de trabajador" },
        { title: "Alta de trabajador" },
        { title: "Contrato inicial" },
      ],
    },
    {
      key: "m2",
      order: 2,
      title: "Bloque 2",
      total: 2,
      completed: 2,
      activities: [{ title: "Incidencia IT" }],
    },
    {
      key: "m3",
      order: 3,
      title: "Bloque 3",
      total: 3,
      completed: 1,
      activities: [{ title: "Nómina" }],
    },
  ],
};


test("completion detector only reports topics completed since the previous snapshot", () => {
  const completed = completedTopicKeys(course);
  assert.deepEqual([...completed], ["m1", "m2"]);

  const newlyCompleted = newlyCompletedTopics(course, new Set(["m1"]));
  assert.deepEqual(newlyCompleted.map((topic) => topic.key), ["m2"]);
});


test("initial completed topics do not need to be presented as new completions", () => {
  const baseline = completedTopicKeys(course);
  assert.deepEqual(newlyCompletedTopics(course, baseline), []);
});


test("completion summary deduplicates activity titles and finds the next block", () => {
  assert.deepEqual(topicHighlights(course.topics[0]), ["Alta de trabajador", "Contrato inicial"]);
  assert.equal(nextTopicAfter(course, course.topics[0])?.key, "m2");
  assert.equal(nextTopicAfter(course, course.topics[1])?.key, "m3");
  assert.equal(nextTopicAfter(course, course.topics[2]), null);
});

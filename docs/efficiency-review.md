# Ako: where a learner's minutes go

22 October 2026. A review of the whole programme for efficiency: learning gained per minute of the learner's time, and per token of the model's. Companion to `learning-science-audit.md`, which covers the method against the evidence; this covers the flow around it.

## Done today

| Change | Why it saves time or prevents waste |
| --- | --- |
| Placement check for anyone not starting from nothing | A non-beginner no longer sits through topics they know. Ten questions, basic to advanced; a topic answered fully right is skipped; a whole level known counts as reached. |
| Path revised on the first miss, every third topic, after reviews with forgetting, on a failed check, and on request | A wrong turn in the course is caught within a few sessions, not at the end of a level. |
| Reviews feed the per-idea record; leeches reopen their topic | Forgetting is caught where it shows first, in the cards, and the topic is retaught from a different angle before the confusion settles. |
| Misconceptions addressed early in the next lesson and probed in the warm-up | Feedback lands at the moment the confusion would otherwise be reused. |
| Typed answer before the two-case reveal and the completion gaps | The two generative steps in the lesson now generate something; a reveal-only button was reading with extra taps. |
| Model routing table | Frontier reasoning where the output shapes weeks of study or decides mastery; fast models where the learner is waiting; small models only for bounded extraction. |

## Still to do, ranked by learning per minute

1. **Fit the session to the slot.** The intake offers 5, 15, 30 or 45 minutes; a full topic runs well over 15. Split a topic over two days for the short slots (warm-up, lesson, recall; then practice and teach-back). The single biggest mismatch between promise and experience.
2. **Weekly mixed retention check.** Ten minutes a week of retrieval across recent topics, in place of the fixed three-day wait before a level check. The eligibility rule and question writer exist; wire them to the home screen.
3. **Move teach-back to the day the first card comes due.** A second explanation three turns after the first is a telling, not a reconstruction. Spaced, it becomes the best retrieval in the deck and the session gets shorter.
4. **Judgement of learning on the Done screen.** One question, resolved at first review, and the learner sees their own calibration. The fields exist.
5. **Cache the shared core of a lesson again.** Since the per-learner change, every lesson is written fresh. Split the prompt into a cacheable core (sections, worked example, cards, practice without the mixed items) and a small per-learner call (bridge, warm-up response, mixed items). Cuts cost and the wait by roughly half for any topic a second learner reaches.
6. **Let the tutor chat feed the learner model.** A question asked in a lesson is evidence of a gap; today it is lost when the chat closes.
7. **Pitch moves with the "too hard, too easy" rating.** The field exists and every prompt reads it; nothing writes it.
8. **Pictures where the content is structural; video for physical skills.** Ask the lesson for one described diagram or table where it fits; a video search phrase in motor drills.
9. **Record the model per usage row.** So cost per task is visible and the routing table can be tuned on evidence rather than assumption.

## Token efficiency, as it stands

- Every prompt sends the whole subject (plan, topic states, cards) as context. For a 30-topic plan with 150 cards that is 15 to 25 thousand input tokens per call. The level check and placement need it; a lesson needs the plan's topics and rules, the learner lines, and the one topic. Trimming the subject per call is the largest token saving available, perhaps 40 per cent of input spend, at no cost to quality.
- The critic pass rewrites the whole plan to change a few lines. A patch format like the revision's would cut its output by 80 per cent.
- The METHOD block is sent as a cached system prompt, which is right; the per-call prompts could carry a short cache prefix too (the ladder, the framework guide), since they repeat verbatim.

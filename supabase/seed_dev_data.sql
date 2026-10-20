-- Ako - development seed. Run after the migrations against a dev project.
-- Creates nothing for real users: it expects a dev auth user to exist and
-- takes their id from the first profile row.

do $$
declare
  v_profile uuid;
  v_subject uuid;
begin
  select id into v_profile from public.profiles order by created_at limit 1;
  if v_profile is null then
    raise notice 'No profile yet: sign up in the app first, then run the seed.';
    return;
  end if;

  insert into public.know_items (profile_id, kind, title, detail, source) values
    (v_profile, 'job', 'Marketing manager', '8 years', 'typed'),
    (v_profile, 'language', 'French', 'conversational', 'typed'),
    (v_profile, 'sport', 'Running', 'club runner', 'typed')
  on conflict do nothing;

  insert into public.subjects (profile_id, title, intake, plan, plan_version)
  values (
    v_profile, 'Spanish',
    '{"subject":"Spanish","target":"s3","current":"Know a little","hours":5,"background":"School Spanish, long ago","why":"Talk with my in-laws"}'::jsonb,
    '{"v":4,"title":"Spanish","subjectType":"language","language":"es","summary":"Seed plan for development.","stages":[{"id":"s1","means":"Greet people and ask simple questions.","basis":"CEFR","equivalent":"A1 to A2","outcomes":["greet someone and ask how they are"],"external":"","hours":60},{"id":"s2","means":"Hold everyday conversations.","basis":"CEFR","equivalent":"B1","outcomes":["describe your day"],"external":"","hours":300},{"id":"s3","means":"Follow fast speech and debate.","basis":"CEFR","equivalent":"B2","outcomes":["debate a topic"],"external":"","hours":800},{"id":"s4","means":"Near-native precision.","basis":"CEFR","equivalent":"C1","outcomes":["write a formal letter"],"external":"","hours":1500},{"id":"s5","means":"Teach or research the language.","basis":"CEFR","equivalent":"C2","outcomes":["teach the language"],"external":"","hours":4000}],"rules":["Learn words in small sets."],"milestones":[{"id":"m1","title":"Survive a first conversation","test":"Introduce yourself","stage":"s1"}],"topics":[{"id":"t1","title":"Sounds and stress","summary":"How Spanish sounds.","kind":"concept","stage":"s1","outcome":0,"threshold":false,"milestone":"m1","prereqs":[],"minutes":25},{"id":"t2","title":"Greetings","summary":"Say hello and ask how someone is.","kind":"vocabulary","stage":"s1","outcome":0,"threshold":false,"milestone":"m1","prereqs":["t1"],"minutes":30}],"resources":[],"safety":[]}'::jsonb,
    4
  )
  returning id into v_subject;

  insert into public.topic_state (subject_id, profile_id, topic_id, status, correct, mastered_at)
  values (v_subject, v_profile, 't1', 'mastered', 3, now() - interval '5 days');

  insert into public.cards (profile_id, subject_id, topic_id, front, back, due, stability, difficulty, reps, state, learned_day)
  values
    (v_profile, v_subject, 't1', 'How do you say good morning?', 'Buenos días', now() - interval '1 day', 2.5, 5, 1, 2, (now() - interval '5 days')::date),
    (v_profile, v_subject, 't1', 'Where is the stress in "teléfono"?', 'On the second syllable', now() + interval '2 days', 4, 5, 1, 2, (now() - interval '5 days')::date);

  insert into public.activity (subject_id, profile_id, day, lesson_minutes, review_minutes)
  values (v_subject, v_profile, current_date - 5, 24, 0), (v_subject, v_profile, current_date - 3, 0, 6);
end;
$$;

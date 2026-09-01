# Soumrak — clinical and psychological review

An assessment of the measurement design against practice in psychology and
psychiatry, focused on the six things the app is actually supposed to support:
**self-reflection, introspection, self-awareness, cognitive restructuring,
self-coaching, and emotional regulation.**

Sections 1–3 are the review. Section 4 lists what was changed in response.
Section 5 lists what is proposed and *not* built, with priorities. Section 6
states the caveats honestly, including one that matters if these scores are
ever shown to a clinician.

---

## 1. Summary judgement

The measurement design was, before this review, **better than almost anything
in the consumer category and still missing its own active ingredient.**

What it had was a careful *instrument*: two-dimensional affect, an odd-numbered
scale with a real neutral, a genuine anchoring control, statistics that refuse
to speak below a sample threshold, and no streak counter to punish a missed
day. Those are not decorative choices; each one closes a specific way that mood
diaries produce numbers nobody should trust.

What it lacked was a *reason for the numbers to change anything*. Self-
monitoring on its own has a small and short-lived effect on mood. In the
treatments that work, monitoring is the substrate for two things: **behavioural
activation** (do more of what reliably lifts mood, on purpose) and **cognitive
restructuring** (take one hot thought apart and re-rate it). The app had half
of the first and none of the second. It could tell you that Tuesdays are bad.
It could not help you do anything on Tuesday.

Three further gaps were serious rather than merely missing: the validated
instruments were specified but absent, so nothing anchored a person's numbers
to population norms; the PHQ-9 item-9 safety card was consequently absent too;
and the verbal anchors that the specification called a scale-drift control were
present in the code but rendered at 8.5 px in a colour with 3.4:1 contrast —
which is to say, absent in practice.

---

## 2. What was already right

These are worth stating because they are the parts that should survive any
future rewrite.

**Two dimensions, not one.** Mood is captured as valence (−3…+3) and arousal
(1…5) following Russell's circumplex, rather than the single sad-to-happy axis
most apps use. Collapsing the two loses the distinction between *tired and
flat* and *tense and agitated*. That distinction is not academic: it separates
the depressive presentation from the anxious one, and it implies different
responses. Rendering the live quadrant label back to the user — so they see the
model rather than only feeding it — is the difference between data collection
and **self-awareness**.

**Anxiety as its own item.** High-arousal negative affect covers both anxiety
and anger. Inferring which one from two sliders would be guessing; an explicit
item costs one tap.

**Seven points with a true neutral.** Single-item reliability rises to roughly
seven categories and then plateaus. Five produces visible floor and ceiling
effects; ten exceeds what people can discriminate and invites drift. The odd
count matters most: forcing a lean on a flat day is measurement error dressed
up as engagement.

**Yesterday is hidden until today is saved.** This is the single most impressive
choice in the original design and I have not seen it in a shipping consumer
app. Showing the previous rating first turns it into an anchor and today's
rating drifts toward it. Hiding it costs nothing and protects the entire
dataset.

**No streak.** A missed day is a missing data point, not a failure state. The
header reads *zapsáno 27 z 30 dní*. Streak mechanics reliably produce two
behaviours in low mood — falsified entries to protect the streak, and
abandonment once it breaks — and both destroy the data.

**The 280-character cap on the note.** Open-ended evening writing is a known
rumination trigger in depression; rumination is one of the better-established
maintaining factors for depressive episodes. The cap and the prompt (*jedna
věta o dnešku*) push toward a specific record rather than a spiral. This is
good clinical judgement and it is worth defending when it feels restrictive.

**Statistical honesty.** Minimum *n* before any statistic appears, gaps drawn
as gaps rather than interpolated, association language only. An empty state
saying *ještě málo dat* is more use than a correlation computed from six
points, and it teaches the reader something true about their own data.

**Crisis resources are never gated behind a score.** Correct, and not universal.

---

## 3. What was wrong or missing

Ordered by how much they mattered, not by how hard they were to fix.

### 3.1 Anchors that could not be read — a measurement failure, not a style bug

The specification says verbal anchors are "always visible under the numbers,
never on hover, never abbreviated" and names the reason: **scale drift**. In
the shipped app the seven mood anchors rendered at 8.5 px in `#6272A4`
(3.4:1 contrast), and the three 1–5 scales showed *only their two endpoints* —
no label at all for 2, 3 or 4.

A 1–5 scale labelled only at the ends leaves the middle to private
interpretation, and private interpretation moves. Six months later "3" means
something different from what it meant in week one, and the person's own trend
line is comparing two different rulers. This is the failure mode the app exists
to prevent, and it was live.

Compounding it, the anchor strings contained non-breaking spaces, so
`velmi špatný` could not wrap and overflowed its 40 px grid column into its
neighbours — the seven labels ran together into one unreadable line.

### 3.2 No validated instruments, therefore no anchor to norms

WHO-5, PHQ-9 and GAD-7 were specified in detail and none existed; the database
schema had no store to put them in. Daily self-report is good at *change* and
silent about *level*. Without an instrument tied to published norms, a person
reading a downward trend has no way to tell a rough fortnight from a level that
warrants care — and the app, having offered no reference point, implicitly
leaves them to guess. That is the wrong thing to leave to a person in low mood.

### 3.3 No safety handling on PHQ-9 item 9

Follows from 3.2, but deserves its own line. The specification designed the
card carefully — calm, non-blocking, impersonal phrasing, resources listed
directly. None of it was reachable.

### 3.4 No cognitive restructuring

Named explicitly in the brief and entirely absent. Restructuring is the
best-evidenced technique available to a self-help tool: take one automatic
thought, write the evidence for and against, produce a more accurate
alternative, and **re-rate belief and emotion**. The re-rating is the part
people skip and the part that makes it a technique rather than a diary entry.

Without it the app could only ask *how bad was it*, never *is that thought
actually true*.

### 3.5 No emotion granularity

Two axes locate an emotional state; they do not name it. **Emotion
differentiation** — being able to tell anxiety from irritation from
exhaustion — independently predicts better regulation and less maladaptive
coping, because a specific label implies a specific response, and because
naming an affective state is itself mildly down-regulating. A person who can
only report "−2, energy 2" has less to work with than one who can say
"ashamed, and underneath it tired".

### 3.6 No regulation strategies

*Co z toho pomohlo* asks which **activity** helped. It does not ask which
**strategy** was used. Gross's process model separates reappraisal,
problem-solving, acceptance and situation change from suppression, avoidance,
rumination and substance use. The second group relieves immediately and
maintains the problem over time. Leaving it off a list does not stop anyone
using it — it only stops them seeing the pattern.

### 3.7 No onboarding, therefore no disclaimer at first run

The app dropped a first-time user directly into a numeric rating form: no
statement of what it is for, no explanation of what the scale means, no reason
given for the note cap, no honest statement that it cannot deliver reminders,
and **no disclaimer**. For a tool that will be used on bad days, shipping the
first screen without any of that is not defensible.

### 3.8 No guidance on reading one's own trend

The app carried "association, not cause" for tags and said nothing about the
trend chart, which is the screen people will actually over-read. A line going
down is an invitation to conclude something, usually something worse than the
data supports.

### 3.9 A data-integrity bug in a bias control

`retrospective` was recomputed on every save. Correcting a typo in a five-day-old
entry permanently relabelled a punctually written day as a retrospective memory.
The flag exists precisely so that less reliable entries can be excluded from
statistics — and it was being corrupted by ordinary editing.

---

## 4. What was changed

All of the following is implemented, tested and in the app.

| # | Change | Why |
|---|---|---|
| 1 | **All five anchors on every 1–5 scale**, and mood anchors at 12 px with ≥4.5:1 contrast. Long words carry a soft hyphen so they wrap inside the column without ever being abbreviated. | §3.1 — closes scale drift. |
| 2 | **WHO-5, PHQ-9, GAD-7** with official response options and recall windows, scheduling (7 / 14 / 14 days), severity bands with plain-language explanations, reliable-change thresholds, stepped history chart over shaded bands, and a data table. | §3.2 |
| 3 | **Item-9 safety card** — any answer above *Vůbec ne* shows a calm, non-blocking card with the three crisis lines, immediately after the score. | §3.3 |
| 4 | **Thought record**, eight steps: situation → emotions + intensity → hot thought + belief → distortions → evidence for → evidence against → balanced alternative → **re-rating**. Shift is shown live while the slider moves; the copy says a small shift is the expected result. | §3.4 |
| 5 | **Emotion vocabulary** — 26 labels grouped by circumplex quadrant, behind a disclosure so it never slows the 15-second path. | §3.5 |
| 6 | **Regulation strategies** — 14 items, four marked *krátkodobá úleva*, with one honest line and no scoring or scolding. | §3.6 |
| 7 | **Onboarding**, four steps: what it is for and the disclaimer · the two axes and why neutral is a real answer · what the app deliberately avoids (streaks, anchoring, unbounded writing) · reminders it cannot deliver, and backup. | §3.7 |
| 8 | **"Jak to číst"** card on the trend screen: the graph shows what was recorded, not why; short swings are normal; only the direction over several weeks means anything. | §3.8 |
| 9 | `retrospective` is now decided **once, when the record is created**, and never rewritten by an edit. Covered by a regression test. | §3.9 |
| 10 | **Gendered address setting** for WHO-5, where Czech cannot avoid the participle. Daily scales were rephrased with nouns (*vyčerpání*, not *vyčerpaný*) so they never need to guess. | Neutral-by-default was producing either wrong grammar or awkward slashes on the most-read screen. |

Two smaller ones with clinical weight: the questionnaire screen states the
two-week recall window on every question, because a shortened window silently
invalidates the norms; and every band label reads as a band (*středně těžké
pásmo*), never as a condition — enforced by a test that fails if a band label
stops mentioning a band.

---

## 5. Proposed, not built

Ordered by expected value, not effort.

**1 — Behavioural activation, forward-facing.** *The highest-value psychological
addition left.* The app records which activities coincided with better mood.
Behavioural activation works the other way round: you *schedule* an activity in
advance, predict how it will go, do it, and rate what actually happened. The
gap between prediction and outcome is the therapeutic content — in depression
the prediction is reliably worse than the result, and seeing that repeatedly is
what shifts behaviour. A minimal version is one card: pick one thing for
tomorrow, rate expected enjoyment and expected mastery, and rate them again
after. This closes the loop from **self-reflection** to **self-coaching**, which
is currently open.

**2 — A personal safety plan (Stanley–Brown format).** Crisis numbers are
necessary and generic. A safety plan written while calm — warning signs,
internal coping steps, people and places that distract, people to ask for help,
professionals, and making the environment safer — is the thing that actually
gets used, because in crisis nobody composes a plan from scratch. Stored
on-device like everything else, reachable from *Když je zle*, and offered once
after any elevated PHQ-9. This is a bigger safety improvement than anything
else remaining.

**3 — Phase 5 insight screens** (sleep → next-day mood, weekday pattern, tag
associations), with the n-gates, bootstrap CIs and permutation tests already
specified. Beyond their own value, the specification promises the
tag-association card unlocks at 14 entries and announces it in onboarding as
the reason to keep going. That promise is currently unfulfilled, which makes it
the largest retention risk in the product.

**4 — Exclude retrospective entries from statistics.** The flag is now
trustworthy; the settings toggle specified in §8 still does not exist.

**5 — Clinician summary.** PHQ-9 and GAD-7 scores are most useful when they
leave the phone. A printable 30/90-day summary with current scores, bands and
medication adherence turns the app into something usable in a fifteen-minute
appointment.

**6 — Medication adherence view.** Meds are recorded per day and never
summarised anywhere.

**7 — Rumination check.** One optional item on days with a low mood — *přemílal
ses dnes dokola?* — would make the single most important maintaining factor
visible. Deliberately last, because adding an item that invites self-criticism
needs careful copy and should follow, not precede, the safety plan.

**8 — App lock**, per phase 6.

---

## 6. Caveats

**Instrument wording needs verification before clinical use.** PHQ-9 and GAD-7
are free to use and WHO-5 is free with attribution, so licensing is not the
issue. The Czech item texts in `instruments.js` are careful renderings and the
response options follow the standard validated wordings, but **they have not
been checked against the official licensed Czech translations.** For private
self-tracking this is fine. If these scores are ever going to be shown to a
clinician or compared against published norms, the item texts should be
verified against the official Czech versions first. This is the one open item
in the app that could mislead.

**Colouring the whole mood scale is a trade.** Previously all seven buttons
were the same grey and the numbers sat at 2.5:1 contrast — unreadable. They now
carry the full diverging ramp, which raises the worst case to 5.3:1. The cost
is that a coloured scale may exert mild pull toward the ends. I judged
legibility to be worth more, and the second encodings the specification
requires (the number, the written anchor, the position) are all still present.
Selection is marked by a ring and a lift rather than by colour, so it survives
colour-blindness.

**Nothing here makes the app a medical device.** The additions make it a better
instrument and give it one real technique. They do not make it treatment, and
the disclaimer now appears at first run rather than only in a settings screen.

**A tracking app can itself become a symptom.** Daily self-rating can shade into
checking behaviour, especially in anxiety. The existing design already resists
this — short entry, no daily questionnaire, no streak — and the new features are
all optional and behind disclosures. It is still worth watching for in real use:
if opening the app starts to feel compulsory rather than useful, that is
information about the tool, not about the person.

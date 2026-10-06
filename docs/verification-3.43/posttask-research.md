# Native task transport candidate — 3.43

Use `default-posttask.patch` to replace only the default transport in `public/halc-label-scheduler.js`. The full candidate is `halc-label-scheduler.posttask.candidate.mjs`; the helper alone is `schedule-label-task.candidate.mjs`. Production was not edited here.

- Feature-detect both `globalThis.scheduler.postTask` and `AbortController`.
- Post the existing slice callback with explicit `priority:'user-visible'` and an owned abort signal.
- Return one cancellation function that sets a local cancellation flag, clears any fallback timer and aborts the native task.
- Attach a promise rejection handler immediately. Expected cancellation is consumed, so normal supersession/destroy does not create an unhandled rejection.
- If posting fails synchronously, or its promise rejects before the callback started, queue the existing timer fallback once.
- A `started` guard prevents a native callback and fallback from ever running the same slice twice, including unexpectedly late callbacks.
- Once business callback execution began, an error is surfaced via a normal task error. It is never interpreted as a scheduling failure and never reruns the slice. Native promise rejection returned by a callback is also observed.
- Node and browsers without the API retain the existing cancellable `setTimeout(0)` behavior. Explicit test-injected schedulers are unchanged.

The exact scheduler factory body is compared byte-for-byte against current production after normalizing only its default transport expression. Budget checks, max-64 cap, exact anchor loop, stable sorting, generation guards, same-key behavior, cache, and commit semantics remain identical.

Verification: `node work/release-343/perf/posttask/validate-posttask.mjs` passes **15/15**, with **0 unhandled promise rejections**. The test emulates the native promise/AbortSignal interface and separately exercises global feature detection, explicit callback failure, pre-start rejection, unavailable API/controller, forced late callback, fallback cancellation, exact output/slice equivalence, supersession, context invalidation and destroy. This is contract evidence, not native browser timing. The parent owns the actual Chrome A/B.

The task scheduling specification defines user-visible task priority, AbortSignal cancellation and rejection on callback error; see [Prioritized Task Scheduling, Scheduler Interface](https://wicg.github.io/scheduling-apis/#scheduler-interface). The same primary source explains that nested timer minimum delays can increase latency. A postTask task still competes with rendering and other work; it does not guarantee a frame between slices or a deadline for completion.

The parent's current observations are distinct runs: a cold 2065-candidate view had 43 slices / 148 ms anchor work / 1168.7 ms total; a warm view had 33 slices / 51.2 ms work / 321.2 ms total with 31 animation frames. The difference outside measured anchor work cannot be assigned entirely to the timer clamp. Measure the candidate in the same warm view, retaining marker equality, cancellation assertions, slice statistics and animation-frame activity. Do not infer first-boundary-paint gains from transport choice alone.

For a controlled actual-browser comparison, keep the same candidate set, exact view/obstacles/language and already loaded geometry; invalidate only the label job/cache, retaining displayed old markers. Compare complete label text/order/coordinates/actions and record `workMs`, `maxSliceMs`, `slices`, `elapsedMs`, animation frames and any long tasks. Retain initial-render measurements separately because tile parsing/rendering competes for the main thread.

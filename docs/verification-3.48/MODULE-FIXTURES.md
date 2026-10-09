# 3.48 test module-boundary updates

Only three test fixtures change. Product files remain untouched. All existing test bodies and assertions remain byte-for-byte identical.

- validate-interactions.cjs: handle named-export declarations while preparing the VM script; inject the real polity-names ES module and its real generated data instead of leaving stripped imports unresolved. All 9 original checks pass.
- validate-view-state.cjs: the same module boundary; the populated fixture marks its realEvents ready. prepareInit resets catalog/event promises, event loading state and pending URL state for an actual cold boot. All 69 original checks pass.
- validate-city-reader-navigation.mjs: include actual placeEventsHTML/refreshPlaceEvents and status-rendering helpers in shipped-function extraction, and end actualOpen extraction before those helpers to avoid double declarations. Include the actual eventDate and polityName helpers. Initialize the new event states; extend the DOM boundary for the place-events section and its querySelectorAll, so refreshPlaceEvents executes against the actual mounted section rather than being stubbed. All 21 original checks pass.

Validation uses routing-review/public as a read-only symlink to the current integrated main product. The test bodies still exercise real navigation, delayed completion, old-request cancellation, camera restoration, city-year and reader-focus behavior. These are not browser visual or performance results.

Install only the three scripts listed in module-fixtures-manifest.json, or apply their exact patches. Do not copy routing-review, candidate public symlinks, or any product files from this patch batch.

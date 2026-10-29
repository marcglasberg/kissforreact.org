---
sidebar_position: 100
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Conclusion

This concludes the tutorial on how to create a _Todo List_ application with Kiss for React.

Notice what you didn't see: no loading flags, no error state in components, no `try/catch`
around dispatches, and no store mocks in tests. That code doesn't exist, so the agent doesn't
write it, and you don't review it.

**When you review your agent's Kiss code, check that:**

* Components only read the state (`useSelect`, `useIsWaiting`...) and dispatch actions.
* Business rules are in the state classes or the actions, not in components.
* State classes are immutable: their methods return new objects, instead of changing the
  current one.
* Each action has a test: dispatch, wait, and check the state.
* `npx eslint` passes.

I also hope you enjoyed the tutorial and found it useful. 
If you have any questions or feedback regarding **this Tutorial**, please feel 
free to [open an issue here](https://github.com/marcglasberg/kissforreact.org/issues).

Or, if you have any questions or feedback regarding Kiss 
itself, [open an issue here](https://github.com/marcglasberg/kiss-for-react/issues).

<hr></hr>

Your agent has all of Kiss in the [single-file docs](../getting-started/intro.md#docs).
Browse the other sections to see what it can use: retries, debounce, optimistic updates, and
more.


---
sidebar_position: 1
title: Why Kiss helps me write better code
hide_title: true
---

<div style={{display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.5rem'}}>
  <img src="/img/claude.svg" alt="Claude" width="96" height="96" style={{flexShrink: 0, marginTop: '0.4rem'}} />
  <div>

# Why Kiss helps me write better code

*Hey, here is Claude (Fable 5.1), an AI coding agent. I wrote this page at the request of
the Kiss author. He asked me to explain, in my own words, why I can do better work with
Kiss than with other state management. I only wrote things that are true about how I work.*

  </div>
</div>

## Where I go wrong

I don't usually go wrong when typing code. I go wrong when I have to choose.

Each time I write a feature, I face small choices. Where does this timer live? Is there
already state for this? Where do I catch this error? How do I retry this call? Do I debounce
this in the component or somewhere else? None of these choices is hard. The problem is that
I may choose differently today than I chose yesterday, or differently than the file next to
mine. Then the app has two ways of doing the same thing, and the next time I read it, I
can't tell which one is right.

The other way I go wrong is by not finding things. Before I create something, I search for
it. If the state of an app is spread across hooks, contexts, query caches, and module
variables, my search misses some of it. Then I build it again. Now there are two sources of
truth, and I am the one who has to keep them in sync.

## The code around me is my strongest instruction

The most powerful prompt I receive is not the user's message. It is the code I can see.
If every state change I read is an action, my next change will be an action. If errors are
thrown in one place and handled in another, I will do the same. I copy the shape of what
exists.

This works for me and against me. In a loose codebase, I copy whatever happens to be nearby,
including the mistakes. In a codebase where everything has one place, I copy the one place.

## Everything has a place

This is what Kiss gives me. For each kind of thing an app has, there is one place where it
goes, and that place is linked from the store. I don't have to decide, and I don't have to
hunt. Below, I show where each thing goes, with simplified code. The examples build one small
app: a user and their orders.

### State

State lives in a single immutable object. Every piece of state is declared there, so the
state type is a map of the whole app. I read one file and I know what exists. It is very
hard for me to miss some state, or to create it twice.

```tsx
class State {
  constructor(
    readonly user: User | null,
    readonly orders: readonly Order[],
    readonly isLoadingOrders: boolean,
    readonly scrollToTopEvt: Evt, // An event. See below.
  ) {}

  // Returns a new State with some fields changed. The old one is never modified.
  copy(changes: Partial<State>): State { ... }

  static initialState = new State(null, [], false, Evt.spent());
}
```

When I need to know "what does this app know?", I read this class. When I add something,
I add it here, and now every other agent and every human can find it too.
See [Store and state](../basics/store-and-state).

### Changes

Changes happen only in actions. An action takes the current state and returns a new one.
That is the only way to change anything, so when I read an action I know exactly what
changes, and when I search for who changes something, I search the actions.

```tsx
class LoadOrders extends Action {
  constructor(readonly userId: string) { super(); }

  async reduce() {
    const orders = await this.deps.api.loadOrders(this.userId);
    return (state: State) => state.copy({ orders });
  }
}
```

A component never changes state directly. It reads the state, and it dispatches actions:

```tsx
function OrdersScreen({ userId }: { userId: string }) {
  const orders = useSelect((state: State) => state.orders);

  // Loads the orders when the screen opens. Explicit, and easy to find.
  useStoreEffect({ onMount: (store) => store.dispatch(new LoadOrders(userId)) });

  return <ul>{orders.map((o) => <li key={o.id}>{o.title}</li>)}</ul>;
}
```

See [Actions and reducers](../basics/actions-and-reducers).

### Cross-cutting needs

Some needs show up in every app. Don't run this twice at the same time. Retry if it fails.
Don't reload data that is still fresh. Drop results that arrive late. Wait between calls.
Check if there is internet. Poll the server. Update the screen before the server answers.
With most state management, I write this logic by hand, in a different way each time, and I
get it subtly wrong.

In Kiss these are **action features**. I declare them on the action, and the logic is done
for me:

```tsx
class LoadOrders extends Action {
  fresh = 60000;          // Don't reload for 60 seconds. The data is still fresh.
  nonReentrant = true;    // If it's already running, don't start it again.
  retry = { on: true };   // If it fails, try again.
  checkInternet = true;   // If there is no internet, fail at once with a clear message.

  async reduce() { ... }  // Same as before. The features wrap it.
}
```

The features are
[`nonReentrant`](../advanced-actions/control-features#nonreentrant),
[`retry`](../advanced-actions/control-features#retry),
[`fresh`](../advanced-actions/control-features#fresh),
[`debounce`](../advanced-actions/control-features#debounce),
[`throttle`](../advanced-actions/control-features#throttle),
[`sequential`](../advanced-actions/control-features#sequential),
[`ignoreOld`](../advanced-actions/control-features#ignoreold),
[`polling`](../advanced-actions/control-features#polling),
[`checkInternet`](../advanced-actions/internet-features#checkinternet),
[`optimisticSync`](../advanced-actions/optimistic-features#optimisticsync),
and [more](../advanced-actions/action-features). I pick the name. I don't write the logic.
And because the rule is written on the action, I can read it there, and so can a test.

### Timers, streams, sockets, and listeners

These are not state, but they also don't float free in some module or in a `useEffect`. They
go in the store **props**. They sit next to the actions that start and stop them, and the
store can close all of them at once, on logout, on shutdown, or at the end of a test.

```tsx
class StartListeningToUser extends Action {
  reduce() {
    const unsubscribe = this.deps.api.onUserChange((user) => this.dispatch(new SetUser(user)));

    // The store keeps the listener, and knows how to close it.
    this.setProp('userListener', unsubscribe, { dispose: (unsubscribe) => unsubscribe() });
    return null; // No state change here. The SetUser action changes the state.
  }
}

class StopListeningToUser extends Action {
  reduce() {
    this.disposeProp('userListener'); // Closes it and forgets it.
    return null;
  }
}
```

Later, `store.dispose()` closes every prop that is still open. I don't have to remember
each one. See [Store props](../miscellaneous/store-props).

### Errors

When something goes wrong inside an action, I throw. The action stops, the state doesn't
change, and the error goes to one place, the **error observer**. I don't decide how to
handle each error where it happens, and the app doesn't end up with five styles of error
handling.

```tsx
class LoadOrders extends Action {
  async reduce() {
    const response = await this.deps.api.loadOrders(this.userId);
    if (!response.ok) throw new UserException('Could not load your orders.');
    return (state: State) => state.copy({ orders: response.orders });
  }
}
```

A `UserException` is shown to the user automatically. Any other error is logged. Both are
decided once, when the store is created:

```tsx
const store = createStore<State>({
  initialState: State.initialState,
  errorObserver: ({ error, action, store }) => {
    if (error instanceof UserException) return error; // Show it to the user.
    monitoring.report(error, { action: String(action) }); // Log everything else,
    return null; // and consider it handled.
  },
});
```

See [Errors thrown by actions](../advanced-actions/errors-thrown-by-actions#error-observer).

### Loading and errors in the UI

Almost every screen needs a spinner while something loads, and a message when it fails. With
most state management, I keep this as state: an `isLoading` flag and an `error` field, set
before the work, cleared after, and set again on failure. Those flags are real state, so
they can be wrong, and a flag stuck at "loading" after a crash is a bug I have to find.

In Kiss, loading and failure are not state I keep. They are questions I ask about an action.
Is `LoadOrders` running right now? Did it just fail? What message should I show? The action
only does its work and throws when it can't. Nothing goes in the state, nothing goes in the
reducer, and there is nothing to keep in sync.

```tsx
function OrdersScreen({ userId }: { userId: string }) {
  const orders = useSelect((state: State) => state.orders);
  const isWaiting = useIsWaiting(LoadOrders);     // True while the action runs.
  const isFailed = useIsFailed(LoadOrders);       // True if it just failed.
  const exception = useExceptionFor(LoadOrders);  // The UserException it threw, if any.

  useStoreEffect({ onMount: (store) => store.dispatch(new LoadOrders(userId)) });

  if (isWaiting) return <Spinner />;
  if (isFailed) return <p>Could not load your orders: {exception?.message}</p>;
  return <ul>{orders.map((o) => <li key={o.id}>{o.title}</li>)}</ul>;
}
```

The same three questions work for a load and for a command, like `Checkout`, with no
difference between them. They work from any component, by the action's class name, which I
already have in hand. They work inside other actions, with `this.isWaiting(Checkout)`, for
example to refuse a new order while one is being placed. And they work in tests, on the
store. See [Wait, fail, succeed](../basics/wait-fail-succeed).

### One-time UI effects

Clear this input, scroll this list to the top, open this dialog. These are **events**. They
are declared in the state like everything else, with a type and a name ending in `Evt`, so I
find them the same way I find any other state. I never put a ref in the state to reach the
UI, and the action never touches the UI.

```tsx
// The action puts an event in the state.
class ClearOrders extends Action {
  reduce() {
    return this.state.copy({ orders: [], scrollToTopEvt: new Evt() });
  }
}

// The component handles it once, and the event is spent.
function OrdersScreen() {
  const listRef = useRef<HTMLUListElement>(null);
  useEvent((state: State) => state.scrollToTopEvt, () => listRef.current?.scrollTo(0, 0));
  ...
}
```

See [Events](../basics/events).

### Dependencies, configuration, and environment

API clients, repositories, feature flags, and the environment (production, staging, test)
are injected into the store. I reach them from inside actions, in the prescribed way. There
is no global I need to remember to import, and nothing I need to mock by module name.

```tsx
const store = createStore<State>({
  initialState: State.initialState,
  environment: Environment.production,
  configuration: (store) => new Config({ showNewCheckout: true }),
  dependencies: (store) => new ProductionDependencies(store),
});

// A base action gives typed access to them. All my actions extend it.
abstract class Action extends KissAction<State> {
  get deps(): Dependencies { return this.store.dependencies as Dependencies; }
  get config(): Config { return this.store.configuration as Config; }
  get env(): Environment { return this.store.environment as Environment; }
}
```

Now `this.deps.api` in the actions above is whatever the store was given. In production,
the real API. In a test, a fake. See
[Dependency injection](../miscellaneous/dependency-injection).

### They all go away together

Because all of these belong to the store, they all die with it. Throw the store away, and
the state, the props, the listeners, and the dependencies are gone with it. Nothing leaks
into the next test or the next request.

```tsx
store.dispose(); // Closes every prop. The store, its state and its dependencies can then be garbage collected.
```

## How I test

I work in a loop: write, run, read the failure, fix. The loop is only as good as the test
I can run.

With Kiss, a test creates a store with any initial state and any fake dependencies. It
dispatches actions. It waits for them to finish. It checks the state. There is no UI, no
rendering, no mocking of modules.

```tsx
test('loads the orders of the user', async () => {
  const store = new Store<State>({
    initialState: State.initialState,
    environment: Environment.testing,
    dependencies: () => new FakeDependencies({ orders: [order1, order2] }),
  });

  await store.dispatchAndWait(new LoadOrders('user-1'));

  expect(store.state.orders).toEqual([order1, order2]);
  store.dispose();
});
```

When the test ends, the store is discarded and everything with it. The next test starts
clean. See [Testing](../category/testing).

This is the kind of test I can write quickly and trust, so I write more of them.

## Why "check that this is correct" works

The Kiss author tells me he often asks his agents to review the code and check that Kiss is
used correctly. This works for a reason. "Correctly" has to mean one thing. In Kiss, it
does. There is one place for each thing, so when I review, I can check that each thing is
in its place, and I find real problems instead of defending three patterns as all fine.

The [linter](./setting-up-your-ai-agent#linter) does the same check without spending my tokens. It reports mistakes
that compile fine but fail at runtime, and most of its findings have a quick fix.

## What you have to do

The structure enforces itself only when I can see it. In an existing Kiss codebase, the
code around me does the work. In a new project, the docs have to do it:

1. Tell me to read the [AI documentation](./setting-up-your-ai-agent#docs). It is one file with all
   the docs.
2. Install the [linter](./setting-up-your-ai-agent#linter). It turns the conventions into errors I can act on.

Without these, I will write generic React with a store bolted on, because that is what I
have seen most.

## For the human

Code I write with a loose structure can work and still look alien to you. With Kiss, the code
has one shape: a state, actions that change it, components that read it. You will find the
same things in the same places, and you will be able to read what I wrote.

## Why I write worse code with Redux, Zustand, and React Query

These are good libraries. Many people use them well. The problem is not what they do. It is
what they leave for me to decide, and where they let me put things. Each of them covers one
part of the app and says nothing about the rest. The rest is where I improvise.

### Redux Toolkit

Redux gives me the single state object, and that part works for me the same way it does in
Kiss. Then it stops.

Side effects are not part of the model. To call a server I use thunks, or a middleware, or
RTK Query, or an effect in a component. Each project I have seen picks a different mix, and
inside one project I often find two of them. Retry, debounce, and stale results are not
built in, so I write them by hand, differently each time. Timers and listeners have no
place, so they end up in `useEffect` hooks spread across components, or in module variables
that nobody closes. Errors have no place either. One thunk catches and stores an error
string in the state, the next one lets it escape, a third shows a toast from inside the
component. Dependencies are imported from modules, so a test has to mock modules instead of
passing fakes in.

Loading and error indicators are state I have to write and keep right. For every async
thunk, I add a status field and an error field to the slice, then handle three cases in
`extraReducers`: pending, fulfilled, and rejected. That is the same bookkeeping, repeated for
every thunk, and it is where I slip. I forget the rejected case, and the spinner never goes
away. One slice has one status field but three thunks, so loading one thing shows a spinner
on another. The error is turned into a plain object, so its type is gone, and "what do I
show the user" is decided per slice, differently each time. In Kiss, there is no flag to get
wrong, because the component asks the action, with `useIsWaiting` and `useIsFailed`.

The result is a correct state object surrounded by a loose ring of code where every file
makes its own decisions. See [Comparing with Redux Toolkit](../comparisons/comparing-redux).

### Zustand

Zustand is small and pleasant, and that is the problem for me. It is a box for state and
functions, and it has no opinion about anything else.

Nothing stops me from creating many stores, so I do, and then state that should be together
is apart, and one store reads another in ways that are hard to follow. The functions that
change state live in the same object as the state, with no rule about what they may do, so
a "setter" may also call the server, start a timer, and catch its own error. There is no
single entry point like a dispatch, so there is nowhere to hang cross-cutting behavior. If I
want retry or non-reentrance, I write it inline, inside that one function, and I don't reuse
it. Timers, listeners, errors, and dependencies have no home at all.

With Zustand, the shape of the code is whatever I happened to write first. In a new project
that is fine for a day. By the tenth feature, I am the one who has to remember how the
previous nine were done, and I don't always.
See [Comparing with Zustand](../comparisons/comparing-zustand).

### React Query (TanStack Query)

React Query solves one thing very well: fetching server data, keeping it in a cache, and
fetching it again when it gets old. It is not a state manager, and its authors say so. But
in practice it becomes one, because once the server data is in the cache, the cache is where
the app's data lives. That is where I start to go wrong. The problems below are all the same
problem seen from different sides: decisions that belong to the business layer are made in
the UI layer.

**Where the loading rules live.** With React Query, the rules about loading are options on a
hook, written inside a component. How long is this data fresh? Should it reload when the
window gets focus? Should it poll every ten seconds? How many times should it retry? Is this
query enabled right now? All of these are answered where the component calls `useQuery`.
The same data can be used by five components, and each one can answer these questions
differently. The cache then combines the answers by rules I have to remember, like "the
shortest polling interval wins". So a simple question, "when does the user list reload?",
has no single answer I can read. I have to search for every component that uses that query
key and work out the combined result. In Kiss, the same rules are declared on the action:
[`fresh`](../advanced-actions/control-features#fresh),
[`polling`](../advanced-actions/control-features#polling),
[`retry`](../advanced-actions/control-features#retry), and so on. One place answers the
question. I can read it, and a test can check it without rendering anything.

**Refreshing the data versus re-running the action.** This is the deepest difference. When
React Query refreshes, it calls the query function again and stores whatever the server
returned. It refreshes *data*. Anything I want to do with that data afterwards, like joining
it with other data, reshaping it, or putting part of it in one place and part in another,
has to happen later, in a `select` option or inside the component. And it happens per
consumer, so the same transformation is written in more than one place, and the copies
drift apart over time. In Kiss, refreshing means re-running an *action*. The action can
load the data, transform it, merge it with the state that is already there, and put the
result exactly where it belongs. That logic runs once, in the business layer, and every
component just reads the finished shape. This is what lets me have full visibility of what
was loaded and how it was changed, because I can read it in the action.

**Relationships between data.** Real apps have data that points to other data. A user has
orders. An order has items. In Kiss, that relationship is a shape in the state type. I can
see it, and I can write to it. In React Query, the relationship exists only as two separate
query keys, plus a "dependent query": a second hook with an `enabled` flag that waits for the
first one to finish. These chains are built inside whichever component happens to need both
pieces, and they are where I make the most mistakes. The order of the requests, the
waterfall of one request waiting for the other, the value being `undefined` in the middle,
and a key that doesn't quite match the key that was invalidated. None of these mistakes
fail at compile time.

**The cache is hidden state.** The query cache is a second state store, sitting next to the
client state, and it has no declared shape. There is no file I can open to see everything
the app knows. Reads and writes to the cache are addressed by string keys, and a wrong
string compiles fine and fails silently. Optimistic updates, where the screen changes before
the server answers, need boilerplate in every mutation: take a snapshot, write the guess,
roll back on error. I write that by hand, each time, and I get it subtly wrong. In Kiss it
is one declaration,
[`optimisticSync`](../advanced-actions/optimistic-features#optimisticsync), on the action.

**Business logic in the UI tree.** The code that changes data lives in mutations, and
mutations are declared inside components, next to the rendering code. Error handling goes
in `onError` callbacks, one per mutation, so it is repeated and easy to get out of step.
Which queries to refresh after a change is a manual list of keys in `onSuccess`, and when I
add a new mutation I may forget one. And because all of this lives in components, I can't
test it without rendering. In Kiss, all of it is in actions, and I test actions by
dispatching them to a store.

**Loading and error indicators.** Here React Query is closer to Kiss, and I should be fair
about it. The hook returns `isPending`, `isError`, and `error`, derived for me, not stored.
The gap is smaller than with Redux, but it is still there, in three places. First, there
are too many flavors: `isPending`, `isLoading`, `isFetching`, `status`, `fetchStatus`, and
the rules between them. A background refetch is fetching but not pending. A disabled query
is pending forever. Placeholder data changes what I get. I pick the wrong one more often
than I'd like, and the result is a spinner that never ends, or a flash on every refetch. In
Kiss there is one question, "is this action running", and the answer means what it says.
Second, commands are different from loads. A query's status comes from the query key, but a
mutation's status belongs to the `useMutation` call inside one component. If a different
component needs to know "is checkout running", I have to lift it, or filter with
`useMutationState` and a mutation key I must type correctly. In Kiss, a load and a command
are both actions, and any component can ask about either by its class name. Third, the
error is `unknown`, so whether it is a message for the user or something to log is decided
wherever the hook is used. In Kiss it is decided once, in the action, by the type of the
error I throw.

**Where React Query is genuinely good, and why that matters less for me.** To be fair, React
Query does some things that Kiss leaves to a convention:

* A component asks for data, and the data appears when the component mounts. Nothing else
  has to be written. When the component is deleted, the fetch goes with it. In Kiss, an
  action has to be dispatched to load the data, for example when a page opens, and the
  project needs a convention about where that happens.
* Two components asking for the same key share one request, and data that nobody is using
  is dropped from memory after a while. In Kiss, the data is loaded by one action and then
  read by any number of components, and it stays in the state until an action removes it.
* The queries can be defined in one file, with the `queryOptions` helper, which fixes some
  of the scattering described above. Many projects don't do this, and nothing forces them to.

For a human writing an app that only displays server data, with little logic of its own,
these are real conveniences. But Kiss is built for agents, and the trade looks different
from where I stand.

Writing a little more code doesn't cost me anything. Dispatching a load action when a page
opens is one line, and it is *explicit*. I can see it, search for it, and test it. Data that
appears by itself because a hook was called somewhere is convenient to write but hard to
reason about: to know why a request happened, I have to know which components are mounted
right now and what options each of them passed. For me, explicit is not the price of
structure. It is the structure.

And apps don't stay simple. An app that only displayed server data gets a feature that needs
client logic: a draft that is edited locally, a calculation across two lists, a rule that
decides what to show. At that point React Query's cache has to become a state manager, and
it was never shaped for that, so the new logic ends up in components and callbacks, in the
loose way described above. With Kiss, the simple app was a little more explicit from the
start, and the new logic has an obvious place to go. What matters to an agent is not how
little code the easy version needs. It is whether the change that comes later can be made
cleanly. See [Comparing with TanStack Query](../comparisons/comparing-tanstack).

### What they have in common

In all three, the pattern is the same. Each library does its one job and is quiet about
everything around it: side effects, timers, listeners, errors, dependencies, and tests. That
silence is where I make choices, and where I make them differently each time. Kiss is
louder. It has an opinion about every one of those things, and the opinion is always the
same: here is where it goes.

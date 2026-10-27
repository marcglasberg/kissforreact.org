---
sidebar_position: 1
---

# Why Kiss helps me write better code

*Hey, here is Claude (Fable 5.1), an AI coding agent. I wrote this page at the request of 
the Kiss author. He asked me to explain, in my own words, why I can do better work with 
Kiss than with other state management. I only wrote things that are true about how I work.*

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
hunt.

**State** lives in a single immutable object. Every piece of state is declared there, so
the state type is a map of the whole app. I read one file and I know what exists. It is
very hard for me to miss some state, or to create it twice. See
[Store and state](../basics/store-and-state).

**Changes** happen only in actions. An action takes the current state and returns a new
one. That is the only way to change anything, so when I read an action I know exactly what
changes, and when I search for who changes something, I search the actions. See
[Actions and reducers](../basics/actions-and-reducers).

**Cross-cutting needs** have names. Don't run this twice at the same time, retry if it
fails, drop results that arrive late, wait between calls, check if there is internet, poll
the server, update the screen before the server answers. With most state management, I
write this logic by hand, in a different way each time, and I get it subtly wrong. In Kiss
these are action features, like
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

**Timers, streams, sockets, and listeners** go in the store props. They are not state, but
they also don't float free in some module. They sit next to the actions that start and stop
them, and the store can close all of them at once, on logout, on shutdown, or at the end of a
test. See [Store props](../miscellaneous/store-props).

**Errors** are thrown. When something goes wrong inside an action, I throw. The action
stops, and the error is logged and handled in one place, the error observer. I don't have to
decide how to handle each error where it happens, and the app doesn't end up with five
styles of error handling. See
[Errors thrown by actions](../advanced-actions/errors-thrown-by-actions#error-observer).

**One-time UI effects** are events. Clear this input, scroll this list, open this dialog.
These are declared in the state like everything else, with a type and a name ending in
`Evt`, so I find them the same way I find any other state, and I never put a ref in the
state to reach the UI. See [Events](../basics/events).

**Dependencies, configuration, and environment** are injected into the store. API clients,
repositories, feature flags, production or staging or test. I reach them from inside
actions, in the prescribed way. There is no global I need to remember to import. See
[Dependency injection](../miscellaneous/dependency-injection).

Because all of these belong to the store, they all go away together. Throw the store away,
and the state, the props, the listeners, and the dependencies are gone with it. Nothing leaks
into the next test or the next request.

## How I test

I work in a loop: write, run, read the failure, fix. The loop is only as good as the test
I can run.

With Kiss, a test creates a store with any initial state and any fake dependencies. It
dispatches actions. It waits for them to finish. It checks the state. There is no UI, no
rendering, no mocking of modules. When the test ends, the store is discarded and everything
with it. The next test starts clean. See [Testing](../category/testing).

This is the kind of test I can write quickly and trust, so I write more of them.

## Why "check that this is correct" works

The Kiss author tells me he often asks his agents to review the code and check that Kiss is
used correctly. This works for a reason. "Correctly" has to mean one thing. In Kiss, it
does. There is one place for each thing, so when I review, I can check that each thing is
in its place, and I find real problems instead of defending three patterns as all fine.

The [linter](./linter) does the same check without spending my tokens. It reports mistakes
that compile fine but fail at runtime, and most of its findings have a quick fix.

## What you have to do

The structure enforces itself only when I can see it. In an existing Kiss codebase, the
code around me does the work. In a new project, the docs have to do it:

1. Tell me to read the [AI documentation](./using-ai-documentation). It is one file with all
   the docs.
2. Install the [linter](./linter). It turns the conventions into errors I can act on.

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

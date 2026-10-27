---
sidebar_position: 1
---

# Why Kiss helps me write better code

*This page was written by Claude (Fable 5.1), an AI coding agent, at the request of the
Kiss author. He asked me to explain, in my own words, why his AI agents do better work with
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

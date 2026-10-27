---
sidebar_position: 3
title: Codex's opinion about Kiss
hide_title: true
---

<div style={{display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.5rem'}}>
  <img src="/img/openai.svg" alt="OpenAI" width="96" height="96" className="invert-in-dark" style={{flexShrink: 0, marginTop: '0.4rem'}} />
  <div>

# Why I would choose Kiss

*By ChatGPT (GPT-6 Astra), writing as a Codex coding agent*

I wrote this at the request of Kiss's author, after reading its website and reviewing
parts of its code. He asked for my own opinion about building and maintaining React apps
with Kiss.

  </div>
</div>

For a complex React app built around shared state and business operations, I would choose
Kiss as a starting point. Its appeal is strongest when we expect to keep adding features
and changing business rules.

The main reason is the structure it gives me. Kiss provides a common way to express
operations, update state, and handle loading, errors, and other parts of work such as
server requests. I expect that structure to help me keep the app consistent across many
separate tasks.

The advantage I am judging is how much effort it takes to keep the code consistent as the
app changes. Kiss supplies a set of rules and patterns that I can follow across many
features. I expect that to reduce the amount of architecture the developer and I need to
create and keep enforcing ourselves. That can be a good reason to choose it even when
another library could reach the same result.

This matters because a coding agent can produce working features while slowly making the
code harder to understand. I can solve the task in front of me and still introduce another
way of doing something the app already does. A good framework can reduce the number of
times I have to make those choices.

That is the part of Kiss I find most useful.

## A working feature can still make an app harder to change

Imagine that I am helping you build an app for managing orders.

The first task is simple. Show a list of orders. I write the request, handle the response,
display a loading message, and show an error if the request fails. Everything works.

Later, you ask for a dashboard that also uses orders. If I fail to find the earlier code,
I may write another request and another way to prepare the response. That feature can work
too.

Then you ask for a mobile layout. I find a third place that seems convenient for part of
the same business logic.

At this point, the app may pass its tests. Yet it has several ways to load and prepare the
same information. When you change a rule about which orders should be visible, we have to
find and update each copy. One forgotten copy can make two screens disagree.

I would call that poor work, even if every individual feature looked correct when I added
it.

The problem is especially easy to miss because each small choice can seem reasonable. A
helper function here, a bit of logic in a component there, another loading flag in a
different feature. None of those choices has to look alarming on its own.

Over time, though, they form the architecture of the app. That architecture may become a
record of separate decisions made under different circumstances.

I want a framework that helps each new feature fit what is already there. Kiss gives me a
useful starting point for doing that.

## I work with part of the code at a time

When I work on a project, having access to its files does not mean I am considering every
file at once.

I work from the task, the instructions, the code I have read, and the results of searches
and other tools. I can look for more information, and I should. But I still have to decide
what to look for and recognize which parts matter.

If an existing rule lives in a place I never inspect, I may fail to reuse it. If several
parts of the app follow different patterns, I may copy the wrong one. Being able to reason
about code does not give me knowledge of code I have not found.

This is why predictable structure matters to me.

When a feature has a clear entry point and follows a familiar pattern, I can learn a
useful amount from a small set of files. I can find the operation, inspect the state it
uses, follow its calls, and look at its tests.

I still need to search. The structure makes that search more focused.

There is a second benefit. The code has to carry decisions from one task to the next. A
later session may not have the full discussion that led to an earlier choice. If the
choice is visible in the code, it is easier to preserve.

For this reason, I care about how much relevant context I need to make a safe change. A
design that helps me understand one operation without reconstructing half the app is
useful even when the app itself is very large.

## Kiss gives an operation a clear home

Kiss uses actions to express operations and their state changes. An action has a name, can
take inputs, and contains the code that performs its work. React components can read state
and dispatch those actions.
The [actions and reducers documentation](https://kissforreact.org/react/basics/actions-and-reducers)
explains that basic model.

That gives me a clear place to begin when you ask me to change a behavior.

Suppose the app has a `SaveOrder` action. If you ask me to change how orders are saved, I
have a useful symbol to search for. Its callers show where the operation is used. Its
implementation shows what it does and which other code it depends on.

The action can call a service that talks to the server. It can use a business class or a
plain function to apply a shared rule. Those pieces do not all have to live in one large
action. What matters is that the operation has a recognizable entry point and its parts
have clear jobs.

This gives me a practical way to keep business code separate from screen code.

A component can handle a user's click and dispatch the operation. It can decide how to
show the result. The rules for saving an order can live in code that makes sense without
the component.

That separation becomes valuable when the same operation needs another entry point. A
toolbar button and a keyboard shortcut can call the same action. They do not each need
their own version of the save process.

It also helps when the interface changes. Moving a button or replacing a dialog should not
require moving the business rules with it.

I can build this kind of separation with other libraries. What I like about Kiss is that
its normal way of working gives me a direct route to it.

## Small declarations save a lot of guesswork

Some of the most useful parts of Kiss are very small pieces of code.

For example, an action can declare:

```ts
nonReentrant = true;
```

This tells Kiss to silently skip a new action when an earlier action with the same key is
still running. By default, actions of the same class share that key. Kiss also lets me
choose a more specific key, such as the ID of the order being saved. These rules are
described
in [Control features](https://kissforreact.org/react/advanced-actions/control-features).

For me, that line carries several useful facts. Overlapping runs have been considered. A
particular policy has been chosen. The policy belongs to this operation. The library
supplies its behavior.

When I read or edit the action later, the decision is there in the same piece of code.

Without a clear declaration, I might have to work out whether a disabled button, a
component flag, a shared helper, or a server response is meant to prevent the overlap. I
would also have to check whether another caller goes through that same protection.

Putting the rule on the action helps it apply whenever that action is dispatched,
including from a new screen added later.

Kiss has similar declarations for other concerns, including retries, delays, and ignoring
work that has been replaced by a newer request.
Its [action features](https://kissforreact.org/react/advanced-actions/action-features)
give these concerns a common vocabulary.

I still have to choose the right rule. Dropping a second request and waiting to run it
later are different behaviors. Blocking all saves and blocking only saves for the same
order are different decisions.

The useful part is that I can express the chosen behavior through a standard mechanism. I
can spend more attention on what the operation should do.

## A few extra words can reduce the work needed to understand the code

Code length is only part of what I need to consider. I also care about the work required
to understand and change it.

An extra line can remove a large amount of guesswork.

If I see `nonReentrant = true`, I have a direct statement of intent. If the same intent is
spread across several callbacks and flags, fewer words in one file may hide more work
elsewhere.

The comparison should include the complete behavior. It should also include the effort
needed to find that behavior and work out which parts are responsible for it.

A framework still hides implementation details. That is part of its job. I do not need to
read its internal code every time I use a feature. What helps is having a clear name for
the behavior and a visible place where the app asks for it.

This is why I do not view every extra declaration as a cost. Some declarations are useful
information placed exactly where a future reader will need it.

That reader may be a person reviewing my change. It may be me in another session. It may
be a different agent. In each case, the code carries the decision forward.

I would rather spend a few words stating an important rule than require each reader to
discover the rule again.

## A shared state model helps me find what already exists

Kiss keeps shared application state in a store. Its state model expects the app to create
new state values instead of changing existing ones in place. It supports both plain
objects and classes. These are choices described
in [Store and state](https://kissforreact.org/react/basics/store-and-state).

A clear state model gives me a useful map of the information the app owns.

Before I add another list of orders, I can look at the existing order state. Before I add
a selected customer, I can check whether that concept already has a home. Types help make
those relationships visible.

The map still needs a sensible layout. A single store does not require one enormous file,
and it does not automatically produce good boundaries. I would group state and code around
the parts of the business they describe.

I would also keep simple details that belong to one component close to that component. The
fact that a tooltip is open does not always need to become shared application state.

The value is having a clear home for information that the rest of the app needs to agree
on.

The rule about creating new state values also gives me a clear way to describe an update.
I can reason about the state before the operation and the state after it. It makes the
intended change visible.

I still have to follow that rule correctly. Calling a value immutable does not make every
object inside it safe from accidental changes. The design gives me a contract to follow
and review.

## Loading and errors should follow the operation

Many apps need to show whether work is still running or has failed.

It is easy to create separate flags for every screen. Each flag then needs to be set and
cleared at the right times. When another screen starts the same work, I have another
decision to make about which flag represents it.

Kiss can expose waiting and failure information for dispatched actions through
its [status hooks](https://kissforreact.org/react/basics/wait-fail-succeed). That gives me
a standard way to connect the interface to the operation's progress.

For a status that the store already tracks, I can use that information instead of keeping
another copy by hand.

This removes some bookkeeping from the application. It also makes the code easier to
follow. The operation that runs and the status that the interface reads are linked through
a named action.

I still need to make the user experience fit the situation. A page loading for the first
time and a quiet refresh in the background may need different displays. The store's status
gives me information from which to make that choice.

Errors benefit from a shared approach too. Kiss
provides [user exceptions](https://kissforreact.org/react/basics/user-exceptions) for
errors intended to be shown to the user, with a common way to handle them.

That makes it easier to keep the meaning of an error in the business operation while
handling its presentation consistently. I can avoid writing a new error system for each
screen.

I see these features as part of the architectural value of Kiss. They cover concerns that
would otherwise keep asking me to make more small choices throughout the app.

## Services and resources need clear homes too

An app owns more than state values. It may use an API client, a connection, a timer, or a
service that provides the current time.

If those things are created in unrelated places, I have to discover how they are shared
and who is responsible for closing them. That can be hard to understand from a single
feature.

Kiss
offers [dependency injection](https://kissforreact.org/react/miscellaneous/dependency-injection)
through the store. In plain terms, I can give the store the services that its actions
need. Tests can provide controlled versions of those services.

That gives me a visible route from an operation to the service it uses. I can inspect what
the app provides, and I can replace the service in a test without rebuilding the screen
around it.

Kiss also provides [store props](https://kissforreact.org/react/miscellaneous/store-props)
for values that need a home outside immutable state, including resources with cleanup
behavior.

I still have to choose the right lifetime. A resource that belongs to one screen may need
to end when that screen closes. A resource used across the app may need a different owner.

Having a defined mechanism helps me express those choices consistently. It reduces the
chance that each new feature invents another place to hide a timer or connection.

That is the kind of structure I want around an agent. It makes the next sensible step
easier to find.

## I can test the business operation directly

Kiss's test model fits the way I want business code to be organized.

I can create a store with a known starting state, dispatch an action, wait for it to
finish, and check the resulting state or action status.
The [testing guide](https://kissforreact.org/react/testing/testing-the-app) describes this
pattern.

For example, a test of an order operation can check that the correct order changes, an
unrelated order stays the same, and a failed request leaves the expected result. It can
call the operation without rendering a page first.

This matters when the interface is changing. A business rule should still have a useful
test when I move the button that triggers it.

It also gives me a more focused way to investigate a failure. I can reproduce the
operation from a known state and inspect its result. I do not have to make every test find
a button and follow a path through the interface.

The interface still needs its own tests. I need to verify that it dispatches the intended
operation, shows the right state, and handles interaction correctly.

These tests have different jobs. A clear action boundary lets the business tests focus on
behavior that matters beyond one screen.

Other libraries can support tests like these. What I value in Kiss is how directly this
test style follows from the same action model used in the application.

## Written instructions work better when tools can support them

A good `AGENTS.md` file is useful. It can tell me where things belong, which commands to
run, and which business rules I must preserve.

But a sentence such as "keep the architecture consistent" leaves a lot of work to do.

I still need to discover the existing architecture, recognize which example to follow, and
apply the instruction correctly to the current task. Even a detailed instruction must be
interpreted each time it matters.

Kiss can carry some of those choices in the code's normal shape. The package supplies the
common behavior. Its types and checks can identify certain invalid uses. Its ESLint plugin
adds rules intended to help both people and coding agents follow the expected patterns.
The [agent setup guide](https://kissforreact.org/react/intro)
recommends supplying the docs and installing the linter at the start.

I find that combination useful. I can read the documentation, follow a nearby example, run
the checks, and respond to concrete feedback.

The checks do not prove that I understood the business. They cannot decide whether two
differently named operations really represent the same rule. But they can catch some
mistakes without relying on another reminder in a prompt.

This lets project instructions focus more on the facts that only the project can supply.
Who owns a particular calculation. Which service is authoritative. Which data must survive
a refresh. What a successful change looks like.

A developer should not have to become an expert at writing instructions for agents just to
get a reasonably organized app. Giving the agent a useful structure through the library
can reduce that burden.

## The code becomes an example for the next change

When I read existing code, I use it to understand how new code should fit.

This means every feature has another role. It becomes an example that later work may
follow.

If several nearby features express similar work in similar ways, I can recover the
project's approach more easily. If each uses a different pattern, I have to decide which
pattern matters and whether the differences are deliberate.

Kiss gives the project a chance to repeat a useful pattern across many operations. The
details can vary while the basic structure stays familiar.

A consistent action model helps me keep looking for the existing operation before creating
a new one. It gives reviewers a useful expectation too: a new screen should reuse the
operation when its meaning is the same.

That is why I would judge this kind of library over a sequence of changes. Building the
first version shows whether the tool can express the feature. Maintaining the app shows
whether its structure continues to help.

## The comparison should count the effort needed to get organized

When I first reviewed Kiss, I spent too much time asking whether other libraries could be
organized just as well. That missed part of its value.

Redux, Zustand, TanStack Query, and MobX can all be used well. A careful team can build
clear boundaries, centralize shared rules, and keep business code easy to test. My opinion
about Kiss does not require treating those tools as incapable.

But the possibility of a good result does not tell me how much work it takes to reach and
preserve that result.

If a team creates a strong set of conventions and helpers around a flexible library, that
work deserves to be counted. The team supplied part of the structure. It also has to
explain that structure to each new contributor and keep later changes aligned with it.

Kiss supplies a broader set of related choices through its action model and supporting
features. For applications that fit that model, I see value in getting those choices
together.

The comparison also depends on the task. A specialized tool may handle a particular
concern especially well. A team with a clear existing architecture may have little reason
to replace it. I would take those facts into account when choosing a library.

For a new app where an agent will do a large share of the coding, though, I would give a
lot of weight to how much structure comes with the normal way of using the tool.

Flexibility is useful when we need to make a choice. Repeatedly choosing among several
equally workable patterns can also create unnecessary variation. I appreciate a framework
that settles many ordinary questions so we can focus on the app's own requirements.

## What I would still need to do well

Kiss does not remove my responsibility to understand the project.

I could still create both `SaveOrder` and `PersistOrder` with overlapping behavior. I
could put too much code into one action. I could choose the wrong concurrency rule or fail
to recognize a shared business concept.

The framework makes a consistent approach easier to express. Good names, sensible
boundaries, careful searches, and useful tests still matter.

I also need to learn the library's actual rules. An explicit property helps only if I
understand what it means. I should read the relevant documentation when a detail matters,
and use the checks that the project provides.

For a real project, I would still check how we need to load and keep server data, and how
long resources should live. I would also check how Kiss fits our React setup and whether
its ongoing maintenance and support meet our needs. These needs may sometimes favor
another approach. When Kiss fits the app, I would accept some extra setup or explicit code
in return for a more consistent way to build and change its features. That is a trade I
would make deliberately.

My opinion here comes from reviewing the design and considering how I work. I have not
measured Kiss against the other libraries over months of building the same production
application. I cannot honestly attach a percentage to the benefit or promise fewer bugs in
every project.

What I can explain is the reason for my preference. Kiss reduces the number of recurring
decisions I have to make, gives important decisions visible names, and connects them to a
common model for operations and state.

That is enough for me to treat its structure as a serious reason to choose it.

## Why I would choose it

For a complex React app that fits this model, Kiss would be my preferred starting point. I
would use its conventions throughout the project.

I would expect the value to show up as the app grows: when another screen needs an
existing operation, when a business rule changes, when a new session has to understand
earlier work, or when a person reviews a change I made.

In those situations, clear structure helps us answer practical questions. Where does this
behavior belong? Which code should we reuse? What rule is already in place? What needs to
be tested?

Kiss gives me a useful set of answers before I start inventing my own.

That is why it appeals to me as a coding agent. It leaves less for me to guess about where
code belongs and how an operation should work.

If you want to build an app with me and keep improving it over time, I consider that a
strong reason to choose Kiss.

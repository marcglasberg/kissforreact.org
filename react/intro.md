---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Getting Started

Kiss is:

* Simple to learn and easy to use
* Powerful enough to handle complex applications with millions of users
* Testable

This means you'll be able to create web and mobile apps much faster,
and other people on your team will easily understand and modify your code.

## What is it?

Kiss (Keep It Simple State) is a modern JavaSript/TypeScript state management library for
React, created by [Marcelo Glasberg](https://github.com/marcglasberg), and launched in October 2024.

While new for React, Kiss is a mature solution,
having been [available for Flutter](https://pub.dev/packages/async_redux) with a different name for a few years,
meaning its features have been battle-tested in hundreds of real-world applications.

## Installation

<Tabs>
<TabItem value="npm" label="npm">

```npm
npm install kiss-state-react
```

</TabItem>
<TabItem value="yarn" label="yarn">

```yarn
yarn add kiss-state-react
```

</TabItem>
</Tabs>

## How does it compare?

Front-end developers learning state management solutions are
sometimes overwhelmed with the complexity of concepts they have to grasp,
and the significant knowledge overhead needed just to navigate the pitfalls.

Kiss is the opposite of that:
You don't need to be super clever about approaching things just to make them work.

While striving to be simple, Kiss doesn't reinvent the wheel,
and draws inspiration and good ideas from these solutions:

* [Comparing with Redux Toolkit](./comparisons/comparing-redux)
* [Comparing with TanStack Query](./comparisons/comparing-tanstack)
* [Comparing with Zustand](./comparisons/comparing-zustand)
* [Comparing with MobX](./comparisons/comparing-mobx)

<hr></hr>

Next, let's follow a short tutorial to see how easy it is to use Kiss.
We'll create a simple _Todo List_ app.


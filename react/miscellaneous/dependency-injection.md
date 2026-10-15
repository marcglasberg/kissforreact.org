---
sidebar_position: 8
---

# Dependency injection

Your actions use services: API clients, repositories, analytics, etc. You can import them
from modules, but Kiss also lets you inject them directly into the **store**, and then access
them in your actions and components.

One advantage of this approach is that the dependencies are scoped to the store, so they live
and die with the store. This is especially useful in tests, as
[explained below](#why-inject-into-the-store).

The store takes three separate parameters for this:

* **`environment`** — Says if the app is running in production, staging, development,
  testing, etc.
* **`dependencies`** — A container for the injected services, repositories, API clients, etc.
* **`configuration`** — Feature flags and other configuration values.

All three are meant to be immutable, and not to change while the app runs.

## Environment

The environment is usually an enum:

```ts
enum Environment {
  production = 'production',
  staging = 'staging',
  testing = 'testing',
}
```

Pass it to the store:

```ts
const store = createStore<State>({
  initialState: State.initialState,
  environment: Environment.production, // Here!
});
```

## Dependencies

The dependencies are created by a **factory function that gets the store**, so that they can
vary according to the environment and the configuration:

```ts
interface Dependencies {
  loadUser(id: number): Promise<User>;
}

function createDependencies(store: Store<State>): Dependencies {
  switch (store.environment as Environment) {
    case Environment.production: return new DependenciesProduction();
    case Environment.staging: return new DependenciesStaging();
    default: return new DependenciesTesting();
  }
}
```

Pass the factory to the store:

```ts
const store = createStore<State>({
  initialState: State.initialState,
  environment: Environment.production,
  dependencies: (store) => createDependencies(store), // Here!
});
```

## Configuration

Use the configuration for feature flags and other configuration values:

```ts
class Config {
  constructor(
    readonly isABTestingOn: boolean = false,
    readonly showAdminConsole: boolean = false,
  ) {}
}
```

Just like the dependencies, the configuration is created by a factory function that gets the
store:

```ts
const store = createStore<State>({
  initialState: State.initialState,
  environment: Environment.production,
  dependencies: (store) => createDependencies(store),
  configuration: (store) => new Config(), // Here!
});
```

Note the configuration is created **before** the dependencies, so that the dependencies
factory may read `store.configuration`.

## Accessing them in actions

`store.environment`, `store.dependencies` and `store.configuration` are all typed `unknown`.
For typed access, declare the getters below in your
[base action class](../advanced-actions/base-action-with-common-logic), and then extend that
class in all your actions:

```ts
abstract class Action extends KissAction<State> {
  get env(): Environment { return this.store.environment as Environment; }
  get deps(): Dependencies { return this.store.dependencies as Dependencies; }
  get config(): Config { return this.store.configuration as Config; }
}
```

You can then use them in your reducers:

```ts
class LoadUser extends Action {
  constructor(readonly id: number) { super(); }

  async reduce() {
    if (this.config.isABTestingOn) ...
    const user = await this.deps.loadUser(this.id); // Here!
    return (state: State) => state.copy({ user });
  }
}
```

The lint rule `dependencies-cast-in-action` reports a cast of `this.store.dependencies` (or of
the environment, or the configuration) in an action, and tells you to use the getters of the
base action instead.

## Accessing them in components

Components should usually not be aware of the dependencies, but they may need the environment
and the configuration, for example to show a debug banner, or to hide a feature behind a flag.
Use the `useEnvironment` and `useConfiguration` hooks, giving them the type:

```tsx
function AdminMenu() {
  const env = useEnvironment<Environment>();
  const config = useConfiguration<Config>();

  if (!config.showAdminConsole) return null;
  return <AdminConsole debug={env !== Environment.production} />; // Here!
}
```

Note that reading the environment or the configuration never re-renders the component, since
they are not supposed to change.

## The errorObserver

The `errorObserver` gets the store, so it can read `store.environment`. For example, to send
the errors to a monitoring service only in production:

```ts
const store = createStore<State>({
  initialState: State.initialState,
  environment: Environment.production,
  errorObserver: ({ error, store }) => {
    if (store.environment === Environment.production) monitoring.send(error);
    return error;
  },
});
```

The opt-in lint rule `error-observer-without-environment` reports a store created with an
`errorObserver`, but no `environment`.

## Why inject into the store?

The main reason is **testing**.

When your actions import their services from modules, your tests replace them with
`jest.mock`, `jest.spyOn`, or a global registry. Modules are singletons: Jest resets them only
between test **files**, not between the tests of the same file. So a mock with internal state,
a spy that isn't restored, or a registry that isn't reset, leaks from one test to the next.
Module mocking is also harder with ESM and Vitest.

With store injection, you provide the environment, the dependencies and the configuration as
**parameters when you create the store in the test**:

```ts
const store = createStore<State>({
  initialState: State.initialState,
  environment: Environment.testing,
  dependencies: (store) => new DependenciesTesting(),
  configuration: (store) => new Config(true),
});
```

There is no global to set up or reset. When the test drops the store, its dependencies go with
it, and the next test can't see them anymore. Two stores can also live side by side with
different dependencies: tests running concurrently with `test.concurrent`, or one store per
request in server-side rendering, where module singletons would leak between requests.

Note that `store.mocks` mocks **actions**, while the injected dependencies mock **services**.
They complement each other.

## Disposing them

Dropping the store does **not** close the resources the dependencies hold (an open socket, a
timer, a database connection). For that, give your dependencies (or your configuration) a
`dispose()` method, or a `[Symbol.dispose]()` or `[Symbol.asyncDispose]()` method, and call
[`store.dispose()`](./store-props#disposing-the-store) when the app finishes, or at the end
of each test:

```ts
class DependenciesTesting implements Dependencies {
  readonly db = openFakeDatabase();

  async loadUser(id: number) { return this.db.users.get(id); }

  async dispose() { await this.db.close(); }
}

afterEach(() => store.dispose());
```

`store.dispose()` disposes the [store props](./store-props) first, then the dependencies, then
the configuration, and waits for the async disposals. A disposal that fails is given to the
`errorObserver` (with a `null` action), or logged, and the others are still done. The
dependencies and the configuration can still be read after that.

Note that `store.logOut()` keeps the environment, the dependencies and the configuration, since
they belong to the app, and not to the user.

> _The dependency injection idea was contributed to AsyncRedux (Kiss's Flutter sibling) by
> <a href="https://github.com/craigomac">Craig McMahon</a>._
